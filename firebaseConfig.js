// Import the functions you need from the SDKs you need
const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const { getStorage } = require("firebase/storage");

// Your web app's Firebase configuration
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

module.exports = { db, storage };
