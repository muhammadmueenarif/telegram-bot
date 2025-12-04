const FirebaseService = require("../services/firebaseService");
const { randomDelay } = require("../utils/helpers");

class PaymentHandler {
    static async handlePreCheckout(ctx) {
        ctx.answerPreCheckoutQuery(true);
    }

    static async handleSuccessfulPayment(ctx, bot) {
        const payload = ctx.message.successful_payment.invoice_payload;
        const userId = ctx.from.id;
        const amount = ctx.message.successful_payment.total_amount; // In Stars

        console.log(`[${userId}] 💰 Payment received: ${amount} Stars, Payload: ${payload}`);

        // Record transaction
        await FirebaseService.recordTransaction(userId, amount, payload);

        // Handle package payment (NEW)
        if (payload.startsWith("package_")) {
            await PaymentHandler.handlePackagePayment(ctx, userId, amount, payload);
        }

        // Handle custom video payment
        else if (payload.startsWith("custom_video_")) {
            await PaymentHandler.handleCustomVideoPayment(ctx, userId, amount, bot);
        }

        // Handle content payment
        else if (payload.startsWith("content_")) {
            await PaymentHandler.handleContentPayment(ctx, userId, amount);
        }

        // Handle legacy photo payment
        else if (payload === "photo_set_1") {
            await PaymentHandler.handleLegacyPayment(ctx);
        }
    }

    static async handlePackagePayment(ctx, userId, amount, payload) {
        try {
            // Extract package ID from payload (format: package_{packageId}_{userId})
            const payloadParts = payload.split("_");
            const packageId = payloadParts.length >= 2 ? payloadParts[1] : null;

            if (!packageId) {
                console.error(`[${userId}] ❌ Invalid package payload: ${payload}`);
                await ctx.reply("Thank you babe! 💕 Let me send you your content...");
                return;
            }

            // Get package details
            const packageData = await FirebaseService.getPackageById(packageId);

            if (!packageData) {
                console.error(`[${userId}] ❌ Package not found: ${packageId}`);
                await ctx.reply("Thank you babe! 💕 Let me send you your content...");
                return;
            }

            console.log(`[${userId}] 📦 Delivering package: ${packageData.stars} Stars`);

            // Thank you message
            await ctx.reply(`Omg thank you so much babe! 💖✨\n\nYou got ${packageData.stars} Stars! Here's what's included...`);
            await randomDelay();

            // Get available content from Firebase
            const allContent = await FirebaseService.getAllContent();
            const sentContentUrls = await FirebaseService.getUserSentContentUrls(userId);

            // Filter for content that hasn't been sent yet
            const availableContent = allContent.filter(c => !sentContentUrls.has(c.fileUrl));

            // Determine how many pieces of content to send based on package
            let contentCount = 1;
            if (packageData.stars >= 100) contentCount = 5;
            else if (packageData.stars >= 50) contentCount = 3;
            else if (packageData.stars >= 25) contentCount = 2;

            console.log(`[${userId}] 📤 Sending ${contentCount} pieces of content`);

            // Send content
            const contentToSend = availableContent.slice(0, contentCount);

            if (contentToSend.length === 0) {
                await ctx.reply("I'll create some exclusive content just for you babe! 😘 Check back soon!");
                return;
            }

            for (const content of contentToSend) {
                await randomDelay();

                if (content.type === "video") {
                    await ctx.replyWithVideo(content.fileUrl, {
                        caption: content.title || "Just for you babe 😘"
                    });

                    await FirebaseService.saveChatMessage(userId, "assistant", content.title || "Sent video", {
                        fileUrl: content.fileUrl,
                        mediaType: "video",
                        type: "video"
                    });
                } else {
                    await ctx.replyWithPhoto(content.fileUrl, {
                        caption: content.title || "Just for you babe 😘"
                    });

                    await FirebaseService.saveChatMessage(userId, "assistant", content.title || "Sent photo", {
                        fileUrl: content.fileUrl,
                        mediaType: "photo",
                        type: "photo"
                    });
                }
            }

            // Final message
            await randomDelay();
            await ctx.reply("Hope you love them babe! 💕 Want more? Just let me know! 😉");

        } catch (error) {
            console.error(`[${userId}] ❌ Error handling package payment:`, error);
            await ctx.reply("Thank you babe! 💕 Something went wrong but I'll make it right!");
        }
    }

