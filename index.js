require("dotenv").config();
const { Telegraf } = require("telegraf");
const OpenAI = require("openai");

// Initialize bot and OpenAI
const bot = new Telegraf(process.env.BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Store conversation history per user
const userMemory = {};

// Jessica's persona prompt
const PERSONA = `You are Jessica, a 23-year-old flirty and sweet girl.

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

// Random delay between 1.5-3 seconds (feels human)
function randomDelay() {
    return new Promise((resolve) => {
        const delay = Math.floor(Math.random() * 1500) + 1500;
        setTimeout(resolve, delay);
    });
}

// Get AI response from OpenAI
async function getAIResponse(userId, userMessage) {
    // Initialize memory for new users
    if (!userMemory[userId]) {
        userMemory[userId] = [];
    }

    // Add user message to history
    userMemory[userId].push({ role: "user", content: userMessage });

    // Keep only last 20 messages to avoid token limit
    if (userMemory[userId].length > 20) {
        userMemory[userId] = userMemory[userId].slice(-20);
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: PERSONA },
                ...userMemory[userId],
            ],
            max_tokens: 200,
            temperature: 0.9,
        });

        const aiMessage = response.choices[0].message.content;

        // Save AI response to memory
        userMemory[userId].push({ role: "assistant", content: aiMessage });

        return aiMessage;
    } catch (error) {
        console.error("OpenAI Error:", error);
        return "Sorry babe, give me a sec... my phone's being weird 😅";
    }
}

// Handle /start command
bot.start(async (ctx) => {
    const firstName = ctx.from.first_name || "there";

    await ctx.sendChatAction("typing");
    await randomDelay();

    await ctx.reply(`Hey ${firstName}! 😊 Finally you texted me... I was waiting 💕`);
});

// Handle pre-checkout (required for payments)
bot.on("pre_checkout_query", (ctx) => {
    ctx.answerPreCheckoutQuery(true);
});

// Handle successful payment
bot.on("successful_payment", async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;

    await ctx.reply("Omg thank you babe! 💖 Here are the photos I promised...");
    await randomDelay();

    // Send content based on payload
    if (payload === "photo_set_1") {
        await ctx.replyWithPhoto("https://picsum.photos/400/600", { caption: "Just for you 😘" });
    }
});

// Handle all text messages
bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const userMessage = ctx.message.text;

    console.log(`[${userId}] User: ${userMessage}`);

    // Show typing indicator
    await ctx.sendChatAction("typing");

    // Add human-like delay
    await randomDelay();

    // Check for payment triggers
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes("show me") || lowerMsg.includes("photo") || lowerMsg.includes("pic") || lowerMsg.includes("buy")) {
        await ctx.reply("You want to see more? 🙈 It's a little exclusive...");
        await randomDelay();

        return ctx.replyWithInvoice({
            title: "Exclusive Photos",
            description: "5 spicy photos just for you 🔥",
            payload: "photo_set_1",
            currency: "XTR",
            prices: [{ label: "Photos", amount: 50 }],
            provider_token: "" // Empty for Stars
        });
    }

    // Get AI response
    const response = await getAIResponse(userId, userMessage);

    console.log(`[${userId}] Jessica: ${response}`);

    // Send reply
    await ctx.reply(response);
});

// Handle photos sent by user
bot.on("photo", async (ctx) => {
    await ctx.sendChatAction("typing");
    await randomDelay();
    await ctx.reply("Omg you're so cute! 😍 Send more?");
});

// Handle stickers
bot.on("sticker", async (ctx) => {
    await ctx.sendChatAction("typing");
    await randomDelay();
    await ctx.reply("Haha I love that 😂💕");
});

// Error handling
bot.catch((err, ctx) => {
    console.error("Bot error:", err);
});

// Start bot with polling
bot.launch().then(() => {
    console.log("✅ Jessica bot is running...");
    console.log("Bot: @Jessica_testing_bot");
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
