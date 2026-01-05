const { Telegraf } = require("telegraf");
const { BOT_CONFIG } = require("./utils/constants");
const StartHandler = require("./handlers/startHandler");
const PaymentHandler = require("./handlers/paymentHandler");
const TextHandler = require("./handlers/textHandler");
const OpenAIService = require("./services/openaiService");
const MemoryService = require("./services/memoryService");
const { randomDelay } = require("./utils/helpers");
const fs = require("fs");
const https = require("https");
const path = require("path");
const os = require("os");

class Bot {
    constructor(botToken, openaiApiKey) {
        this.bot = new Telegraf(botToken, {
            telegram: {
                timeout: BOT_CONFIG.timeout,
                retryAfter: BOT_CONFIG.retryAfter,
            }
        });

        this.openaiService = new OpenAIService(openaiApiKey);
        this.memoryService = new MemoryService();
        this.textHandler = new TextHandler(this.openaiService, this.memoryService);

        this.setupHandlers();
        this.setupErrorHandling();
    }

    setupHandlers() {
        // Start command
        this.bot.start(StartHandler.handle);

        // Payment handlers
        this.bot.on("pre_checkout_query", PaymentHandler.handlePreCheckout);
        this.bot.on("successful_payment", (ctx) => PaymentHandler.handleSuccessfulPayment(ctx, this.bot));

        // Paid media purchase handler
        this.bot.on("purchased_paid_media", async (ctx) => {
            try {
                const userId = ctx.from?.id;
                const paidMediaInfo = ctx.update.purchased_paid_media;

                console.log(`[${userId}] 💰 User purchased paid media:`, paidMediaInfo);

                // Optional: Send thank you message
                await ctx.reply("Thanks for your purchase babe! 😘💕 Enjoy the content!");

            } catch (error) {
                console.error("Error handling purchased paid media:", error);
            }
        });

        // Telegram Business handlers
        this.bot.on("business_connection", async (ctx) => {
            try {
                // Business connection is in ctx.update.business_connection
                const connection = ctx.update.business_connection;
                if (!connection) {
                    console.log("[Business] Warning: business_connection is undefined");
                    return;
                }

                const userId = connection.user.id;
                const isActive = connection.is_enabled;

                console.log(`[Business] ${isActive ? '✅ Connected' : '❌ Disconnected'} - User: ${userId}, Connection ID: ${connection.id}`);

                if (isActive) {
                    console.log(`[Business] User ${userId} connected bot to their business account`);
                } else {
                    console.log(`[Business] User ${userId} disconnected bot from their business account`);
                }
            } catch (error) {
                console.error("Error handling business connection:", error);
            }
        });

        this.bot.on("business_message", async (ctx) => {
            try {
                // Business message is in ctx.update.business_message
                const businessMessage = ctx.update.business_message;
                if (!businessMessage) {
                    console.log("[Business Message] Warning: business_message is undefined");
                    return;
                }

                const businessConnectionId = businessMessage.business_connection_id;
                const userId = businessMessage.from.id;
                const text = businessMessage.text;

                console.log(`[Business Message] From: ${userId}, Text: ${text}, Connection: ${businessConnectionId}`);

                // Handle business message the same way as regular text messages
                // but use the business_connection_id when replying
                if (text) {
                    // Create a fake context object that mimics regular message context
                    // so we can use textHandler which has all the content sending logic
                    const fakeCtx = {
                        ...ctx,
                        from: businessMessage.from,
                        message: {
                            text: text,
                            from: businessMessage.from,
                            chat: businessMessage.chat,
                            message_id: businessMessage.message_id
                        },
                        chat: businessMessage.chat,
                        business_connection_id: businessConnectionId,
                        update: {
                            ...ctx.update,
                            business_message: businessMessage
                        },
                        reply: async (text, extra = {}) => {
                            return ctx.telegram.sendMessage(businessMessage.chat.id, text, {
                                business_connection_id: businessConnectionId,
                                ...extra
                            });
                        },
                        replyWithPhoto: async (photo, extra = {}) => {
                            return ctx.telegram.sendPhoto(businessMessage.chat.id, photo, {
                                business_connection_id: businessConnectionId,
                                ...extra
                            });
                        },
                        replyWithVideo: async (video, extra = {}) => {
                            return ctx.telegram.sendVideo(businessMessage.chat.id, video, {
                                business_connection_id: businessConnectionId,
                                ...extra
                            });
                        },
                        sendChatAction: async (action) => {
                            return ctx.telegram.sendChatAction(businessMessage.chat.id, action, {
                                business_connection_id: businessConnectionId
                            });
                        },
                        telegram: ctx.telegram
                    };

                    // Use textHandler to process the message (includes content detection and sending)
                    await this.textHandler.handleTextMessage(fakeCtx);
                }
            } catch (error) {
                console.error("Error handling business message:", error);
            }
        });

        // Text messages
        this.bot.on("text", (ctx) => this.textHandler.handleTextMessage(ctx));

        // Voice message handler - must come before generic message handler
        this.bot.on("voice", async (ctx) => {
            try {
                const userId = ctx.from.id;
                const voice = ctx.message.voice;
                const duration = voice.duration; // in seconds

                console.log(`[${userId}] 🎤 Voice message received (${duration}s)`);

                // If voice note is less than 60 seconds, transcribe and reply with text
                if (duration < 60) {
                    await ctx.sendChatAction("typing");

                    try {
                        // Download the voice file
                        const fileLink = await ctx.telegram.getFileLink(voice.file_id);

                        // Download to temp file
                        const tempFilePath = path.join(os.tmpdir(), `voice_${userId}_${Date.now()}.ogg`);
                        const fileStream = fs.createWriteStream(tempFilePath);

                        await new Promise((resolve, reject) => {
                            https.get(fileLink.href, (response) => {
                                response.pipe(fileStream);
                                fileStream.on('finish', () => {
                                    fileStream.close();
                                    resolve();
                                });
                            }).on('error', reject);
                        });

                        console.log(`[${userId}] 📥 Voice file downloaded, transcribing...`);

                        // Transcribe using Whisper
                        const transcription = await this.openaiService.transcribeAudio(
                            fs.createReadStream(tempFilePath)
                        );

                        console.log(`[${userId}] 📝 Transcription: ${transcription}`);

                        // Clean up temp file
                        fs.unlinkSync(tempFilePath);

                        // Save transcription to Firebase as user message
                        const FirebaseService = require("./services/firebaseService");
                        await FirebaseService.saveChatMessage(userId, "user", `[Voice message] ${transcription}`);

                        // Load conversation history
                        if (!this.memoryService.userMemoryLoaded[userId] || !this.memoryService.userMemory[userId] || this.memoryService.userMemory[userId].length === 0) {
                            await this.memoryService.loadUserHistory(userId, FirebaseService);
                        }
                        this.memoryService.initializeUser(userId);

                        // Add user message to memory
                        this.memoryService.addMessage(userId, "user", transcription);

                        // Get AI response
                        const { getPersona } = require("./utils/constants");
                        const persona = getPersona();
                        const messagesToSend = this.memoryService.getMessagesWithinLimit(userId, persona);

                        const textResponse = await this.openaiService.getChatCompletion(persona, messagesToSend);

                        // Add polite message encouraging text chat
                        const fullResponse = `${textResponse}\n\nBut babe, I'd love it if you could text me instead! It's so much easier to chat that way 💕`;

                        console.log(`[${userId}] 🤖 Text response: ${fullResponse}`);

                        // Convert response to speech
                        console.log(`[${userId}] 🎙️ Converting to speech...`);
                        const audioBuffer = await this.openaiService.textToSpeech(fullResponse);

                        // Save audio to temp file
                        const outputPath = path.join(os.tmpdir(), `response_${userId}_${Date.now()}.mp3`);
                        fs.writeFileSync(outputPath, audioBuffer);

                        console.log(`[${userId}] 🎵 Sending voice response...`);

                        // Send voice message
                        await ctx.replyWithVoice({ source: fs.createReadStream(outputPath) });

                        // Save response to memory and Firebase
                        this.memoryService.addMessage(userId, "assistant", textResponse);
                        await FirebaseService.saveChatMessage(userId, "assistant", `[Voice reply] ${textResponse}`);

                        // Clean up temp audio file
                        fs.unlinkSync(outputPath);

                    } catch (transcriptionError) {
                        console.error(`[${userId}] Error transcribing voice:`, transcriptionError);
                        // Fallback to sending ring.mp3
                        const audioPath = "/Volumes/myexternal/TelegramsAiBot/ring.mp3";
                        await ctx.replyWithVoice({ source: fs.createReadStream(audioPath) });
                    }
                } else {
                    // Voice note is 60+ seconds, just send ring.mp3
                    console.log(`[${userId}] Voice too long (${duration}s), sending ring.mp3`);
                    const audioPath = "/Volumes/myexternal/TelegramsAiBot/ring.mp3";
                    await ctx.replyWithVoice({ source: fs.createReadStream(audioPath) });
                }
            } catch (error) {
                console.error("Error handling voice:", error);
            }
        });

        // Photo handler - must come before generic message handler
        this.bot.on("photo", async (ctx) => {
            try {
                const userId = ctx.from.id;
                const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Get highest resolution
                const caption = ctx.message.caption || "";

                console.log(`[${userId}] 📸 ===== PHOTO HANDLER TRIGGERED =====`);
                console.log(`[${userId}] 📸 Photo received${caption ? ` with caption: ${caption}` : ''}`);

                await ctx.sendChatAction("typing");

                try {
                    // Get photo file link
                    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                    console.log(`[${userId}] 🔍 Analyzing image...`);

                    // Analyze image with OpenAI Vision
                    const prompt = caption
                        ? `The user sent you this image with the message: "${caption}". Respond naturally as Nyla, acknowledging both the image and their message.`
                        : "Describe what you see in this image and respond naturally as Nyla.";

                    const imageAnalysis = await this.openaiService.analyzeImage(fileLink.href, prompt);

                    console.log(`[${userId}] 🤖 Vision analysis: ${imageAnalysis}`);

                    // Save to Firebase
                    const FirebaseService = require("./services/firebaseService");
                    await FirebaseService.saveChatMessage(userId, "user", caption ? `[Photo] ${caption}` : "[Photo sent]");

                    // Use the image analysis to generate a contextual response
                    const fakeTextCtx = {
                        ...ctx,
                        from: ctx.from,
                        message: {
                            message_id: ctx.message.message_id,
                            from: ctx.from,
                            chat: ctx.message.chat,
                            date: ctx.message.date,
                            text: `[User sent a photo${caption ? ` with caption: "${caption}"` : ''}. Image contains: ${imageAnalysis}]`
                        },
                        sendChatAction: ctx.sendChatAction.bind(ctx),
                        reply: ctx.reply.bind(ctx),
                        replyWithPhoto: ctx.replyWithPhoto.bind(ctx),
                        replyWithVideo: ctx.replyWithVideo.bind(ctx)
                    };

                    await this.textHandler.handleTextMessage(fakeTextCtx);

                } catch (visionError) {
                    console.error(`[${userId}] Error analyzing image:`, visionError);
                    // Fallback to simple response
                    await randomDelay();
                    await ctx.reply("Omg you're so cute! 😍 Send more?");
                }
            } catch (error) {
                console.error("Error handling photo:", error);
            }
        });

        // Document handler (for files sent via attachment button) - must come before generic message handler
        this.bot.on("document", async (ctx) => {
            try {
                const userId = ctx.from.id;
                const document = ctx.message.document;
                const mimeType = document.mime_type || "";
                const caption = ctx.message.caption || "";

                console.log(`[${userId}] 📎 ===== DOCUMENT HANDLER TRIGGERED =====`);
                console.log(`[${userId}] 📎 Document received: ${document.file_name} (${mimeType})`);

                // Check if it's an image
                if (mimeType.startsWith("image/")) {
                    console.log(`[${userId}] 📸 Document is an image, analyzing...`);

                    await ctx.sendChatAction("typing");

                    try {
                        // Get document file link
                        const fileLink = await ctx.telegram.getFileLink(document.file_id);
                        console.log(`[${userId}] 🔍 Analyzing image document...`);

                        // Analyze image with OpenAI Vision
                        const prompt = caption
                            ? `The user sent you this image with the message: "${caption}". Respond naturally as Nyla, acknowledging both the image and their message.`
                            : "Describe what you see in this image and respond naturally as Nyla.";

                        const imageAnalysis = await this.openaiService.analyzeImage(fileLink.href, prompt);

                        console.log(`[${userId}] 🤖 Vision analysis: ${imageAnalysis}`);

                        // Save to Firebase
                        const FirebaseService = require("./services/firebaseService");
                        await FirebaseService.saveChatMessage(userId, "user", caption ? `[Image file] ${caption}` : "[Image file sent]");

                        // Use the image analysis to generate a contextual response
                        const fakeTextCtx = {
                            ...ctx,
                            from: ctx.from,
                            message: {
                                message_id: ctx.message.message_id,
                                from: ctx.from,
                                chat: ctx.message.chat,
                                date: ctx.message.date,
                                text: `[User sent an image${caption ? ` with caption: "${caption}"` : ''}. Image contains: ${imageAnalysis}]`
                            },
                            sendChatAction: ctx.sendChatAction.bind(ctx),
                            reply: ctx.reply.bind(ctx),
                            replyWithPhoto: ctx.replyWithPhoto.bind(ctx),
                            replyWithVideo: ctx.replyWithVideo.bind(ctx)
                        };

                        await this.textHandler.handleTextMessage(fakeTextCtx);

                    } catch (visionError) {
                        console.error(`[${userId}] Error analyzing image document:`, visionError);
                        // Fallback to simple response
                        await randomDelay();
                        await ctx.reply("Omg you're so cute! 😍 Send more?");
                    }
                } else {
                    // Not an image, just acknowledge
                    console.log(`[${userId}] 📄 Non-image document, sending simple response`);
                    await ctx.sendChatAction("typing");
                    await randomDelay();
                    await ctx.reply("Thanks for sending that babe! 💕");
                }
            } catch (error) {
                console.error("Error handling document:", error);
            }
        });

        // Sticker handler
        this.bot.on("sticker", async (ctx) => {
            await ctx.sendChatAction("typing");
            await randomDelay();
            await ctx.reply("Haha I love that 😂💕");
        });

        // Audio file handler (MP3, etc.)
        this.bot.on("audio", async (ctx) => {
            try {
                console.log(`[${ctx.from.id}] 🎵 Audio file received, sending ring.mp3`);
                const audioPath = "/Volumes/myexternal/TelegramsAiBot/ring.mp3";
                await ctx.replyWithVoice({ source: fs.createReadStream(audioPath) });
            } catch (error) {
                console.error("Error sending voice:", error);
            }
        });

        // Video file handler
        this.bot.on("video", async (ctx) => {
            try {
                console.log(`[${ctx.from.id}] 🎥 Video file received, sending ring.mp3`);
                const audioPath = "/Volumes/myexternal/TelegramsAiBot/ring.mp3";
                await ctx.replyWithVoice({ source: fs.createReadStream(audioPath) });
            } catch (error) {
                console.error("Error sending voice:", error);
            }
        });

        // Handle mini app data (when user selects package in mini app)
        // Telegram sends this as a normal message with `web_app_data` field
        this.bot.on("message", async (ctx) => {
            try {
                // Debug: Log what type of message we received
                if (ctx.message) {
                    const messageTypes = [];
                    if (ctx.message.text) messageTypes.push('text');
                    if (ctx.message.photo) messageTypes.push('photo');
                    if (ctx.message.voice) messageTypes.push('voice');
                    if (ctx.message.audio) messageTypes.push('audio');
                    if (ctx.message.video) messageTypes.push('video');
                    if (ctx.message.document) messageTypes.push('document');
                    if (ctx.message.sticker) messageTypes.push('sticker');
                    if (ctx.message.web_app_data) messageTypes.push('web_app_data');

                    if (messageTypes.length > 0 && !messageTypes.includes('web_app_data')) {
                        console.log(`[${ctx.from.id}] 📨 Generic message handler caught: ${messageTypes.join(', ')}`);
                    }
                }

                const webAppData = ctx.message && ctx.message.web_app_data;
                if (!webAppData || !webAppData.data) {
                    return; // Not from mini app, ignore
                }

                const data = JSON.parse(webAppData.data);
                console.log(`[${ctx.from.id}] ✅ Mini app data received:`, data);

                // Handle package purchase from mini app
                if (data.packageId && data.stars) {
                    const userId = ctx.from.id;

                    // Get package details from Firebase to ensure accuracy
                    const FirebaseService = require("./services/firebaseService");
                    const packageData = await FirebaseService.getPackageById(data.packageId);

                    if (!packageData) {
                        console.error(`[${userId}] ❌ Package not found: ${data.packageId}`);
                        await ctx.reply("Sorry babe, I couldn't find that package... try again? 😅");
                        return;
                    }

                    console.log(`[${userId}] 📦 Package found:`, packageData);

                    // Send acknowledgment message
                    const botReply = `Perfect choice babe! 💕 You selected the ${packageData.stars} Stars package!\n\nTap the invoice below to complete your purchase! ⭐`;
                    await ctx.reply(botReply);
                    await FirebaseService.saveChatMessage(userId, "assistant", botReply);

                    // Small delay for better UX
                    await randomDelay();

                    // Send Stars invoice
                    await ctx.replyWithInvoice({
                        title: `${packageData.stars} Stars Package`,
                        description: packageData.includes || `${packageData.stars} Telegram Stars`,
                        payload: `package_${data.packageId}_${userId}`,
                        currency: "XTR", // Telegram Stars currency
                        prices: [{
                            label: `${packageData.stars} Stars`,
                            amount: packageData.stars // Amount in Stars
                        }],
                        provider_token: "" // Empty for Stars
                    });

                    console.log(`[${userId}] 💳 Invoice sent: ${packageData.stars} Stars`);
                }
            } catch (error) {
                console.error("Error handling mini app data:", error);
                await ctx.reply("Sorry babe, something went wrong with the mini app... try again? 😅");
            }
        });
    }

