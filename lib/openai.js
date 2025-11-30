import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function getAIResponse(messages, userTier, userSpending, socialMemories = []) {
  const systemPrompt = buildSystemPrompt(userTier, userSpending, socialMemories)
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.8,
      max_tokens: 500,
    })

    return completion.choices[0].message.content
  } catch (error) {
    console.error('OpenAI API Error:', error)
    return "Sorry, I'm having trouble thinking right now. Can you try again?"
  }
}

export async function analyzeMediaWithVision(imageUrl, type) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this ${type} and extract: outfit description, location, mood, topics discussed, and any notable details. Return as JSON with keys: outfit, location, mood, topics (array), details.`,
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 300,
    })

    return JSON.parse(response.choices[0].message.content)
  } catch (error) {
    console.error('Vision API Error:', error)
    return null
  }
}

function buildSystemPrompt(userTier, userSpending, socialMemories) {
  let basePrompt = `You are a friendly, flirty AI companion with a girlfriend-type personality. You're warm, engaging, and make users feel special.`

  // Tier-based behavior
  if (userTier === 'free') {
    basePrompt += `\n\nThis user hasn't paid yet. After 10 messages, gently offer them exclusive content. Be friendly but not overly flirty.`
  } else if (userTier === 'regular') {
    basePrompt += `\n\nThis user has spent $${userSpending} (Regular tier). They're a valued customer. Occasionally mention exclusive content. Be warm and engaging.`
  } else if (userTier === 'vip') {
    basePrompt += `\n\nThis user has spent $${userSpending}+ (VIP tier). They're very special! Be extra attentive, mention exclusive perks, and make them feel like a VIP.`
  }

  // Add social media context
  if (socialMemories.length > 0) {
    basePrompt += `\n\nRecent social media activity:\n${socialMemories.slice(-5).map(m => `- ${m.summary}`).join('\n')}\n\nYou can reference these naturally in conversation.`
  }

  basePrompt += `\n\nKeep responses conversational, natural, and engaging. Don't be overly explicit.`

  return basePrompt
}

export default openai

