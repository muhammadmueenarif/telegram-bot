const https = require("https");
const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = require("../config");

/**
 * ElevenLabs Text-to-Speech Service
 * Converts text to speech using ElevenLabs API
 */
class ElevenLabsService {
    constructor() {
        this.apiKey = ELEVENLABS_API_KEY;
        this.voiceId = ELEVENLABS_VOICE_ID;
        console.log("✅ ElevenLabs TTS initialized");
    }

    /**
     * Convert text to speech using ElevenLabs API
     * @param {string} text - The text to convert to speech
     * @returns {Promise<Buffer>} Audio buffer
     */
    async textToSpeech(text) {
        try {
            if (!this.apiKey || !this.voiceId) {
                throw new Error("ElevenLabs API key or Voice ID not configured");
            }

            console.log(`🎙️ [ElevenLabs] Converting text to speech (${text.length} chars)`);

            const postData = JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            });

            const options = {
                hostname: "api.elevenlabs.io",
                port: 443,
                path: `/v1/text-to-speech/${this.voiceId}`,
                method: "POST",
                headers: {
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": this.apiKey,
                    "Content-Length": Buffer.byteLength(postData)
                }
            };

            return new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    const chunks = [];

                    res.on("data", (chunk) => {
                        chunks.push(chunk);
                    });

                    res.on("end", () => {
                        if (res.statusCode === 200) {
                            const audioBuffer = Buffer.concat(chunks);
                            console.log(`✅ [ElevenLabs] Audio generated successfully (${audioBuffer.length} bytes)`);
                            resolve(audioBuffer);
                        } else {
                            const errorBody = Buffer.concat(chunks).toString();
                            console.error(`❌ [ElevenLabs] Error: ${res.statusCode} - ${errorBody}`);
                            reject(new Error(`ElevenLabs API error: ${res.statusCode} - ${errorBody}`));
                        }
                    });
                });

                req.on("error", (error) => {
                    console.error("❌ [ElevenLabs] Request error:", error);
                    reject(error);
                });

                req.write(postData);
                req.end();
            });

        } catch (error) {
            console.error("❌ [ElevenLabs] Text-to-speech error:", error);
            throw error;
        }
    }
}

module.exports = ElevenLabsService;
