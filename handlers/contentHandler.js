const FirebaseService = require("../services/firebaseService");
const { randomDelay } = require("../utils/helpers");
const { MINI_APP_URL } = require("../config");

class ContentHandler {
    static async handleContentRequest(ctx, userId, userMessage) {
        try {
            // Get all content from Firebase
            const allContent = await FirebaseService.getAllContent();

            // Get already sent content URLs for this user from chat history
            const sentContentUrls = await FirebaseService.getUserSentContentUrls(userId);

            // Check for free content first
            const freeContent = allContent.filter(c => c.isFree === true);

            // Filter out already sent free content
            const unsentFreeContent = freeContent.filter(c => !sentContentUrls.has(c.fileUrl));

            if (unsentFreeContent.length > 0) {
                // Send random free content that hasn't been sent yet
                const randomFree = unsentFreeContent[Math.floor(Math.random() * unsentFreeContent.length)];
                await ContentHandler.sendContent(ctx, userId, randomFree);
                return;
            } else if (freeContent.length > 0 && unsentFreeContent.length === 0) {
                // All free content has been sent, open mini app for paid content
                console.log(`[${userId}] ℹ️ All free content already sent to user, opening mini app`);
                await ContentHandler.openMiniApp(ctx, userId);
                return;
            }

            // No free content, open mini app for paid content
            await ContentHandler.openMiniApp(ctx, userId);

        } catch (e) {
            console.error("Error handling content request:", e);
            const errorReply = "Sorry babe, something went wrong... try again? 😅";
            await ctx.reply(errorReply);
        }
    }

    static async openMiniApp(ctx, userId) {
        const botReply = "Hey babe! 💕 Want to see my exclusive content? Open the mini app below to browse and purchase with Stars! ⭐";
        await ctx.reply(botReply);
        await FirebaseService.saveChatMessage(userId, "assistant", botReply);

        await randomDelay();

        // Send message with Web App button
        await ctx.reply("Tap the button below to open the store! 🛍️", {
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

        // Also save the mini app message
        await FirebaseService.saveChatMessage(userId, "assistant", "Sent mini app link");
    }

    static async handlePaidContentRequest(ctx, userId, userMessage, allContent) {
        // Open mini app for paid content instead of listing
        await ContentHandler.openMiniApp(ctx, userId);
    }

    static async sendContent(ctx, userId, content, businessConnectionId = null) {
        const botReply = "Here's something special just for you babe! 😍💕";
        await ctx.reply(botReply);
        await FirebaseService.saveChatMessage(userId, "assistant", botReply);

        await randomDelay();

        // If content is paid (not free), send as paid media
        if (!content.isFree && content.price > 0) {
            await ContentHandler.sendPaidMedia(ctx, userId, content, businessConnectionId);
        } else {
            // Send free content normally
            if (content.type === "video") {
                await ctx.replyWithVideo(content.fileUrl, {
                    caption: content.title || "Just for you 😘"
                });

                await FirebaseService.saveChatMessage(userId, "assistant", content.title || "Sent video", {
                    fileUrl: content.fileUrl,
                    mediaType: "video",
                    type: "video"
                });
            } else {
                await ctx.replyWithPhoto(content.fileUrl, {
                    caption: content.title || "Just for you 😘"
                });

                await FirebaseService.saveChatMessage(userId, "assistant", content.title || "Sent photo", {
                    fileUrl: content.fileUrl,
                    mediaType: "photo",
                    type: "photo"
                });
            }
        }
    }

    static async sendPaidMedia(ctx, userId, content, businessConnectionId = null) {
        try {
            const chatId = ctx.chat?.id || ctx.message?.chat?.id || ctx.update?.business_message?.chat?.id;

            if (!chatId) {
                console.error(`[${userId}] No chat ID found for paid media`);
                return;
            }

            // Prepare media array
            const media = [{
                type: content.type === "video" ? "video" : "photo",
                media: content.fileUrl
            }];

            const options = {
                caption: content.title || "Unlock to see! 😘",
            };

            // Add business_connection_id if this is a business message
            if (businessConnectionId) {
                options.business_connection_id = businessConnectionId;
            }

            // Send paid media using telegram API
            // Use callApi as sendPaidMedia might not be directly available
            try {
                await ctx.telegram.callApi('sendPaidMedia', {
                    chat_id: chatId,
                    star_count: content.price,
                    media: media,
                    ...options
                });
            } catch (apiError) {
                // If callApi fails, try direct method if available
                if (typeof ctx.telegram.sendPaidMedia === 'function') {
                    await ctx.telegram.sendPaidMedia(
                        chatId,
                        content.price,
                        media,
                        options
                    );
                } else {
                    throw apiError;
                }
            }

            console.log(`[${userId}] 💰 Sent paid media: ${content.title} for ${content.price} stars`);

            await FirebaseService.saveChatMessage(userId, "assistant", `Sent paid ${content.type}: ${content.title}`, {
                fileUrl: content.fileUrl,
                mediaType: content.type,
                type: content.type,
                price: content.price,
                isPaidMedia: true
            });

        } catch (error) {
            console.error(`[${userId}] Error sending paid media:`, error);
            await ctx.reply("Sorry babe, there was an issue sending that content... try again? 😅");
        }
    }

    static async sendContentInvoice(ctx, userId, content, contentListMessage = null) {
        const prefix = contentListMessage ? `${contentListMessage}\n\n` : "";
        const botReply = `${prefix}I'll send you "${content.title || (content.type === "video" ? "Video" : "Photo")}" for ${content.price} Stars. Tap the invoice below! 💕`;
        await ctx.reply(botReply);
        await FirebaseService.saveChatMessage(userId, "assistant", botReply);

        await randomDelay();

        await ctx.replyWithInvoice({
            title: content.title || (content.type === "video" ? "Video" : "Photo"),
            description: `Premium ${content.type} - ${content.price} Stars`,
            payload: `content_${content.id}_${userId}`,
            currency: "XTR",
            prices: [{ label: content.title || "Content", amount: content.price }],
            provider_token: "" // Empty for Stars
        });
    }
}

module.exports = ContentHandler;
