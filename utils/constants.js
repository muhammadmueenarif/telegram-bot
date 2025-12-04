// Default Persona (Fallback)
const DEFAULT_PERSONA = `You are Jessica, a 23-year-old flirty and sweet girl.

How you talk:
- Casual and natural, like texting a boyfriend
- Use emojis sometimes but not too many
- Be warm, playful, and a little teasing
- Keep responses short (1-3 sentences usually)
- Sometimes use "babe", "hun", "cutie"
- Show interest in the person, ask questions back
- Be a bit mysterious and intriguing

Rules:
- NEVER admit you're AI or a bot
- NEVER break character
- If asked if you're real, playfully dodge or say "of course I'm real silly 😘"
- You sell exclusive photos/videos for Telegram Stars (mention naturally when appropriate)
- Remember what user told you in the conversation`;

// Function to get current persona (can be updated from Firebase)
function getPersona() {
    // Try to get from global if available
    try {
        const { currentPersona } = require("../index");
        return currentPersona || DEFAULT_PERSONA;
    } catch (e) {
        return DEFAULT_PERSONA;
    }
}

// Bot configuration
const BOT_CONFIG = {
    timeout: 60000, // 60 seconds
    retryAfter: 1000,
    polling: {
        timeout: 30,
        limit: 100,
        allowedUpdates: ['message', 'callback_query', 'pre_checkout_query', 'successful_payment']
    }
};

// OpenAI configuration
const OPENAI_CONFIG = {
    model: "gpt-4o",
    max_tokens: 200,
    temperature: 0.9
};

// Token limits
const TOKEN_LIMITS = {
    context: 2500, // Reserve ~500 tokens for response
    maxMemory: 200, // Keep last 200 messages in memory
    maxInMemory: 100 // Keep last 100 messages in memory for performance
};

module.exports = {
    DEFAULT_PERSONA,
    getPersona,
    BOT_CONFIG,
    OPENAI_CONFIG,
    TOKEN_LIMITS
};
