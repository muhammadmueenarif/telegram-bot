import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyAQIamulztL-0FYMCpUTqXcXXWL9cXqqOE",
    authDomain: "ai-crypto-97ae9.firebaseapp.com",
    projectId: "ai-crypto-97ae9",
    storageBucket: "ai-crypto-97ae9.firebasestorage.app",
    messagingSenderId: "416160516722",
    appId: "1:416160516722:web:11b480063229e0ad9d50eb",
    measurementId: "G-PYG48MH9JN"
};

// Initialize Firebase
let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
