const OpenAIService = require("../services/openaiService");
const MemoryService = require("../services/memoryService");
const FirebaseService = require("../services/firebaseService");
const IntentClassifierService = require("../services/intentClassifierService");
const ContentMatcherService = require("../services/contentMatcherService");
const { getPersona } = require("../utils/constants");
const { randomDelay } = require("../utils/helpers");
const { MINI_APP_URL } = require("../config");

class TextHandler {
    constructor(openaiService, memoryService) {
        this.openaiService = openaiService;
        this.memoryService = memoryService;
        this.intentClassifier = new IntentClassifierService();
        this.contentMatcher = new ContentMatcherService();
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

            case "request_free_content":
                await this.handleFreeContentRequest(ctx, userId, userMessage, sentContentUrls);
                break;

            case "request_paid_content":
            case "open_packages":
                await this.handlePaidContentRequest(ctx, userId, userMessage);
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

        // Get AI response for greeting
        const response = await this.openaiService.getChatCompletion(persona, messagesToSend);

        console.log(`[${userId}] Jessica: ${response}`);

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

    async handleFreeContentRequest(ctx, userId, userMessage, sentContentUrls) {
        try {
            // Ask user: Free or Paid?
            const botReply = "What would you like babe? 💕";
            await ctx.reply(botReply, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🆓 Free Content", callback_data: `content_free_${userId}` },
                            { text: "💎 Paid Packages", callback_data: `content_paid_${userId}` }
                        ]
                    ]
                }
            });
            await FirebaseService.saveChatMessage(userId, "assistant", botReply);

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
                await ctx.editMessageText("You've already seen all my free content babe! 💕 Want to see my exclusive stuff? 😘");
                await this.openMiniApp(ctx, userId);
                return;
            }

            // Ask: Photo or Video?
            const freePhotos = unsentFreeContent.filter(c => c.type === 'photo');
            const freeVideos = unsentFreeContent.filter(c => c.type === 'video');

            const buttons = [];
            if (freePhotos.length > 0) {
                buttons.push({ text: "📸 Photo", callback_data: `type_photo_${userId}` });
            }
            if (freeVideos.length > 0) {
                buttons.push({ text: "🎥 Video", callback_data: `type_video_${userId}` });
            }

            if (buttons.length === 0) {
                await ctx.editMessageText("No free content available babe! Check out my packages! 💕");
                await this.openMiniApp(ctx, userId);
                return;
            }

            await ctx.editMessageText("What type do you want? 😘", {
                reply_markup: {
                    inline_keyboard: [buttons]
                }
            });

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
                await ctx.editMessageText(`No free ${type}s left babe! 💕 Want to see my paid packages? 😘`);
                await this.openMiniApp(ctx, userId);
                return;
            }

            // Send ONLY 1 random item
            const randomContent = unsentFreeContent[Math.floor(Math.random() * unsentFreeContent.length)];

            await ctx.editMessageText("Here you go babe! 😍💕");
            await this.sendContent(ctx, userId, randomContent);

        } catch (error) {
            console.error(`[${userId}] Error handling type selection:`, error);
            await ctx.reply("Sorry babe, something went wrong... try again? 😅");
        }
    }

    async handlePaidContentRequest(ctx, userId, userMessage) {
        const botReply = "I have so much exclusive content for you babe! 💕✨ Check out my packages below!";
        await ctx.reply(botReply);
        await FirebaseService.saveChatMessage(userId, "assistant", botReply);
        await this.openMiniApp(ctx, userId);
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

    async handleAIResponse(ctx, userId, userMessage) {
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

        console.log(`[${userId}] 📊 Using ${messagesToSend.length} messages for context`);

        const response = await this.openaiService.getChatCompletion(persona, messagesToSend);

        console.log(`[${userId}] Jessica: ${response}`);

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