    setupErrorHandling() {
        // Handle connection errors
        this.bot.catch((err, ctx) => {
            console.error("Bot error:", err);
        });

        // Handle uncaught errors
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
        });
    }

    async launch() {
        let retries = 0;
        const maxRetries = 5;
        const retryDelay = 5000; // 5 seconds

        while (retries < maxRetries) {
            try {
                console.log(`🔄 Attempting to start bot... (Attempt ${retries + 1}/${maxRetries})`);

                // Before launching, ensure no webhook is set and close any existing polling
                try {
                    await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
                    console.log("🧹 Cleaned up any existing webhook");
                } catch (webhookError) {
                    // Ignore webhook errors, might not have one set
                    console.log("ℹ️ No webhook to clean up (this is fine)");
                }

                // If this is a retry after a 409 error, wait a bit longer to let the other instance finish
                if (retries > 0) {
                    const extendedDelay = retryDelay * 2; // Wait 10 seconds for 409 conflicts
                    console.log(`⏳ Waiting ${extendedDelay / 1000} seconds for any existing connection to close...`);
                    await new Promise(resolve => setTimeout(resolve, extendedDelay));
                }

                await this.bot.launch({
                    polling: BOT_CONFIG.polling
                });

                console.log("✅ Nyla bot is running...");
                console.log("Bot: @Nyla_testing_bot");
                break; // Success, exit retry loop

            } catch (error) {
                retries++;
                const isConflictError = error.message && (
                    error.message.includes('409') || 
                    error.message.includes('Conflict') ||
                    error.message.includes('terminated by other getUpdates')
                );

                if (isConflictError) {
                    console.error(`❌ Error starting bot (Attempt ${retries}/${maxRetries}): 409 Conflict - Another bot instance is running`);
                    console.error("💡 Solution: Make sure only ONE instance of the bot is running.");
                    console.error("   - Check for other terminal windows running the bot");
                    console.error("   - Check for background processes: ps aux | grep node");
                    console.error("   - Kill any existing instances before starting a new one");
                } else {
                    console.error(`❌ Error starting bot (Attempt ${retries}/${maxRetries}):`, error.message);
                }

                if (retries >= maxRetries) {
                    console.error("❌ Failed to start bot after multiple attempts. Please check:");
                    if (isConflictError) {
                        console.error("   ⚠️  CONFLICT ERROR: Another bot instance is already running!");
                        console.error("   → Stop all other bot instances and try again");
                        console.error("   → Use: pkill -f 'node.*index.js' or kill the process manually");
                    } else {
                        console.error("   1. Your internet connection");
                        console.error("   2. BOT_TOKEN in .env file is correct");
                        console.error("   3. Telegram API is accessible from your network");
                        console.error("   4. Firewall/proxy settings");
                    }
                    process.exit(1);
                }

                // For conflict errors, wait longer before retrying
                const waitTime = isConflictError ? retryDelay * 2 : retryDelay;
                console.log(`⏳ Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    stop(signal) {
        console.log(`🛑 Bot stopped with signal: ${signal}`);
        this.bot.stop(signal);
    }
}

module.exports = Bot;
