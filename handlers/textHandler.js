const OpenAIService = require("../services/openaiService");
const MemoryService = require("../services/memoryService");
const FirebaseService = require("../services/firebaseService");
const IntentClassifierService = require("../services/intentClassifierService");
const ContentMatcherService = require("../services/contentMatcherService");
const ElevenLabsService = require("../services/elevenlabsService");
const { getPersona } = require("../utils/constants");
const { randomDelay } = require("../utils/helpers");
const { MINI_APP_URL } = require("../config");
const fs = require("fs");
const path = require("path");
const os = require("os");

class TextHandler {
    constructor(openaiService, memoryService) {
        this.openaiService = openaiService;
        this.memoryService = memoryService;
        this.intentClassifier = new IntentClassifierService();
        this.contentMatcher = new ContentMatcherService();
        this.elevenlabsService = new ElevenLabsService();
        // Track recently sent content to prevent immediate repetition
        this.recentlySent = new Map(); // userId -> {contentId, timestamp}
        // Track if user has received intro messages to avoid repetition
        this.hasReceivedIntro = new Set(); // Set of userIds who received the paid content intro
    }

    isRecentlySent(userId, contentId) {
        const key = `${userId}_${contentId}`;
        const recent = this.recentlySent.get(key);
        if (!recent) return false;

        // Consider content "recently sent" if sent within last 5 minutes
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        return recent.timestamp > fiveMinutesAgo;
    }

    markAsSent(userId, contentId) {
        const key = `${userId}_${contentId}`;
        this.recentlySent.set(key, {
            contentId,
            timestamp: Date.now()
        });

        // Clean up old entries (older than 10 minutes)
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        for (const [k, v] of this.recentlySent.entries()) {
            if (v.timestamp < tenMinutesAgo) {
                this.recentlySent.delete(k);
            }
        }
    }

    async handleTextMessage(ctx) {
        const userId = ctx.from.id;
        const userMessage = ctx.message.text;

        console.log(`[${userId}] User: ${userMessage}`);

        // Save user message to Firebase
        await FirebaseService.saveChatMessage(userId, "user", userMessage);

        // Show typing indicator
        await ctx.sendChatAction("typing");
        await randomDelay();

        // Get user context (history of what they've received)
        const sentContentUrls = await FirebaseService.getUserSentContentUrls(userId);
        const userContext = {
            hasFreeContentHistory: sentContentUrls.size > 0,
            sentContentCount: sentContentUrls.size
        };

        // Load conversation history
        if (!this.memoryService.userMemoryLoaded[userId] || !this.memoryService.userMemory[userId] || this.memoryService.userMemory[userId].length === 0) {
            await this.memoryService.loadUserHistory(userId, FirebaseService);
        }
        this.memoryService.initializeUser(userId);

        // Get recent conversation for context
        const recentConversation = this.memoryService.userMemory[userId].slice(-5);

        // STEP 1: Use Intent Classifier AI to understand what user wants
        const intent = await this.intentClassifier.analyzeIntent(
            userMessage,
            recentConversation,
            userContext
        );

        console.log(`[${userId}] 🎯 Detected intent: ${intent.action}`);

        // STEP 2: Take action based on intent
        switch (intent.action) {
            case "greeting":
                await this.handleGreeting(ctx, userId, userMessage);
                break;

            case "request_voice_note":
                await this.handleVoiceNoteRequest(ctx, userId, userMessage);
                break;

            case "request_free_content":
                await this.handleFreeContentRequest(ctx, userId, userMessage, sentContentUrls);
                break;

            case "request_paid_content":
            case "open_packages":
                await this.handlePaidContentRequest(ctx, userId, userMessage);
                break;

            case "select_free":
                await this.handleFreeContentSelection(ctx, userId, sentContentUrls);
                break;

            case "select_paid":
                await this.handlePaidContentRequest(ctx, userId, userMessage);
                break;

            case "select_photo":
                await this.handleTypeSelection(ctx, userId, "photo", sentContentUrls);
                break;

            case "select_video":
                await this.handleTypeSelection(ctx, userId, "video", sentContentUrls);
                break;

            case "simple_chat":
            default:
                await this.handleAIResponse(ctx, userId, userMessage);
                break;
        }
    }

