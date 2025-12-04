const FirebaseService = require("../services/firebaseService");
const { randomDelay } = require("../utils/helpers");

class CustomVideoHandler {
    static async handleCustomVideoRequest(ctx, userId, userMessage) {
        try {
            // Get all base videos from Firebase
            const allVideos = await FirebaseService.getAllBaseVideos();

            // Get already sent video URLs for this user from chat history
            const sentVideoUrls = await FirebaseService.getUserSentContentUrls(userId, "video");

            // Check for free videos first
            const freeVideos = allVideos.filter(v => v.isFree === true);

            // Filter out already sent free videos
            const unsentFreeVideos = freeVideos.filter(v => !sentVideoUrls.has(v.fileUrl));

            if (unsentFreeVideos.length > 0) {
                // Send a random free video that hasn't been sent yet
                const randomFreeVideo = unsentFreeVideos[Math.floor(Math.random() * unsentFreeVideos.length)];
                await CustomVideoHandler.sendVideo(ctx, userId, randomFreeVideo);
                return;
            } else if (freeVideos.length > 0 && unsentFreeVideos.length === 0) {
                // All free videos have been sent, continue to paid video flow
                console.log(`[${userId}] ℹ️ All free videos already sent to user`);
            }

            // No free videos or all free videos already sent, check for paid videos
            await CustomVideoHandler.handlePaidVideoRequest(ctx, userId, userMessage, allVideos);

        } catch (e) {
            console.error("Error handling video request:", e);
            const errorReply = "Sorry babe, something went wrong... try again? 😅";
            await ctx.reply(errorReply);
        }
    }

    static async handlePaidVideoRequest(ctx, userId, userMessage, allVideos) {
        const paidVideos = allVideos.filter(v => !v.isFree && v.price > 0);

        if (paidVideos.length === 0) {
            // No videos available at all
            const botReply = "Sorry babe, I don't have any videos available right now... check back later? 😘";
            await ctx.reply(botReply);
            await FirebaseService.saveChatMessage(userId, "assistant", botReply);
            return;
        }

        // List all available paid videos with titles and prices
        const videoList = paidVideos.map(v => `${v.title || "Video"} for ${v.price} Stars`).join(", ");
        const videoListMessage = `I have ${paidVideos.length === 1 ? 'a video' : 'videos'}: ${videoList}`;

        // If only one video, send invoice directly
        if (paidVideos.length === 1) {
            const singleVideo = paidVideos[0];
            await CustomVideoHandler.sendVideoInvoice(ctx, userId, singleVideo);
            return;
        }

        // Multiple videos - check if user mentioned a specific one
        let selectedVideo = null;
        const lowerUserMsg = userMessage.toLowerCase();

        // Try to match user's message with video titles
        for (const video of paidVideos) {
            if (video.title && lowerUserMsg.includes(video.title.toLowerCase())) {
                selectedVideo = video;
                break;
            }
        }

        // If user said "first one" or didn't specify, use first video
        if (!selectedVideo && (lowerUserMsg.includes("first") || lowerUserMsg.includes("one"))) {
            selectedVideo = paidVideos[0];
        }

        // If still no match, use first video as default
        if (!selectedVideo) {
            selectedVideo = paidVideos[0];
        }

        await CustomVideoHandler.sendVideoInvoice(ctx, userId, selectedVideo, videoListMessage);
    }

    static async sendVideo(ctx, userId, video) {
        const botReply = "Here's a special video just for you babe! 😍💕";
        await ctx.reply(botReply);
        await FirebaseService.saveChatMessage(userId, "assistant", botReply);

        await randomDelay();

        await ctx.replyWithVideo(video.fileUrl, {
            caption: video.title || "Just for you 😘"
        });

        await FirebaseService.saveChatMessage(userId, "assistant", video.title || "Sent video", {
            fileUrl: video.fileUrl,
            mediaType: "video",
            type: "video"
        });
    }

    static async sendVideoInvoice(ctx, userId, video, videoListMessage = null) {
        const videoPrice = video.price || 100;

        // Create custom video request in Firebase
        await FirebaseService.createCustomVideoRequest(userId, ctx.message.text, videoPrice);

        const prefix = videoListMessage ? `${videoListMessage}\n\n` : "";
        const botReply = `${prefix}I'll send you "${video.title || "Video"}" for ${videoPrice} Stars. Tap the invoice below! 💕`;
        await ctx.reply(botReply);
        await FirebaseService.saveChatMessage(userId, "assistant", botReply);

        await randomDelay();

        await ctx.replyWithInvoice({
            title: video.title || "Custom Video",
            description: `Premium video - ${videoPrice} Stars`,
            payload: `custom_video_${video.id}_${userId}`,
            currency: "XTR",
            prices: [{ label: video.title || "Video", amount: videoPrice }],
            provider_token: "" // Empty for Stars
        });
    }
}

module.exports = CustomVideoHandler;
