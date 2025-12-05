require("dotenv").config();

const { BOT_TOKEN, OPENAI_API_KEY } = require("./config");
const Bot = require("./bot");

// Initialize and start the bot
const bot = new Bot(BOT_TOKEN, OPENAI_API_KEY);

// Listen for Persona updates from Firebase
const { doc, onSnapshot, collection, query, where, updateDoc, getDoc } = require("firebase/firestore");
const { db } = require("./firebaseConfig");
const { DEFAULT_PERSONA } = require("./utils/constants");
const { randomDelay } = require("./utils/helpers");
const FirebaseService = require("./services/firebaseService");

// Global persona variable that can be updated
let currentPersona = DEFAULT_PERSONA;

// Log default persona on startup
console.log("\n📋 [INIT] Default Persona loaded:");
const defaultWords = DEFAULT_PERSONA.split(/\s+/);
const defaultPreview = defaultWords.length >= 200 
    ? defaultWords.slice(0, 200).join(' ') + '...'
    : DEFAULT_PERSONA.substring(0, 1000);
console.log(`📋 [INIT] Default length: ${DEFAULT_PERSONA.length} chars, ${defaultWords.length} words`);
console.log(`📋 [INIT] Default preview:\n${defaultPreview}\n`);

// Function to update persona (can be called from anywhere)
function updatePersona(prompt, source = "Firebase") {
    if (prompt) {
        const oldPersona = currentPersona;
        currentPersona = prompt;
        
        // Log detailed information
        const words = prompt.split(/\s+/);
        const preview = words.length >= 200 
            ? words.slice(0, 200).join(' ') + '...'
            : prompt.substring(0, 1000);
        
        console.log(`\n🔄 [updatePersona] Persona updated from ${source.toUpperCase()}`);
        console.log(`🔄 [updatePersona] Prompt length: ${prompt.length} characters, ${words.length} words`);
        console.log(`🔄 [updatePersona] First 200 words:\n${preview}\n`);
        
        // Check if it's different from default
        const isDefault = prompt === DEFAULT_PERSONA;
        if (isDefault) {
            console.log(`⚠️ [updatePersona] WARNING: Updated persona matches DEFAULT_PERSONA`);
        }
    }
}

// Load persona from Firebase on startup
async function loadPersonaFromFirebase() {
    try {
        console.log("\n📥 [loadPersonaFromFirebase] Attempting to load persona from Firebase...");
        const settingsRef = doc(db, "settings", "persona");
        const personaSnap = await getDoc(settingsRef);
        
        if (personaSnap.exists()) {
            const data = personaSnap.data();
            console.log(`📥 [loadPersonaFromFirebase] Document exists. Fields: ${Object.keys(data).join(', ')}`);
            
            if (data.prompt) {
                updatePersona(data.prompt, "Firebase (startup)");
                console.log("✅ [loadPersonaFromFirebase] Successfully loaded persona from Firebase on startup");
            } else {
                console.log("⚠️ [loadPersonaFromFirebase] Persona document exists but no 'prompt' field found");
                console.log("⚠️ [loadPersonaFromFirebase] Using DEFAULT_PERSONA");
                updatePersona(DEFAULT_PERSONA, "Default (no prompt field)");
            }
        } else {
            console.log("ℹ️ [loadPersonaFromFirebase] No persona document found in Firebase");
            console.log("ℹ️ [loadPersonaFromFirebase] Using DEFAULT_PERSONA");
            updatePersona(DEFAULT_PERSONA, "Default (no document)");
        }
    } catch (error) {
        console.error("❌ [loadPersonaFromFirebase] Error loading persona from Firebase:", error);
        console.log("ℹ️ [loadPersonaFromFirebase] Using DEFAULT_PERSONA due to error");
        updatePersona(DEFAULT_PERSONA, "Default (error)");
    }
}

// Listen for Persona updates from Firebase in real-time
const settingsRef = doc(db, "settings", "persona");
onSnapshot(settingsRef, (doc) => {
    console.log("\n📡 [onSnapshot] Firebase persona document changed");
    if (doc.exists()) {
        const data = doc.data();
        console.log(`📡 [onSnapshot] Document exists. Fields: ${Object.keys(data).join(', ')}`);
        if (data.prompt) {
            updatePersona(data.prompt, "Firebase (real-time)");
            console.log("🔄 [onSnapshot] Persona updated from Firebase (real-time)");
        } else {
            console.log("⚠️ [onSnapshot] Document exists but no 'prompt' field");
        }
    } else {
        console.log("⚠️ [onSnapshot] Document no longer exists, keeping current persona");
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

// Export for use in other modules - export a getter function to always get current value
module.exports = { 
    get currentPersona() { return currentPersona; },
    updatePersona 
};

// Start the bot after loading persona
async function startBot() {
    // Load persona first
    await loadPersonaFromFirebase();
    
    // Then start the bot
    console.log("🚀 Starting bot...");
    bot.launch().catch(error => {
        console.error("Failed to start bot:", error);
        process.exit(1);
    });
}

startBot();

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