    async handleGreeting(ctx, userId, userMessage) {
        // Check if message is already in memory
        const lastMessage = this.memoryService.userMemory[userId][this.memoryService.userMemory[userId].length - 1];
        const isDuplicate = lastMessage && lastMessage.content === userMessage && lastMessage.role === "user";

        if (!isDuplicate) {
            this.memoryService.addMessage(userId, "user", userMessage);
        } else {
            console.log(`[${userId}] ⚠️ Duplicate message detected, skipping memory add`);
        }

        const persona = getPersona();
        const messagesToSend = this.memoryService.getMessagesWithinLimit(userId, persona);

        console.log(`[${userId}] 📝 Using persona for greeting response (length: ${persona.length} chars)`);

        // Get AI response for greeting
        const response = await this.openaiService.getChatCompletion(persona, messagesToSend);

        console.log(`[${userId}] Nyla: ${response}`);

        // Check if we just sent this exact response
        const lastAssistantMessage = this.memoryService.userMemory[userId]
            .slice()
            .reverse()
            .find(m => m.role === "assistant");

        if (lastAssistantMessage && lastAssistantMessage.content === response) {
            console.log(`[${userId}] ⚠️ Duplicate response detected, not sending again`);
            return;
        }

        this.memoryService.addMessage(userId, "assistant", response);
        await FirebaseService.saveChatMessage(userId, "assistant", response);
        await ctx.reply(response);
    }

    async handleVoiceNoteRequest(ctx, userId, userMessage) {
        try {
            console.log(`[${userId}] 🎤 User requested voice note`);

            // Add user message to memory
            const lastMessage = this.memoryService.userMemory[userId][this.memoryService.userMemory[userId].length - 1];
            const isDuplicate = lastMessage && lastMessage.content === userMessage && lastMessage.role === "user";

            if (!isDuplicate) {
                this.memoryService.addMessage(userId, "user", userMessage);
            }

            // Get AI response using last 20 messages for context
            const persona = getPersona();
            const allMessages = this.memoryService.getUserMessages(userId);
            const last20Messages = allMessages.slice(-20);

            console.log(`[${userId}] 📊 Using last ${last20Messages.length} messages for context`);

            // Generate text response
            const textResponse = await this.openaiService.getChatCompletion(persona, last20Messages);

            console.log(`[${userId}] 🤖 Generated response: ${textResponse}`);

            // Convert to speech using ElevenLabs
            await ctx.sendChatAction("record_voice");
            await randomDelay();

            console.log(`[${userId}] 🎙️ Converting to speech with ElevenLabs...`);

            const audioBuffer = await this.elevenlabsService.textToSpeech(textResponse);

            // Save audio to temp file
            const outputPath = path.join(os.tmpdir(), `voice_${userId}_${Date.now()}.mp3`);
            fs.writeFileSync(outputPath, audioBuffer);

            console.log(`[${userId}] 🎵 Sending voice message...`);

            // Send voice message
            await ctx.replyWithVoice({ source: fs.createReadStream(outputPath) });

            // Save response to memory and Firebase
            this.memoryService.addMessage(userId, "assistant", textResponse);
            await FirebaseService.saveChatMessage(userId, "assistant", `[Voice message] ${textResponse}`);

            // Clean up temp audio file
            fs.unlinkSync(outputPath);

            console.log(`[${userId}] ✅ Voice note sent successfully`);

        } catch (error) {
            console.error(`[${userId}] Error handling voice note request:`, error);
            await ctx.reply("Sorry babe, I can't send voice messages right now... but I'm here for you! 💕");
        }
    }

