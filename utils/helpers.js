// Estimate token count (rough: 1 token ≈ 4 characters)
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

// Random delay between 1.5-3 seconds (feels human)
function randomDelay() {
    return new Promise((resolve) => {
        const delay = Math.floor(Math.random() * 1500) + 1500;
        setTimeout(resolve, delay);
    });
}

// 1 minute delay before replying (makes bot seem more human)
function replyDelay() {
    return new Promise((resolve) => {
        const delay = 60 * 1000; // 1 minute = 60000 milliseconds
        console.log(`⏳ Waiting 1 minute before replying...`);
        setTimeout(resolve, delay);
    });
}

// Handle different timestamp formats
function parseTimestamp(data) {
    let timestamp;

    if (data.timestamp) {
        // Firestore Timestamp object (has toDate method)
        if (data.timestamp.toDate && typeof data.timestamp.toDate === 'function') {
            timestamp = data.timestamp.toDate();
        }
        // Already a Date object
        else if (data.timestamp instanceof Date) {
            timestamp = data.timestamp;
        }
        // String date
        else if (typeof data.timestamp === 'string') {
            timestamp = new Date(data.timestamp);
        }
        // Firestore Timestamp with seconds property
        else if (data.timestamp.seconds) {
            timestamp = new Date(data.timestamp.seconds * 1000);
        }
        // Number (milliseconds)
        else if (typeof data.timestamp === 'number') {
            timestamp = new Date(data.timestamp);
        }
        else {
            timestamp = new Date();
        }
    } else {
        // Fallback to current time if no timestamp
        timestamp = new Date();
    }

    return timestamp;
}

module.exports = {
    estimateTokens,
    randomDelay,
    replyDelay,
    parseTimestamp
};