    static async handleCustomVideoPayment(ctx, userId, amount, bot) {
        await ctx.reply("Omg thank you babe! 💖 Here's your special video...");
        await randomDelay();

        // Extract video ID from payload (format: custom_video_{videoId}_{userId})
        const payloadParts = payload.split("_");
        const videoId = payloadParts.length >= 4 ? payloadParts[2] : null;

        const purchasedVideo = await FirebaseService.getContentById(videoId, "base_videos");

        if (purchasedVideo) {
            await ctx.replyWithVideo(purchasedVideo.fileUrl, {
                caption: purchasedVideo.title || "Just for you 😘"
            });

            // Save video info to chat
            await FirebaseService.saveChatMessage(userId, "assistant", purchasedVideo.title || "Sent video", {
                fileUrl: purchasedVideo.fileUrl,
                mediaType: "video",
                type: "video"
            });

            // Save bot reply
            await FirebaseService.saveChatMessage(userId, "assistant", "Omg thank you babe! 💖 Here's your special video...");

            // Update custom video request status to "paid"
            await FirebaseService.updateCustomVideoRequestStatus(userId, amount);
        } else {
            // Fallback: send random video
            await PaymentHandler.sendRandomVideo(ctx, userId, amount);
        }
    }

    static async handleContentPayment(ctx, userId, amount) {
        await ctx.reply("Omg thank you babe! 💖 Here's your special content...");
        await randomDelay();

        // Extract content ID from payload (format: content_{contentId}_{userId})
        const payloadParts = payload.split("_");
        const contentId = payloadParts.length >= 2 ? payloadParts[1] : null;

        const purchasedContent = await FirebaseService.getContentById(contentId, "content");

        if (purchasedContent) {
            if (purchasedContent.type === "video") {
                await ctx.replyWithVideo(purchasedContent.fileUrl, {
                    caption: purchasedContent.title || "Just for you 😘"
                });

                await FirebaseService.saveChatMessage(userId, "assistant", purchasedContent.title || "Sent video", {
                    fileUrl: purchasedContent.fileUrl,
                    mediaType: "video",
                    type: "video"
                });
            } else {
                await ctx.replyWithPhoto(purchasedContent.fileUrl, {
                    caption: purchasedContent.title || "Just for you 😘"
                });

                await FirebaseService.saveChatMessage(userId, "assistant", purchasedContent.title || "Sent photo", {
                    fileUrl: purchasedContent.fileUrl,
                    mediaType: "photo",
                    type: "photo"
                });
            }

            // Save bot reply
            await FirebaseService.saveChatMessage(userId, "assistant", "Omg thank you babe! 💖 Here's your special content...");
        } else {
            // Fallback: send random content
            await PaymentHandler.sendRandomContent(ctx, userId, amount);
        }
    }

    static async handleLegacyPayment(ctx) {
        await ctx.reply("Omg thank you babe! 💖 Here are the photos I promised...");
        await randomDelay();
        await ctx.replyWithPhoto("https://picsum.photos/400/600", { caption: "Just for you 😘" });
    }

    static async sendRandomVideo(ctx, userId, amount) {
        const allVideos = await FirebaseService.getAllBaseVideos();
        const paidVideos = allVideos.filter(v => !v.isFree && v.price > 0);

        if (paidVideos.length > 0) {
            const randomVideo = paidVideos[Math.floor(Math.random() * paidVideos.length)];
            await ctx.replyWithVideo(randomVideo.fileUrl, {
                caption: randomVideo.title || "Just for you 😘"
            });

            await FirebaseService.saveChatMessage(userId, "assistant", randomVideo.title || "Sent video", {
                fileUrl: randomVideo.fileUrl,
                mediaType: "video",
                type: "video"
            });

            await FirebaseService.saveChatMessage(userId, "assistant", "Omg thank you babe! 💖 Here's your special video...");
        } else {
            await ctx.reply("I'll make you the most special custom video... give me a bit to create it just for you 😘");
        }

        await FirebaseService.updateCustomVideoRequestStatus(userId, amount);
    }

    static async sendRandomContent(ctx, userId, amount) {
        const allContent = await FirebaseService.getAllContent();
        const paidContent = allContent.filter(c => !c.isFree && c.price > 0);

        if (paidContent.length > 0) {
            const randomContent = paidContent[Math.floor(Math.random() * paidContent.length)];

            if (randomContent.type === "video") {
                await ctx.replyWithVideo(randomContent.fileUrl, {
                    caption: randomContent.title || "Just for you 😘"
                });

                await FirebaseService.saveChatMessage(userId, "assistant", randomContent.title || "Sent video", {
                    fileUrl: randomContent.fileUrl,
                    mediaType: "video",
                    type: "video"
                });
            } else {
                await ctx.replyWithPhoto(randomContent.fileUrl, {
                    caption: randomContent.title || "Just for you 😘"
                });

                await FirebaseService.saveChatMessage(userId, "assistant", randomContent.title || "Sent photo", {
                    fileUrl: randomContent.fileUrl,
                    mediaType: "photo",
                    type: "photo"
                });
            }

            await FirebaseService.saveChatMessage(userId, "assistant", "Omg thank you babe! 💖 Here's your special content...");
        } else {
            await ctx.reply("I'll send you something special... give me a sec! 😘");
        }
    }
}

module.exports = PaymentHandler;