    async handleFreeContentRequest(ctx, userId, userMessage, sentContentUrls) {
        try {
            // Get all content from Firebase
            const allContent = await FirebaseService.getAllContent();
            
            // Filter for free content only
            const freeContent = allContent.filter(c => c.isFree === true);
            const unsentFreeContent = freeContent.filter(c => !sentContentUrls.has(c.fileUrl));

            if (unsentFreeContent.length === 0) {
                // No free content available, send paid content as locked
                const paidContent = allContent.filter(c => !c.isFree && c.price > 0);
                if (paidContent.length > 0) {
                    // Use ContentMatcher to find best match
                    const matchResult = await this.contentMatcher.matchContent(userMessage, paidContent, false);
                    if (matchResult.matched && matchResult.contentIds.length > 0) {
                        const matchedContent = this.contentMatcher.getContentByIds(matchResult.contentIds, paidContent);
                        if (matchedContent.length > 0) {
                            const botReply = "I just sent you something special, didn't I? What more are you looking for? 😘";
                            await ctx.reply(botReply);
                            await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                            await randomDelay();
                            await this.sendContent(ctx, userId, matchedContent[0]);
                            return;
                        }
                    }
                    // Fallback: send random paid content
                    const randomPaid = paidContent[Math.floor(Math.random() * paidContent.length)];
                    const botReply = "I just sent you something special, didn't I? What more are you looking for? 😘";
                    await ctx.reply(botReply);
                    await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                    await randomDelay();
                    await this.sendContent(ctx, userId, randomPaid);
                    return;
                }
                
                const botReply = "You've already seen all my free content babe! 💕 Want to see my exclusive stuff? 😘";
                await ctx.reply(botReply);
                await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                return;
            }

            // Filter out recently sent content to avoid repetition
            const notRecentlySent = unsentFreeContent.filter(c => !this.isRecentlySent(userId, c.id));
            const availableContent = notRecentlySent.length > 0 ? notRecentlySent : unsentFreeContent;

            // Use ContentMatcher to find best matching free content
            const matchResult = await this.contentMatcher.matchContent(userMessage, availableContent, true);

            let contentToSend = null;
            if (matchResult.matched && matchResult.contentIds.length > 0) {
                const matchedContent = this.contentMatcher.getContentByIds(matchResult.contentIds, availableContent);
                if (matchedContent.length > 0) {
                    // Add randomization: pick randomly from matched content instead of always first
                    contentToSend = matchedContent[Math.floor(Math.random() * matchedContent.length)];
                }
            }

            // Fallback to random if no match
            if (!contentToSend) {
                contentToSend = availableContent[Math.floor(Math.random() * availableContent.length)];
            }

            // Mark as sent BEFORE sending to prevent race conditions
            this.markAsSent(userId, contentToSend.id);

            // Send content immediately with a natural message
            const botReply = "Here you go babe! 😍💕";
            await ctx.reply(botReply);
            await FirebaseService.saveChatMessage(userId, "assistant", botReply);
            await randomDelay();
            await this.sendContent(ctx, userId, contentToSend);

        } catch (error) {
            console.error(`[${userId}] Error handling free content request:`, error);
            await ctx.reply("Sorry babe, something went wrong... try again? 😅");
        }
    }

