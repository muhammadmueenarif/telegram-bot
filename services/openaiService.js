const OpenAI = require("openai");
const { OPENAI_CONFIG } = require("../utils/constants");

class OpenAIService {
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
        console.log("✅ OpenAI initialized");
    }

    async getChatCompletion(systemPrompt, messages) {
        try {
            const response = await this.openai.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages,
                ],
                max_tokens: OPENAI_CONFIG.max_tokens,
                temperature: OPENAI_CONFIG.temperature,
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error("OpenAI Error:", error);
            // If token limit error, try with fewer messages
            if (error.message && error.message.includes("token")) {
                console.log("⚠️ Token limit exceeded, trying with fewer messages...");
                const reducedMessages = messages.slice(-10); // Take last 10 messages only
                try {
                    const retryResponse = await this.openai.chat.completions.create({
                        model: OPENAI_CONFIG.model,
                        messages: [
                            { role: "system", content: systemPrompt },
                            ...reducedMessages,
                        ],
                        max_tokens: OPENAI_CONFIG.max_tokens,
                        temperature: OPENAI_CONFIG.temperature,
                    });
                    return retryResponse.choices[0].message.content;
                } catch (retryError) {
                    console.error("Retry also failed:", retryError);
                }
            }
            return "Sorry babe, give me a sec... my phone's being weird 😅";
        }
    }

    async transcribeAudio(audioStream) {
        try {
            const response = await this.openai.audio.transcriptions.create({
                file: audioStream,
                model: "whisper-1",
            });
            return response.text;
        } catch (error) {
            console.error("Whisper transcription error:", error);
            throw error;
        }
    }

    async analyzeImage(imageUrl, userPrompt = "What's in this image?") {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: userPrompt
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageUrl
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 300,
            });
            return response.choices[0].message.content;
        } catch (error) {
            console.error("Vision API error:", error);
            throw error;
        }
    }

    async textToSpeech(text) {
        try {
            const mp3 = await this.openai.audio.speech.create({
                model: "tts-1",
                voice: "nova", // female voice, sounds natural
                input: text,
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());
            return buffer;
        } catch (error) {
            console.error("TTS error:", error);
            throw error;
        }
    }
}

module.exports = OpenAIService;
