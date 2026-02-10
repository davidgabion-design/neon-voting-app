// helpers.js - Utility functions for Reports module
import { db } from '../config/firebase.js';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast } from '../utils/ui-helpers.js';
import { updateECUI } from '../ec/login.js';

export async function syncVoterCounts() {
  try {
    showToast('Syncing voter counts...', 'info');
    
    const votersSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "voters"));
    let totalVoters = 0;
    votersSnap.forEach(doc => {
      const voterData = doc.data();
      if (!voterData.isReplaced) {
        totalVoters++;
      }
    });
    
    const votesSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "votes"));
    const votesCast = votesSnap.size;
    
    const orgRef = doc(db, "organizations", window.currentOrgId);
    await updateDoc(orgRef, {
      voterCount: totalVoters,
      voteCount: votesCast,
      lastSync: serverTimestamp()
    });
    
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      window.currentOrgData = { id: window.currentOrgId, ...orgSnap.data() };
      updateECUI();
    }
    
    showToast(`Synced! Total Active Voters: ${totalVoters}, Votes Cast: ${votesCast}`, 'success');
    if (typeof window.loadECOutcomes === 'function') window.loadECOutcomes();
  } catch(e) {
    console.error('Error syncing voter counts:', e);
    showToast('Error syncing counts: ' + e.message, 'error');
  }
}

export function _ensureOrgId(orgId) {
  try { 
    if (orgId) return orgId; 
  } catch(e) {}
  
  try { 
    if (window.currentOrgId) return window.currentOrgId; 
  } catch(e) {}
  
  try { 
    if (window.session && window.session.orgId) return window.session.orgId; 
  } catch(e) {}
  
  return "";
}

export function _csvDownload(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  
  const csv = rows.map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
