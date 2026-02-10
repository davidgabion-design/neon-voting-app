/**
 * One-time script to fix existing voter phone numbers in Firestore
 * Run this in the browser console on your EC dashboard
 */

async function fixAllVoterPhoneNumbers() {
  if (!window.currentOrgId || !window.db) {
    console.error('❌ Please open EC Dashboard first and login to an organization');
    return;
  }

  console.log('🔧 Starting phone number fix for org:', window.currentOrgId);
  
  try {
    const { collection, getDocs, updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    
    const votersRef = collection(window.db, 'organizations', window.currentOrgId, 'voters');
    const snapshot = await getDocs(votersRef);
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`📊 Found ${snapshot.size} voters to check`);

    for (const voterDoc of snapshot.docs) {
      const data = voterDoc.data();
      const phone = data.phone;
      
      if (!phone || phone.startsWith('+')) {
        skipped++;
        continue; // Already correct or empty
      }

      // Normalize phone to E.164
      let normalized = phone.replace(/[\s\-\(\)]/g, ''); // Remove spaces
      
      if (normalized.startsWith('tel:')) {
        normalized = normalized.substring(4); // Remove tel: prefix
      }
      
      if (normalized.startsWith('233')) {
        normalized = '+' + normalized; // Add + prefix
      } else if (normalized.startsWith('0')) {
        normalized = '+233' + normalized.substring(1); // Replace 0 with +233
      } else if (!normalized.startsWith('+')) {
        normalized = '+233' + normalized; // Assume Ghana
      }

      try {
        const voterRef = doc(window.db, 'organizations', window.currentOrgId, 'voters', voterDoc.id);
        await updateDoc(voterRef, { phone: normalized });
        console.log(`✅ Fixed ${data.name}: ${phone} → ${normalized}`);
        fixed++;
      } catch (err) {
        console.error(`❌ Error fixing ${data.name}:`, err.message);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Fixed: ${fixed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('\n🎉 Done! Refresh the page to see updated phone numbers.');
    
  } catch (err) {
    console.error('❌ Script error:', err);
  }
}

// Make function available globally
window.fixAllVoterPhoneNumbers = fixAllVoterPhoneNumbers;

console.log('✅ Fix script loaded! Run: fixAllVoterPhoneNumbers()');