    async handleFreeContentSelection(ctx, userId, sentContentUrls) {
        try {
            // Get all content from Firebase
            const allContent = await FirebaseService.getAllContent();

            // Filter for free content only
            const freeContent = allContent.filter(c => c.isFree === true);
            const unsentFreeContent = freeContent.filter(c => !sentContentUrls.has(c.fileUrl));

            if (unsentFreeContent.length === 0) {
                // All free content sent, suggest packages
                const botReply = "You've already seen all my free content babe! 💕 Want to see my exclusive stuff? 😘";
                await ctx.reply(botReply);
                await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                await this.openMiniApp(ctx, userId);
                return;
            }

            // Ask: Photo or Video?
            const freePhotos = unsentFreeContent.filter(c => c.type === 'photo');
            const freeVideos = unsentFreeContent.filter(c => c.type === 'video');

            let availableTypes = [];
            if (freePhotos.length > 0) availableTypes.push("photo");
            if (freeVideos.length > 0) availableTypes.push("video");

            if (availableTypes.length === 0) {
                const botReply = "No free content available babe! Check out my packages! 💕";
                await ctx.reply(botReply);
                await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                await this.openMiniApp(ctx, userId);
                return;
            }

            const botReply = "Do you want a video or pic babe? 😘";
            await ctx.reply(botReply);
            await FirebaseService.saveChatMessage(userId, "assistant", botReply);

        } catch (error) {
            console.error(`[${userId}] Error handling free content selection:`, error);
            await ctx.reply("Sorry babe, something went wrong... try again? 😅");
        }
    }

    async handleTypeSelection(ctx, userId, type, sentContentUrls) {
        try {
            // Get all content from Firebase
            const allContent = await FirebaseService.getAllContent();

            // Filter for free content of selected type
            const freeContent = allContent.filter(c => c.isFree === true && c.type === type);
            const unsentFreeContent = freeContent.filter(c => !sentContentUrls.has(c.fileUrl));

            if (unsentFreeContent.length === 0) {
                const botReply = `No free ${type}s left babe! 💕 Want to see my paid packages? 😘`;
                await ctx.reply(botReply);
                await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                await this.openMiniApp(ctx, userId);
                return;
            }

            // Filter out recently sent content to avoid repetition
            const notRecentlySent = unsentFreeContent.filter(c => !this.isRecentlySent(userId, c.id));
            const availableContent = notRecentlySent.length > 0 ? notRecentlySent : unsentFreeContent;

            // Send ONLY 1 random item from available content
            const randomContent = availableContent[Math.floor(Math.random() * availableContent.length)];

            // Mark as sent BEFORE sending to prevent race conditions
            this.markAsSent(userId, randomContent.id);

            const botReply = "Here you go babe! 😍💕";
            await ctx.reply(botReply);
            await FirebaseService.saveChatMessage(userId, "assistant", botReply);
            await this.sendContent(ctx, userId, randomContent);

        } catch (error) {
            console.error(`[${userId}] Error handling type selection:`, error);
            await ctx.reply("Sorry babe, something went wrong... try again? 😅");
        }
    }

