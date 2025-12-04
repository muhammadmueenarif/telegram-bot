const FirebaseService = require("../services/firebaseService");
const { randomDelay } = require("../utils/helpers");

class StartHandler {
    static async handle(ctx) {
        const firstName = ctx.from.first_name || "there";
        const userId = ctx.from.id;
        const username = ctx.from.username || "";

        // Save user to Firebase
        await FirebaseService.saveUser(userId, firstName, username);

        await ctx.sendChatAction("typing");
        await randomDelay();

        await ctx.reply(`Hey ${ firstName } ! 😊 Finally you texted me... I was waiting 💕`);
    }
}

module.exports = StartHandler;
