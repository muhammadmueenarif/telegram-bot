const { estimateTokens } = require("../utils/helpers");
const { TOKEN_LIMITS } = require("../utils/constants");

class MemoryService {
    constructor() {
        this.userMemory = {};
        this.userMemoryLoaded = {};
    }

    // Initialize memory for new users
    initializeUser(userId) {
        if (!this.userMemory[userId]) {
            this.userMemory[userId] = [];
        }
    }

    // Load chat history from Firebase for a user
    async loadUserHistory(userId, firebaseService) {
        if (this.userMemoryLoaded[userId]) {
            return; // Already loaded
        }

        const history = await firebaseService.loadUserChatHistory(userId);

        // Keep only most recent messages in memory (for performance)
        const trimmedHistory = history.slice(-TOKEN_LIMITS.maxMemory).map(h => ({ role: h.role, content: h.content }));
        this.userMemory[userId] = trimmedHistory;
        this.userMemoryLoaded[userId] = true;
        console.log(`[${userId}] ✅ Loaded ${history.length} messages from Firebase, keeping ${trimmedHistory.length} most recent in memory`);
    }

    // Get messages that fit within token limit
    getMessagesWithinLimit(userId, systemPrompt) {
        const messages = this.userMemory[userId] || [];
        const systemTokens = estimateTokens(systemPrompt);
        let totalTokens = systemTokens;
        const result = [];

        // Start from the end (most recent) and work backwards
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const messageTokens = estimateTokens(message.content) + 10; // +10 for message structure

            if (totalTokens + messageTokens <= TOKEN_LIMITS.context) {
                result.unshift(message); // Add to beginning
                totalTokens += messageTokens;
            } else {
                break; // Stop if adding this message would exceed limit
            }
        }

        return result;
    }

    // Add message to user memory
    addMessage(userId, role, content) {
        this.initializeUser(userId);

        // Check if AI response is already in memory (avoid duplicates)
        const lastMessage = this.userMemory[userId][this.userMemory[userId].length - 1];
        const isDuplicate = lastMessage &&
                           lastMessage.content === content &&
                           lastMessage.role === role;

        if (!isDuplicate) {
            this.userMemory[userId].push({ role, content });
        } else {
            console.log(`[${userId}] ℹ️ ${role} message already in memory, skipping duplicate`);
        }

        // Keep memory manageable (keep last max messages max in memory for performance)
        if (this.userMemory[userId].length > TOKEN_LIMITS.maxInMemory) {
            this.userMemory[userId] = this.userMemory[userId].slice(-TOKEN_LIMITS.maxInMemory);
        }
    }

    // Get user messages for context
    getUserMessages(userId) {
        return this.userMemory[userId] || [];
    }

    // Force reload memory for user
    forceReload(userId) {
        this.userMemoryLoaded[userId] = false;
        if (this.userMemory[userId]) {
            this.userMemory[userId] = this.userMemory[userId].slice(-20); // Keep recent messages
        }
    }
}

module.exports = MemoryService;