    async handlePaidContentRequest(ctx, userId, userMessage) {
        try {
            // Get all paid content from Firebase
            const allContent = await FirebaseService.getAllContent();
            const paidContent = allContent.filter(c => !c.isFree && c.price > 0);

            if (paidContent.length === 0) {
                const botReply = "I have so much exclusive content for you babe! 💕✨ Check out my packages below!";
                await ctx.reply(botReply);
                await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                await this.openMiniApp(ctx, userId);
                return;
            }

            // Get user's sent content history to avoid repeating
            const sentContentUrls = await FirebaseService.getUserSentContentUrls(userId);
            const unsentPaidContent = paidContent.filter(c => !sentContentUrls.has(c.fileUrl));

            // If all paid content has been sent, reset and use all paid content again
            let availablePaidContent = unsentPaidContent.length > 0 ? unsentPaidContent : paidContent;

            // Filter out recently sent content to avoid repetition
            const notRecentlySent = availablePaidContent.filter(c => !this.isRecentlySent(userId, c.id));
            availablePaidContent = notRecentlySent.length > 0 ? notRecentlySent : availablePaidContent;

            // Use ContentMatcher to find best matching paid content from unsent items
            const matchResult = await this.contentMatcher.matchContent(userMessage, availablePaidContent, false);

            let contentToSend = null;
            if (matchResult.matched && matchResult.contentIds.length > 0) {
                const matchedContent = this.contentMatcher.getContentByIds(matchResult.contentIds, availablePaidContent);
                if (matchedContent.length > 0) {
                    // Add randomization: pick randomly from matched content
                    contentToSend = matchedContent[Math.floor(Math.random() * matchedContent.length)];
                }
            }

            // Fallback to random if no match
            if (!contentToSend) {
                contentToSend = availablePaidContent[Math.floor(Math.random() * availablePaidContent.length)];
            }

            // Mark as sent BEFORE sending to prevent race conditions
            this.markAsSent(userId, contentToSend.id);

            // Send paid content as locked media with natural message
            // Only send intro message if user hasn't received it before
            if (!this.hasReceivedIntro.has(userId)) {
                const botReply = "I have a whole collection of premium pics and videos for you. What kind of stuff are you looking for? 😘";
                await ctx.reply(botReply);
                await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                await randomDelay();
                // Mark that user has received the intro
                this.hasReceivedIntro.add(userId);
            } else {
                // User already got intro, just send content with brief message
                const botReply = "Here you go babe! 😘💕";
                await ctx.reply(botReply);
                await FirebaseService.saveChatMessage(userId, "assistant", botReply);
                await randomDelay();
            }

            await this.sendContent(ctx, userId, contentToSend);

        } catch (error) {
            console.error(`[${userId}] Error handling paid content request:`, error);
            const botReply = "I have so much exclusive content for you babe! 💕✨ Check out my packages below!";
            await ctx.reply(botReply);
            await FirebaseService.saveChatMessage(userId, "assistant", botReply);
            await this.openMiniApp(ctx, userId);
        }
    }


