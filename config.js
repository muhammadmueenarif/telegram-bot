require("dotenv").config();

// Check required environment variables
if (!process.env.BOT_TOKEN) {
    console.error("❌ Error: BOT_TOKEN is not set in .env file");
    console.error("   Please add BOT_TOKEN=your_bot_token to your .env file");
    process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY is not set in .env file");
    console.error("   Please add OPENAI_API_KEY=your_openai_key to your .env file");
    process.exit(1);
}

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MINI_APP_URL: process.env.MINI_APP_URL || "https://telegram-page-three.vercel.app", // Update with your mini app URL
    FIREBASE_CONFIG: {
        // Add your Firebase config here or import from firebaseConfig.js
    }
};
