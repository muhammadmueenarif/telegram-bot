const { Telegraf } = require("telegraf");
const { BOT_CONFIG } = require("./utils/constants");
const StartHandler = require("./handlers/startHandler");
const PaymentHandler = require("./handlers/paymentHandler");
const TextHandler = require("./handlers/textHandler");
const OpenAIService = require("./services/openaiService");
const MemoryService = require("./services/memoryService");
const { randomDelay } = require("./utils/helpers");
const fs = require("fs");

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
                        const https = require('https');
                        const path = require('path');
                        const os = require('os');

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

                        // Process transcription as text message using text handler
                        const fakeTextCtx = {
                            ...ctx,
                            from: ctx.from,
                            message: {
                                message_id: ctx.message.message_id,
                                from: ctx.from,
                                chat: ctx.message.chat,
                                date: ctx.message.date,
                                text: transcription
                            },
                            sendChatAction: ctx.sendChatAction.bind(ctx),
                            reply: ctx.reply.bind(ctx),
                            replyWithPhoto: ctx.replyWithPhoto.bind(ctx),
                            replyWithVideo: ctx.replyWithVideo.bind(ctx)
                        };

                        await this.textHandler.handleTextMessage(fakeTextCtx);

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

        // Photo handler
        this.bot.on("photo", async (ctx) => {
            await ctx.sendChatAction("typing");
            await randomDelay();
            await ctx.reply("Omg you're so cute! 😍 Send more?");
        });

        // Sticker handler
        this.bot.on("sticker", async (ctx) => {
            await ctx.sendChatAction("typing");
            await randomDelay();
            await ctx.reply("Haha I love that 😂💕");
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

                await this.bot.launch({
                    polling: BOT_CONFIG.polling
                });

                console.log("✅ Nyla bot is running...");
                console.log("Bot: @Nyla_testing_bot");
                break; // Success, exit retry loop

            } catch (error) {
                retries++;
                console.error(`❌ Error starting bot (Attempt ${retries}/${maxRetries}):`, error.message);

                if (retries >= maxRetries) {
                    console.error("❌ Failed to start bot after multiple attempts. Please check:");
                    console.error("   1. Your internet connection");
                    console.error("   2. BOT_TOKEN in .env file is correct");
                    console.error("   3. Telegram API is accessible from your network");
                    console.error("   4. Firewall/proxy settings");
                    process.exit(1);
                }

                console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    stop(signal) {
        console.log(`🛑 Bot stopped with signal: ${signal}`);
        this.bot.stop(signal);
    }
}

module.exports = Bot;
