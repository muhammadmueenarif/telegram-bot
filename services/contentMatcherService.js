const OpenAI = require("openai");
const { OPENAI_API_KEY } = require("../config");

/**
 * Content Matcher Service
 * Second AI that matches user requests to available content based on descriptions
 */
class ContentMatcherService {
    constructor() {
        this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        console.log("✅ Content Matcher initialized");
    }

    /**
     * Match user request to available content
     * @param {string} userMessage - The user's original message
     * @param {Array} availableContent - Content items from Firebase with descriptions
     * @param {boolean} freeOnly - Only match free content
     * @returns {Object} Matched content and reasoning
     */
    async matchContent(userMessage, availableContent, freeOnly = false) {
        try {
            // Filter content based on freeOnly flag
            const contentToMatch = freeOnly
                ? availableContent.filter(c => c.isFree === true)
                : availableContent;

            if (contentToMatch.length === 0) {
                return {
                    matched: false,
                    reason: freeOnly ? "no_free_content" : "no_content_available",
                    contentIds: []
                };
            }

            // Build content descriptions for AI
            const contentDescriptions = contentToMatch.map(c => ({
                id: c.id,
                title: c.title,
                description: c.description || c.title,
                type: c.type,
                category: c.category,
                isFree: c.isFree
            }));

            const systemPrompt = `You are a smart content matcher. Your job is to match user requests to available content based on descriptions.

USER REQUEST: "${userMessage}"

AVAILABLE CONTENT:
${contentDescriptions.map((c, i) => `${i + 1}. [${c.id}] ${c.title} (${c.type})
   Description: ${c.description}
   Category: ${c.category}
   ${c.isFree ? 'FREE' : 'PAID'}`).join('\n\n')}

MATCHING RULES:
1. Match based on keywords in descriptions (beach, workout, lingerie, custom, etc.)
2. If user request is vague ("show me something", "send pics"), pick 1 best item
3. If user is specific ("beach photos"), only match items with "beach" in description
4. Return ONLY 1 content ID (always return maximum 1 item)
5. If NO good match found, return empty array

Respond in JSON format ONLY:
{
  "matched": true/false,
  "contentIds": ["id1"],
  "reasoning": "Why this item matches the user request",
  "confidence": 0.95
}

IMPORTANT: Return ONLY 1 content ID in the array, not multiple!`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 16000,
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            const matchResult = JSON.parse(response.choices[0].message.content);
            console.log(`🎨 Content Match:`, matchResult);

            return matchResult;

        } catch (error) {
            console.error("Content Matcher Error:", error);
            return {
                matched: false,
                reason: "error",
                contentIds: [],
                reasoning: "Error matching content"
            };
        }
    }

    /**
     * Get content items by IDs from the available content array
     * @param {Array} contentIds - Array of content IDs to fetch
     * @param {Array} availableContent - All available content
     * @returns {Array} Matched content items
     */
    getContentByIds(contentIds, availableContent) {
        return availableContent.filter(c => contentIds.includes(c.id));
    }
}

module.exports = ContentMatcherService;