    async openMiniApp(ctx, userId) {
        await randomDelay();

        await ctx.reply("Tap the button below to see packages! 🛍️⭐", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "⭐ Open Stars Store",
                            web_app: { url: MINI_APP_URL }
                        }
                    ]
                ]
            }
        });

        await FirebaseService.saveChatMessage(userId, "assistant", "Sent mini app link");
    }

    async sendContent(ctx, userId, content, customMessage = null) {
        if (customMessage) {
            await randomDelay();
        }

        // If content is paid (not free), send as paid media
        if (!content.isFree && content.price > 0) {
            await this.sendPaidMedia(ctx, userId, content);
        } else {
            // Send free content normally
            if (content.type === "video") {
                await ctx.replyWithVideo(content.fileUrl, {
                    caption: content.title || "Just for you babe 😘"
                });

                await FirebaseService.saveChatMessage(userId, "assistant", content.title || "Sent video", {
                    fileUrl: content.fileUrl,
                    mediaType: "video",
                    type: "video",
                    contentId: content.id
                });
            } else {
                await ctx.replyWithPhoto(content.fileUrl, {
                    caption: content.title || "Just for you babe 😘"
                });

                await FirebaseService.saveChatMessage(userId, "assistant", content.title || "Sent photo", {
                    fileUrl: content.fileUrl,
                    mediaType: "photo",
                    type: "photo",
                    contentId: content.id
                });
            }
        }
    }

    async sendPaidMedia(ctx, userId, content) {
        try {
            const chatId = ctx.chat?.id || ctx.message?.chat?.id;
            const businessConnectionId = ctx.update?.business_message?.business_connection_id || ctx.business_connection_id;

            if (!chatId) {
                console.error(`[${userId}] No chat ID found for paid media`);
                return;
            }

            // Prepare media array for paid media
            const media = [{
                type: content.type === "video" ? "video" : "photo",
                media: content.fileUrl
            }];

            // Prepare options for paid media
            const options = {
                caption: content.title || "Unlock to see! 😘"
            };

            // Add business_connection_id if this is a business message
            if (businessConnectionId) {
                options.business_connection_id = businessConnectionId;
            }

            // Use callApi to send paid media (sendPaidMedia method might not be directly available)
            try {
                // Try using callApi with the correct Telegram Bot API method
                await ctx.telegram.callApi('sendPaidMedia', {
                    chat_id: chatId,
                    star_count: content.price,
                    media: media,
                    ...options
                });
            } catch (apiError) {
                // If callApi fails, check if sendPaidMedia method exists directly
                if (typeof ctx.telegram.sendPaidMedia === 'function') {
                    try {
                        await ctx.telegram.sendPaidMedia(
                            chatId,
                            content.price,
                            media,
                            options
                        );
                    } catch (directError) {
                        throw directError;
                    }
                } else {
                    // Fallback: Send as regular media with price in caption
                    // Note: This won't create locked content, but will show the price
                    console.log(`[${userId}] ⚠️ sendPaidMedia not available, using fallback method`);
                    
                    if (content.type === "video") {
                        await ctx.replyWithVideo(content.fileUrl, {
                            caption: `${content.title || "Unlock to see! 😘"}\n\n💰 Unlock for ⭐ ${content.price}`,
                            ...options
                        });
                    } else {
                        await ctx.replyWithPhoto(content.fileUrl, {
                            caption: `${content.title || "Unlock to see! 😘"}\n\n💰 Unlock for ⭐ ${content.price}`,
                            ...options
                        });
                    }
                    
                    console.log(`[${userId}] ⚠️ Sent paid media as regular media with price in caption (fallback)`);
                }
            }

            console.log(`[${userId}] 💰 Sent paid media: ${content.title} for ${content.price} stars`);

            await FirebaseService.saveChatMessage(userId, "assistant", `Sent paid ${content.type}: ${content.title}`, {
                fileUrl: content.fileUrl,
                mediaType: content.type,
                type: content.type,
                price: content.price,
                isPaidMedia: true,
                contentId: content.id
            });

        } catch (error) {
            console.error(`[${userId}] Error sending paid media:`, error);
            await ctx.reply("Sorry babe, there was an issue sending that content... try again? 😅");
        }
    }

    async handleAIResponse(ctx, userId, userMessage) {
        // Check if message is already in memory
        const lastMessage = this.memoryService.userMemory[userId][this.memoryService.userMemory[userId].length - 1];
        const isDuplicate = lastMessage && lastMessage.content === userMessage && lastMessage.role === "user";

        if (!isDuplicate) {
            this.memoryService.addMessage(userId, "user", userMessage);
        } else {
            console.log(`[${userId}] ⚠️ Duplicate message detected, skipping memory add`);
        }

        // Check if user message contains content request keywords
        const contentKeywords = ['pic', 'photo', 'picture', 'image', 'video', 'vid', 'content', 'show me', 'send me', 'got any', 'let me see', 'want to see', 'premium', 'exclusive'];
        const lowerMessage = userMessage.toLowerCase();
        const hasContentRequest = contentKeywords.some(keyword => lowerMessage.includes(keyword));

        // If content request detected, try to send content first
        if (hasContentRequest) {
            const sentContentUrls = await FirebaseService.getUserSentContentUrls(userId);
            const allContent = await FirebaseService.getAllContent();
            
            // Try free content first
            const freeContent = allContent.filter(c => c.isFree === true);
            const unsentFreeContent = freeContent.filter(c => !sentContentUrls.has(c.fileUrl));
            
            if (unsentFreeContent.length > 0) {
                // Filter out recently sent content to avoid repetition
                const notRecentlySent = unsentFreeContent.filter(c => !this.isRecentlySent(userId, c.id));
                const availableContent = notRecentlySent.length > 0 ? notRecentlySent : unsentFreeContent;

                // Use ContentMatcher to find best match
                const matchResult = await this.contentMatcher.matchContent(userMessage, availableContent, true);
                let contentToSend = null;

                if (matchResult.matched && matchResult.contentIds.length > 0) {
                    const matchedContent = this.contentMatcher.getContentByIds(matchResult.contentIds, availableContent);
                    if (matchedContent.length > 0) {
                        // Add randomization: pick randomly from matched content
                        contentToSend = matchedContent[Math.floor(Math.random() * matchedContent.length)];
                    }
                }

                if (!contentToSend) {
                    contentToSend = availableContent[Math.floor(Math.random() * availableContent.length)];
                }

                // Mark as sent BEFORE sending to prevent race conditions
                this.markAsSent(userId, contentToSend.id);

                // Send AI response first, then content
                const persona = getPersona();
                const messagesToSend = this.memoryService.getMessagesWithinLimit(userId, persona);
                const response = await this.openaiService.getChatCompletion(persona, messagesToSend);

                this.memoryService.addMessage(userId, "assistant", response);
                await FirebaseService.saveChatMessage(userId, "assistant", response);
                await ctx.reply(response);

                await randomDelay();
                await this.sendContent(ctx, userId, contentToSend);
                return;
            } else {
                // No free content, send paid content as locked
                const paidContent = allContent.filter(c => !c.isFree && c.price > 0);
                if (paidContent.length > 0) {
                    // Get user's sent content history to avoid repeating paid content
                    const unsentPaidContent = paidContent.filter(c => !sentContentUrls.has(c.fileUrl));

                    // If all paid content has been sent, reset and use all paid content again
                    let availablePaidContent = unsentPaidContent.length > 0 ? unsentPaidContent : paidContent;

                    // Filter out recently sent content to avoid repetition
                    const notRecentlySent = availablePaidContent.filter(c => !this.isRecentlySent(userId, c.id));
                    availablePaidContent = notRecentlySent.length > 0 ? notRecentlySent : availablePaidContent;

                    const matchResult = await this.contentMatcher.matchContent(userMessage, availablePaidContent, false);
                    let contentToSend = null;

                    if (matchResult.matched && matchResult.contentIds.length > 0) {
                        const matchedContent = this.contentMatcher.getContentByIds(matchResult.contentIds, availablePaidContent);
                        if (matchedContent.length > 0) {
                            // Add randomization: pick randomly from matched content
                            contentToSend = matchedContent[Math.floor(Math.random() * matchedContent.length)];
                        }
                    }

                    if (!contentToSend) {
                        contentToSend = availablePaidContent[Math.floor(Math.random() * availablePaidContent.length)];
                    }

                    // Mark as sent BEFORE sending to prevent race conditions
                    this.markAsSent(userId, contentToSend.id);

                    // Send AI response first, then locked content
                    const persona = getPersona();
                    const messagesToSend = this.memoryService.getMessagesWithinLimit(userId, persona);
                    const response = await this.openaiService.getChatCompletion(persona, messagesToSend);

                    this.memoryService.addMessage(userId, "assistant", response);
                    await FirebaseService.saveChatMessage(userId, "assistant", response);
                    await ctx.reply(response);

                    await randomDelay();
                    await this.sendContent(ctx, userId, contentToSend);
                    return;
                }
            }
        }

        // Normal AI response flow
        const persona = getPersona();
        const messagesToSend = this.memoryService.getMessagesWithinLimit(userId, persona);

        console.log(`[${userId}] 📊 Using ${messagesToSend.length} messages for context`);
        console.log(`[${userId}] 📝 Using persona for AI response (length: ${persona.length} chars)`);

        const response = await this.openaiService.getChatCompletion(persona, messagesToSend);

        console.log(`[${userId}] Nyla: ${response}`);

        // Check if we just sent this exact response
        const lastAssistantMessage = this.memoryService.userMemory[userId]
            .slice()
            .reverse()
            .find(m => m.role === "assistant");

        if (lastAssistantMessage && lastAssistantMessage.content === response) {
            console.log(`[${userId}] ⚠️ Duplicate response detected, not sending again`);
            return;
        }

        this.memoryService.addMessage(userId, "assistant", response);
        await FirebaseService.saveChatMessage(userId, "assistant", response);
        await ctx.reply(response);
    }
}

module.exports = TextHandler;
