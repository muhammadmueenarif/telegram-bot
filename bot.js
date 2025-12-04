const { Telegraf } = require("telegraf");
const { BOT_CONFIG } = require("./utils/constants");
const StartHandler = require("./handlers/startHandler");
const PaymentHandler = require("./handlers/paymentHandler");
const TextHandler = require("./handlers/textHandler");
const OpenAIService = require("./services/openaiService");
const MemoryService = require("./services/memoryService");
const { randomDelay } = require("./utils/helpers");

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

        // Handle button clicks (callback queries)
        this.bot.on("callback_query", async (ctx) => {
            const data = ctx.callbackQuery.data;
            const userId = ctx.from.id;

            console.log(`[${userId}] Button clicked: ${data}`);

            try {
                // Get user's sent content history
                const FirebaseService = require("./services/firebaseService");
                const sentContentUrls = await FirebaseService.getUserSentContentUrls(userId);

                if (data.startsWith("content_free_")) {
                    // User selected Free Content
                    await ctx.answerCbQuery();
                    await this.textHandler.handleFreeContentSelection(ctx, userId, sentContentUrls);
                } else if (data.startsWith("content_paid_")) {
                    // User selected Paid Packages
                    await ctx.answerCbQuery();
                    await ctx.editMessageText("Let me show you my packages babe! 💕");
                    await this.textHandler.handlePaidContentRequest(ctx, userId, "");
                } else if (data.startsWith("type_photo_")) {
                    // User selected Photo
                    await ctx.answerCbQuery();
                    await this.textHandler.handleTypeSelection(ctx, userId, "photo", sentContentUrls);
                } else if (data.startsWith("type_video_")) {
                    // User selected Video
                    await ctx.answerCbQuery();
                    await this.textHandler.handleTypeSelection(ctx, userId, "video", sentContentUrls);
                }
            } catch (error) {
                console.error(`[${userId}] Error handling callback query:`, error);
                await ctx.answerCbQuery("Something went wrong... try again! 😅");
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

                console.log("✅ Jessica bot is running...");
                console.log("Bot: @Jessica_testing_bot");
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
