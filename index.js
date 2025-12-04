require("dotenv").config();

const { BOT_TOKEN, OPENAI_API_KEY } = require("./config");
const Bot = require("./bot");

// Initialize and start the bot
const bot = new Bot(BOT_TOKEN, OPENAI_API_KEY);

// Listen for Persona updates from Firebase
const { doc, onSnapshot, collection, query, where, updateDoc } = require("firebase/firestore");
const { db } = require("./firebaseConfig");
const { PERSONA } = require("./utils/constants");
const { randomDelay } = require("./utils/helpers");
const FirebaseService = require("./services/firebaseService");

// Global persona variable that can be updated
let currentPersona = PERSONA;

const settingsRef = doc(db, "settings", "persona");
onSnapshot(settingsRef, (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        if (data.prompt) {
            currentPersona = data.prompt;
            console.log("🔄 Persona updated from Firebase");
        }
    }
});

// Listen for package requests from mini app
const packageRequestsRef = collection(db, "package_requests");
const pendingRequestsQuery = query(packageRequestsRef, where("status", "==", "pending"));

onSnapshot(pendingRequestsQuery, async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
            const requestData = change.doc.data();
            const requestId = change.doc.id;

            console.log(`📦 New package request from user ${requestData.userId}`);

            try {
                // Get package details from Firebase
                const packageData = await FirebaseService.getPackageById(requestData.packageId);

                if (!packageData) {
                    console.error(`❌ Package not found: ${requestData.packageId}`);
                    return;
                }

                // Send acknowledgment message
                const botReply = `Perfect choice babe! 💕 You selected the ${packageData.stars} Stars package!\n\nTap the invoice below to complete your purchase! ⭐`;
                await bot.bot.telegram.sendMessage(requestData.userId, botReply);
                await FirebaseService.saveChatMessage(requestData.userId, "assistant", botReply);

                // Small delay for better UX
                await randomDelay();

                // Send Stars invoice
                await bot.bot.telegram.sendInvoice(requestData.userId, {
                    title: `${packageData.stars} Stars Package`,
                    description: packageData.includes || `${packageData.stars} Telegram Stars`,
                    payload: `package_${requestData.packageId}_${requestData.userId}`,
                    currency: "XTR",
                    prices: [{
                        label: `${packageData.stars} Stars`,
                        amount: packageData.stars
                    }],
                    provider_token: ""
                });

                console.log(`[${requestData.userId}] 💳 Invoice sent: ${packageData.stars} Stars`);

                // Update request status to 'processed'
                await updateDoc(doc(db, "package_requests", requestId), {
                    status: 'processed'
                });

            } catch (error) {
                console.error("Error processing package request:", error);
            }
        }
    });
});

// Export for use in other modules
module.exports = { currentPersona };

// Start the bot
bot.launch().catch(error => {
    console.error("Failed to start bot:", error);
    process.exit(1);
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
