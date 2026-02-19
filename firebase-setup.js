// Run this once in browser console to set up Firebase collections

// ⚠️ SECURITY NOTE:
// This file is intentionally a template. Do not commit real credentials or default passwords.

const SUPER_ADMIN_EMAIL = "your-super-admin@example.com";
const SUPER_ADMIN_PASSWORD = "CHANGE_ME";
const TEST_EC_PASSWORD = "CHANGE_ME";

const firebaseConfig = {
    apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
    authDomain: "neon-voting-app.firebaseapp.com",
    projectId: "neon-voting-app",
    storageBucket: "neon-voting-app.firebasestorage.app",
    messagingSenderId: "406871836482",
    appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
    measurementId: "G-VGW2Z3FR8M"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Create super admin
async function setupSuperAdmin() {
    try {
        await db.collection("meta").doc("superAdmin").set({
            password: SUPER_ADMIN_PASSWORD,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            email: SUPER_ADMIN_EMAIL
        });
        console.log("✅ Super Admin created");
        console.log("📧 Email:", SUPER_ADMIN_EMAIL);
        console.log("🔑 Password:", SUPER_ADMIN_PASSWORD);
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

// Create test organization
async function createTestOrg() {
    try {
        const orgId = "test-election-" + Date.now().toString(36).substr(2, 8);
        
        await db.collection("organizations").doc(orgId).set({
            id: orgId,
            name: "Test University Elections 2024",
            description: "Annual student council elections",
            ecPassword: TEST_EC_PASSWORD,
            voterCount: 0,
            voteCount: 0,
            electionStatus: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: 'superadmin'
        });
        
        console.log(`✅ Test organization created: ${orgId}`);
        console.log(`🔑 EC Password: ${TEST_EC_PASSWORD}`);
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

// Run setup
setupSuperAdmin();
createTestOrg();