// actions.js - Election Actions (Declare, Reset, Clear, Public Link)
import { db, storage } from '../config/firebase.js';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  writeBatch,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { 
  ref as storageRef, 
  deleteObject 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';
import { showToast, createModal } from '../utils/ui-helpers.js';

export async function generatePublicLink() {
  try {
    const publicToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const orgRef = doc(db, "organizations", window.currentOrgId);
    await updateDoc(orgRef, {
      publicEnabled: true,
      publicToken: publicToken,
      publicLink: `${window.location.origin}${window.location.pathname}?org=${window.currentOrgId}&token=${publicToken}`
    });
    
    showToast('Public link generated!', 'success');
    if (typeof window.loadECSettings === 'function') window.loadECSettings();
  } catch(e) {
    console.error('Error generating link:', e);
    showToast('Error generating link: ' + e.message, 'error');
  }
}

export function copyPublicLink() {
  const link = `${window.location.origin}${window.location.pathname}?org=${window.currentOrgId}&token=${window.currentOrgData?.publicToken}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copied to clipboard!', 'success');
  });
}

export function declareResultsConfirm() {
  const modal = createModal(
    '<i class="fas fa-flag-checkered"></i> Declare Final Results',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #9D00FF; margin-bottom: 20px;">
          <i class="fas fa-flag"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Declare Final Results?</h3>
        <p style="color: #9beaff; margin-bottom: 20px;">
          This will lock voting and mark the election as completed. Voters will no longer be able to vote.
        </p>
        <div style="background: rgba(157, 0, 255, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(157, 0, 255, 0.3);">
          <div style="color: #9D00FF; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> Note: This action cannot be reversed!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="declareResults()" style="flex: 1; background: linear-gradient(90deg, #9D00FF, #00C3FF);">
        <i class="fas fa-flag"></i> Declare Results
      </button>
    `
  );
}

export async function declareResults() {
  try {
    const orgRef = doc(db, "organizations", window.currentOrgId);
    await updateDoc(orgRef, {
      electionStatus: 'declared',
      resultsDeclaredAt: serverTimestamp()
    });
    
    showToast('Results declared successfully! Voting is now locked.', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECSettings();
  } catch(e) {
    console.error('Error declaring results:', e);
    showToast('Error declaring results: ' + e.message, 'error');
  }
}

export function resetVotesConfirm() {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Reset All Votes',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff9800; margin-bottom: 20px;">
          <i class="fas fa-undo"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Reset All Votes?</h3>
        <p style="color: #ffcc80; margin-bottom: 20px;">
          This will reset all votes to zero. Voters will be able to vote again.
        </p>
        <div style="background: rgba(255, 152, 0, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 152, 0, 0.3);">
          <div style="color: #ff9800; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> All vote counts will be reset to zero!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-warning" onclick="resetAllVotes()" style="flex: 1">
        <i class="fas fa-undo"></i> Reset Votes
      </button>
    `
  );
}

export async function resetAllVotes() {
  try {
    const candidatesSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "candidates"));
    const batch = writeBatch(db);
    
    candidatesSnap.forEach(doc => {
      batch.update(doc.ref, { votes: 0 });
    });
    
    const votesSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "votes"));
    votesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    const votersSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "voters"));
    votersSnap.forEach(doc => {
      const voterData = doc.data();
      if (!voterData.isReplaced) {
        batch.update(doc.ref, { 
          hasVoted: false,
          votedAt: null 
        });
      }
    });
    
    const orgRef = doc(db, "organizations", window.currentOrgId);
    batch.update(orgRef, { voteCount: 0 });
    
    await batch.commit();
    
    showToast('All votes reset successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    if (typeof window.loadECSettings === 'function') window.loadECSettings();
    if (typeof window.loadECOutcomes === 'function') window.loadECOutcomes();
  } catch(e) {
    console.error('Error resetting votes:', e);
    showToast('Error resetting votes: ' + e.message, 'error');
  }
}

export function clearAllDataConfirm() {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Clear All Election Data',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-trash-alt"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Clear ALL Election Data?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will delete ALL data: Voters, Candidates, Positions, and Votes. The election will be completely reset.
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3);">
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> WARNING: This action cannot be undone!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="clearAllData()" style="flex: 1">
        <i class="fas fa-trash-alt"></i> Clear All Data
      </button>
    `
  );
}

export async function clearAllData() {
  try {
    showToast('Clearing all data...', 'info');
    
    const votesSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "votes"));
    const batch1 = writeBatch(db);
    votesSnap.forEach(doc => {
      batch1.delete(doc.ref);
    });
    await batch1.commit();
    
    const candidatesSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "candidates"));
    const batch2 = writeBatch(db);
    const deletePhotoPromises = [];
    
    candidatesSnap.forEach(doc => {
      const candidate = doc.data();
      batch2.delete(doc.ref);
      
      if (candidate.photo && !candidate.photo.includes('data:image/svg+xml')) {
        try {
          const photoRef = storageRef(storage, candidate.photo);
          deletePhotoPromises.push(deleteObject(photoRef));
        } catch(photoError) {
          console.warn('Could not delete candidate photo:', photoError);
        }
      }
    });
    await batch2.commit();
    await Promise.all(deletePhotoPromises);
    
    const positionsSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "positions"));
    const batch3 = writeBatch(db);
    positionsSnap.forEach(doc => {
      batch3.delete(doc.ref);
    });
    await batch3.commit();
    
    const votersSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "voters"));
    const batch4 = writeBatch(db);
    votersSnap.forEach(doc => {
      batch4.delete(doc.ref);
    });
    await batch4.commit();
    
    const orgRef = doc(db, "organizations", window.currentOrgId);
    await updateDoc(orgRef, {
      voterCount: 0,
      voteCount: 0,
      electionSettings: {},
      electionStatus: 'active',
      publicEnabled: false,
      publicToken: null,
      publicLink: null,
      resultsDeclaredAt: null
    });
    
    showToast('All election data cleared successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    if (typeof window.loadECSettings === 'function') window.loadECSettings();
    
    if (typeof window.loadECVoters === 'function') window.loadECVoters();
    if (typeof window.loadECPositions === 'function') window.loadECPositions();
    if (typeof window.loadECCandidates === 'function') window.loadECCandidates();
    if (typeof window.loadECOutcomes === 'function') window.loadECOutcomes();
  } catch(e) {
    console.error('Error clearing data:', e);
    showToast('Error clearing data: ' + e.message, 'error');
  }
}
