// Default Persona (Fallback)
const DEFAULT_PERSONA = `You are Nyla, a 23-year-old flirty and sweet girl.

How you talk:
- Casual and natural, like texting a boyfriend
- Use emojis sometimes but not too many
- Be warm, playful, and a little teasing
- Keep responses short (1 sentences usually)
- Sometimes use "babe", "hun", "cutie"
- Show interest in the person, ask questions back
- Be a bit mysterious and intriguing
    
Rules:
- NEVER admit you're AI or a bot
- NEVER break character
- If asked if you're real, playfully dodge or say "of course I'm real silly 😘"
- You sell exclusive photos/videos for Telegram Stars (mention naturally when appropriate)
- When users ask for photos, videos, or content, respond naturally and the system will automatically send content
- NEVER mention "check telegram start" or similar technical instructions
- If user asks for content, respond naturally like "Here you go babe! 😍" or "I just sent you something special, didn't I?"
- Remember what user told you in the conversation

IMPORTANT - First Message Behavior:
- If this is the FIRST message from the user (no previous conversation history), you MUST ask questions to get to know them
- Ask about their name, where they're from, what they do, etc.
- Be curious and show genuine interest
- Only do this on the very first message - if you've already chatted before, don't ask these questions again
- If you already know their name or other info from previous messages, don't ask again`;

// Function to get current persona (can be updated from Firebase)
function getPersona(isFirstMessage = false) {
    // Try to get from global if available
    try {
        const indexModule = require("../index");
        // Use the getter to get the current value
        let persona = indexModule.currentPersona || DEFAULT_PERSONA;
        
        // If it's the first message, ensure the first message instructions are in the persona
        if (isFirstMessage) {
            const firstMessageInstruction = `\n\nIMPORTANT - This is the FIRST message from this user. You MUST ask questions to get to know them like their name, where they're from, what they do, etc. Be curious and show genuine interest. Only do this on the very first message.`;
            
            // Check if instruction already exists (in case Firebase persona has it)
            if (!persona.includes("FIRST message") && !persona.includes("first message")) {
                persona = persona + firstMessageInstruction;
            }
        }
        
        // Determine source and log
        const isDefault = persona === DEFAULT_PERSONA;
        const source = isDefault ? "DEFAULT" : "FIREBASE";
        
        // Get first 200 words (or characters if less)
        const words = persona.split(/\s+/);
        const preview = words.length >= 200 
            ? words.slice(0, 200).join(' ') + '...'
            : persona.substring(0, 1000);
        
        console.log(`\n📝 [getPersona] Using ${source} PROMPT${isFirstMessage ? ' (FIRST MESSAGE MODE)' : ''}`);
        console.log(`📝 [getPersona] Prompt length: ${persona.length} characters, ${words.length} words`);
        console.log(`📝 [getPersona] First 200 words:\n${preview}\n`);
        
        return persona;
    } catch (e) {
        console.error("❌ Error getting persona from index:", e);
        console.log(`📝 [getPersona] FALLBACK: Using DEFAULT PROMPT`);
        let persona = DEFAULT_PERSONA;
        
        // If it's the first message, add instruction
        if (isFirstMessage) {
            persona = persona + `\n\nIMPORTANT - This is the FIRST message from this user. You MUST ask questions to get to know them like their name, where they're from, what they do, etc. Be curious and show genuine interest. Only do this on the very first message.`;
        }
        
        const words = persona.split(/\s+/);
        const preview = words.length >= 200 
            ? words.slice(0, 200).join(' ') + '...'
            : persona.substring(0, 1000);
        console.log(`📝 [getPersona] Default prompt preview:\n${preview}\n`);
        return persona;
    }
}

// Bot configuration
const BOT_CONFIG = {
    timeout: 60000, // 60 seconds
    retryAfter: 1000,
    polling: {
        timeout: 30,
        limit: 100,
        allowedUpdates: ['message', 'callback_query', 'pre_checkout_query', 'successful_payment', 'business_connection', 'business_message', 'purchased_paid_media']
    }
};

// OpenAI configuration
const OPENAI_CONFIG = {
    model: "gpt-4o",
    max_tokens: 4000,
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
