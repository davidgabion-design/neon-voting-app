/**
 * Fix Organization Approval Status
 * 
 * This script updates organizations that are stuck in 'pending' approval status
 * back to 'draft' so ECs can set up their elections.
 * 
 * Run this in Firebase Console > Firestore > Query:
 * 1. Select 'organizations' collection
 * 2. Where: approval.status == 'pending'
 * 3. For each result, manually edit approval.status to 'draft'
 * 
 * OR run this via Node.js with Firebase Admin SDK:
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (replace with your service account)
const serviceAccount = require('./path-to-your-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixApprovalStatus() {
  try {
    console.log('Searching for organizations with pending approval...');
    
    const orgsSnapshot = await db.collection('organizations')
      .where('approval.status', '==', 'pending')
      .get();
    
    if (orgsSnapshot.empty) {
      console.log('No organizations found with pending approval.');
      return;
    }
    
    console.log(`Found ${orgsSnapshot.size} organizations to fix.`);
    
    const batch = db.batch();
    
    orgsSnapshot.forEach(orgDoc => {
      const orgRef = db.collection('organizations').doc(orgDoc.id);
      batch.update(orgRef, {
        'approval.status': 'draft',
        'approval.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        'updatedAt': admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  - Queued update for: ${orgDoc.id}`);
    });
    
    await batch.commit();
    console.log('✅ All organizations updated successfully!');
    console.log('ECs can now set up their elections without restrictions.');
    
  } catch (error) {
    console.error('Error fixing approval status:', error);
  }
}

fixApprovalStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
