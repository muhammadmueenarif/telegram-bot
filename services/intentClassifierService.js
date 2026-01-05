const OpenAI = require("openai");
const { OPENAI_API_KEY } = require("../config");
const { getPersona } = require("../utils/constants");

/**
 * Intent Classifier Service
 * First AI that understands user intent and determines appropriate action
 */
class IntentClassifierService {
    constructor() {
        this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        console.log("✅ Intent Classifier initialized");
    }

    /**
     * Analyze user message and determine intent
     * @param {string} userMessage - The user's message
     * @param {Array} conversationHistory - Recent conversation context (last 5 messages)
     * @param {Object} userContext - Info about user's history (has received free content, etc.)
     * @returns {Object} Intent analysis with action and reasoning
     */
    async analyzeIntent(userMessage, conversationHistory = [], userContext = {}) {
        try {
            // Get the current persona from admin panel (or default)
            const persona = getPersona();
            console.log(`🎯 [IntentClassifier] Using persona for intent analysis (length: ${persona.length} chars)`);
            
            const systemPrompt = `You are an intelligent intent classifier for a content creator chatbot.

PERSONA CONTEXT:
${persona}

Your job is to analyze user messages and determine the BEST ACTION to take.

AVAILABLE ACTIONS:
1. "simple_chat" - Normal flirty conversation, no special action needed
2. "request_free_content" - User wants photos/videos, we should check for free content first
3. "request_paid_content" - User explicitly wants to buy or mentions paid/premium content
4. "open_packages" - User wants to see packages or buy Stars
5. "greeting" - User is greeting (hi, hello, hey, etc.)
6. "select_free" - User wants free content (says "fun", "free", "just for fun")
7. "select_paid" - User wants paid content (says "special", "paid", "something special")
8. "select_photo" - User wants photo (says "photo", "pic", "image", "picture")
9. "select_video" - User wants video (says "video", "vid")
10. "request_voice_note" - User explicitly asks for voice note/voice message/audio message

INTENT DETECTION RULES:
- Greetings: "hi", "hello", "hey", "what's up" → "greeting"
- Voice note requests: "send voice", "voice note", "voice message", "audio message", "talk to me", "speak to me", "send me voice" → "request_voice_note"
- User says "fun" or "just for fun" or "free" → "select_free"
- User says "special" or "something special" or "paid" → "select_paid"
- User says "photo" or "pic" or "picture" or "image" → "select_photo"
- User says "video" or "vid" → "select_video"
- General content requests: "show me", "send pics", "got photos", "let me see" → "request_free_content"
- Explicit paid requests: "buy", "purchase", "paid content", "premium", "exclusive", "spend money" → "request_paid_content"
- Package/Stars mentions: "packages", "stars", "how much", "prices" → "open_packages"
- Everything else: casual conversation → "simple_chat"

USER CONTEXT:
- Has received free content before: ${userContext.hasFreeContentHistory ? 'Yes' : 'No'}
- Number of items sent: ${userContext.sentContentCount || 0}

IMPORTANT LOGIC:
- If user has already received free content (${userContext.hasFreeContentHistory}) and asks for more content, lean towards "request_paid_content" or "open_packages"
- If it's user's first time asking for content, use "request_free_content"
- Be smart about context - if user says "more" after getting free content, they probably want paid content

RECENT CONVERSATION:
${conversationHistory.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'Nyla'}: ${m.content}`).join('\n')}

USER MESSAGE: "${userMessage}"

Respond in JSON format ONLY:
{
  "action": "ACTION_TYPE",
  "reasoning": "Brief explanation of why you chose this action",
  "confidence": 0.95
}`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini", // Fast, cheap model for classification
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 16000,
                temperature: 0.2, // Low temperature for consistent classification
                response_format: { type: "json_object" }
            });

            const intentData = JSON.parse(response.choices[0].message.content);
            console.log(`🎯 Intent Analysis:`, intentData);

            return intentData;

        } catch (error) {
            console.error("Intent Classifier Error:", error);
            // Default to simple chat on error
            return {
                action: "simple_chat",
                reasoning: "Error in classification, defaulting to chat",
                confidence: 0.5
            };
        }
    }
}

module.exports = IntentClassifierService;
