const { db } = require("../firebaseConfig");
const { doc, setDoc, getDoc, updateDoc, arrayUnion, onSnapshot, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } = require("firebase/firestore");

class FirebaseService {
    static async saveUser(userId, firstName, username) {
        try {
            const userRef = doc(db, "users", userId.toString());
            await setDoc(userRef, {
                userId: userId,
                firstName: firstName,
                username: username,
                joinedAt: new Date(),
                totalSpent: 0
            }, { merge: true });
        } catch (e) {
            console.error("Error saving user:", e);
        }
    }

    static async saveChatMessage(userId, role, content, additionalData = {}) {
        try {
            const messageData = {
                userId: userId,
                role: role,
                content: content,
                timestamp: serverTimestamp(),
                ...additionalData
            };

            await addDoc(collection(db, "chats"), messageData);
            console.log(`[${userId}] ✅ ${role === 'user' ? 'User message' : 'Bot reply'} saved to Firebase`);
        } catch (e) {
            console.error(`[${userId}] ❌ Error saving ${role} chat:`, e);
        }
    }

    static async loadUserChatHistory(userId) {
        try {
            const chatsRef = collection(db, "chats");
            const userChatsQuery = query(chatsRef, where("userId", "==", userId), orderBy("timestamp", "asc"));
            const snapshot = await getDocs(userChatsQuery);

            const history = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.content && data.role) {
                    history.push({
                        role: data.role,
                        content: data.content
                    });
                }
            });

            return history;
        } catch (error) {
            console.error(`[${userId}] ❌ Error loading chat history:`, error);
            // If query fails (no index), try without orderBy
            try {
                const chatsRef = collection(db, "chats");
                const snapshot = await getDocs(chatsRef);
                const history = [];
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.userId === userId && data.content && data.role) {
                        history.push({
                            role: data.role,
                            content: data.content,
                            timestamp: data.timestamp
                        });
                    }
                });
                // Sort by timestamp
                history.sort((a, b) => {
                    const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                    const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                    return aTime - bTime;
                });
                return history.map(h => ({ role: h.role, content: h.content }));
            } catch (e) {
                console.error(`[${userId}] ❌ Error loading chat history (fallback):`, e);
                return [];
            }
        }
    }

    static async getAllContent() {
        try {
            const contentRef = collection(db, "content");
            const snapshot = await getDocs(contentRef);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error loading content:", error);
            return [];
        }
    }

    static async getAllBaseVideos() {
        try {
            const baseVideosRef = collection(db, "base_videos");
            const snapshot = await getDocs(baseVideosRef);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error loading base videos:", error);
            return [];
        }
    }

    static async getUserSentContentUrls(userId, mediaType = null) {
        const sentUrls = new Set();
        try {
            const chatsRef = collection(db, "chats");
            const userChatsQuery = query(chatsRef, where("userId", "==", userId));
            const userChatsSnap = await getDocs(userChatsQuery);
            userChatsSnap.docs.forEach(doc => {
                const data = doc.data();
                const typeCheck = !mediaType ||
                    (mediaType === "photo" && (data.mediaType === "photo" || data.type === "photo")) ||
                    (mediaType === "video" && (data.mediaType === "video" || data.type === "video"));

                if (data.fileUrl && typeCheck) {
                    sentUrls.add(data.fileUrl);
                }
            });
        } catch (e) {
            console.log(`[${userId}] ⚠️ Could not check sent content history`);
        }
        return sentUrls;
    }

    static async recordTransaction(userId, amount, payload) {
        try {
            await addDoc(collection(db, "transactions"), {
                userId: userId,
                amount: amount,
                payload: payload,
                timestamp: serverTimestamp()
            });

            // Update total spent
            const userRef = doc(db, "users", userId.toString());
            const userSnap = await getDoc(userRef);
            let currentSpent = 0;
            if (userSnap.exists()) {
                currentSpent = userSnap.data().totalSpent || 0;
            }
            await updateDoc(userRef, {
                totalSpent: currentSpent + amount
            });
        } catch (e) {
            console.error("Error recording payment:", e);
        }
    }

    static async createCustomVideoRequest(userId, message, price) {
        try {
            await addDoc(collection(db, "custom_video_requests"), {
                userId: userId,
                message: message,
                price: price,
                status: "pending",
                createdAt: serverTimestamp()
            });
            console.log(`[${userId}] ✅ Custom video request created`);
        } catch (e) {
            console.error(`[${userId}] ❌ Error creating custom video request:`, e);
        }
    }

    static async updateCustomVideoRequestStatus(userId, amount) {
        try {
            const requestsRef = collection(db, "custom_video_requests");
            const requestsSnap = await getDocs(requestsRef);
            const userRequests = requestsSnap.docs.filter(doc =>
                doc.data().userId === userId && doc.data().status === "pending"
            );

            if (userRequests.length > 0) {
                const latestRequest = userRequests[userRequests.length - 1];
                await updateDoc(doc(db, "custom_video_requests", latestRequest.id), {
                    status: "paid",
                    paidAt: serverTimestamp(),
                    amount: amount
                });
                console.log(`[${userId}] ✅ Custom video request marked as paid`);
            }
        } catch (e) {
            console.error("Error updating custom video request:", e);
        }
    }

    static async getContentById(contentId, collectionName = "content") {
        try {
            const contentDoc = await getDoc(doc(db, collectionName, contentId));
            if (contentDoc.exists()) {
                return { id: contentDoc.id, ...contentDoc.data() };
            }
            return null;
        } catch (error) {
            console.error(`Error getting ${collectionName} by ID:`, error);
            return null;
        }
    }

    static async getPackageById(packageId) {
        try {
            const packageDoc = await getDoc(doc(db, "packages", packageId));
            if (packageDoc.exists()) {
                return { id: packageDoc.id, ...packageDoc.data() };
            }
            return null;
        } catch (error) {
            console.error("Error getting package by ID:", error);
            return null;
        }
    }

    static async getAllPackages() {
        try {
            const packagesRef = collection(db, "packages");
            const snapshot = await getDocs(packagesRef);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error loading packages:", error);
            return [];
        }
    }
}

module.exports = FirebaseService;
