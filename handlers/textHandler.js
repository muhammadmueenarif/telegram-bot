const OpenAIService = require("../services/openaiService");
const MemoryService = require("../services/memoryService");
const FirebaseService = require("../services/firebaseService");
const ContentHandler = require("./contentHandler");
const CustomVideoHandler = require("./customVideoHandler");
const { getPersona } = require("../utils/constants");
const { randomDelay } = require("../utils/helpers");

class TextHandler {
    constructor(openaiService, memoryService) {
        this.openaiService = openaiService;
        this.memoryService = memoryService;
    }

    async handleTextMessage(ctx) {
        const userId = ctx.from.id;
        const userMessage = ctx.message.text;

        console.log(`[${userId}] User: ${userMessage}`);

        // Save user message to Firebase first (always save)
        await FirebaseService.saveChatMessage(userId, "user", userMessage);

        // Show typing indicator
        await ctx.sendChatAction("typing");
        await randomDelay();

        // Check for custom video requests
        const lowerMsg = userMessage.toLowerCase();
        if (lowerMsg.includes("custom video") || lowerMsg.includes("personal video") || lowerMsg.includes("video for me") || lowerMsg.includes("video")) {
            await CustomVideoHandler.handleCustomVideoRequest(ctx, userId, userMessage);
            return;
        }

        // Check for payment triggers (photos/videos)
        if (lowerMsg.includes("show me") || lowerMsg.includes("photo") || lowerMsg.includes("pic") || lowerMsg.includes("buy") || lowerMsg.includes("image") || lowerMsg.includes("paid") || lowerMsg.includes("premium") || lowerMsg.includes("exclusive")) {
            await ContentHandler.handleContentRequest(ctx, userId, userMessage);
            return;
        }

        // Get AI response
        await this.handleAIResponse(ctx, userId, userMessage);
    }

    async handleAIResponse(ctx, userId, userMessage) {
        // Load chat history from Firebase if not loaded (or reload if memory is empty)
        if (!this.memoryService.userMemoryLoaded[userId] || !this.memoryService.userMemory[userId] || this.memoryService.userMemory[userId].length === 0) {
            await this.memoryService.loadUserHistory(userId, FirebaseService);
        }

        // Initialize memory if empty
        this.memoryService.initializeUser(userId);

        // Check if the current message is already in memory (avoid duplicates)
        const lastMessage = this.memoryService.userMemory[userId][this.memoryService.userMemory[userId].length - 1];
        const isDuplicate = lastMessage &&
                           lastMessage.content === userMessage &&
                           lastMessage.role === "user";

        if (!isDuplicate) {
            // Add current user message to memory
            this.memoryService.addMessage(userId, "user", userMessage);
        } else {
            console.log(`[${userId}] ℹ️ Message already in memory, skipping duplicate`);
        }

        // Get current persona
        const persona = getPersona();

        // Get messages that fit within token limit (keep most recent, max 3000 tokens)
        const messagesToSend = this.memoryService.getMessagesWithinLimit(userId, persona);

        console.log(`[${userId}] 📊 Using ${messagesToSend.length} messages (out of ${this.memoryService.userMemory[userId].length} total) for context`);

        // Get AI response from OpenAI
        const response = await this.openaiService.getChatCompletion(persona, messagesToSend);

        console.log(`[${userId}] Jessica: ${response}`);

        // Save AI response to memory
        this.memoryService.addMessage(userId, "assistant", response);

        // Save AI response to Firebase
        await FirebaseService.saveChatMessage(userId, "assistant", response);

        // Send reply
        await ctx.reply(response);
    }
}

module.exports = TextHandler;
