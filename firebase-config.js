// firebase-config.js - Environment aware config (browser-safe)
const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY || "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: env.FIREBASE_AUTH_DOMAIN || "neon-voting-app.firebaseapp.com",
  projectId: env.FIREBASE_PROJECT_ID || "neon-voting-app",
  storageBucket: env.FIREBASE_STORAGE_BUCKET || "neon-voting-app.firebasestorage.app",
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || "406871836482",
  appId: env.FIREBASE_APP_ID || "1:406871836482:web:b25063cd3829cd3dc6aadb"
  // measurementId removed - Analytics disabled to prevent cookie errors
};

// Set APP_URL for email invites - Firebase Hosting URL
window.APP_URL = window.location.origin || "https://neon-voting-app.web.app";

// Export for use in script.js
window.firebaseConfig = firebaseConfig;