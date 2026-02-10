// outcomes.js - Election Results & Outcomes Display
import { db } from '../config/firebase.js';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  onSnapshot 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showQuickLoading, renderError, getDefaultAvatar, showToast } from '../utils/ui-helpers.js';
import { updateECUI } from '../ec/login.js';
import { _getCandidatesMap } from '../shared/election-utils.js';

let refreshIntervals = window.refreshIntervals || {};
window.refreshIntervals = refreshIntervals;

// Track real-time listener and initial load state
let votesUnsubscribe = null;
let isInitialLoad = true;

export async function loadECOutcomes() {
  // CANDIDATE MAP FIX
  const candMap = await _getCandidatesMap(window.currentOrgId);

  const el = document.getElementById("ecContent-outcomes");
  if (!el || !window.currentOrgId || !window.currentOrgData) return;
  
  // Get translation function
  const t = window.t || ((key) => key);
  
  showQuickLoading("ecContent-outcomes", "Loading Voting Outcomes");
  
  // Clean up old polling interval
  if (refreshIntervals.outcomes) {
    clearInterval(refreshIntervals.outcomes);
    delete refreshIntervals.outcomes;
  }
  
  // Clean up previous listener before setting new one
  if (votesUnsubscribe) {
    votesUnsubscribe();
    votesUnsubscribe = null;
  }
  
  try {
    // Set up real-time listener for votes
    const votesRef = collection(db, "organizations", window.currentOrgId, "votes");
    
    // Load positions, candidates, voters once (they change less frequently)
    const [positionsSnap, candidatesSnap, votersSnap] = await Promise.all([
      getDocs(collection(db, "organizations", window.currentOrgId, "positions")),
      getDocs(collection(db, "organizations", window.currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", window.currentOrgId, "voters"))
    ]);
    
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    const voters = [];
    votersSnap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    // Set up real-time listener on votes collection
    let debounceTimer = null;
    votesUnsubscribe = onSnapshot(votesRef, 
      (snapshot) => {
        // Show live indicator and toast for new votes (skip on initial load)
        if (!isInitialLoad && !snapshot.metadata.hasPendingWrites) {
          const addedVotes = snapshot.docChanges().filter(change => change.type === 'added');
          if (addedVotes.length > 0) {
            console.log('🔴 LIVE: Vote detected, updating outcomes...');
            showToast(`🎉 New vote received! (${addedVotes.length})`, 'success');
          }
        }
        isInitialLoad = false;
        
        // Extract votes from snapshot
        const votes = [];
        snapshot.forEach(s => votes.push(s.data()));
    
        // Debounce rendering to avoid rapid re-renders during simultaneous votes
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          renderOutcomesData(votes, positions, candidates, voters, el);
        }, 500);
      },
      (error) => {
        console.error('Real-time listener error:', error);
        showToast('Lost real-time connection. Using polling fallback.', 'error');
        // Fallback to polling on error
        loadOutcomesWithPolling();
      }
    );
    
  } catch (err) {
    console.error("Failed to load outcomes:", err);
    renderError("ecContent-outcomes", "Failed to load voting outcomes", () => loadECOutcomes());
  }
}

// Render outcomes data (extracted for reuse by real-time listener)
function renderOutcomesData(votes, positions, candidates, voters, el) {
  const totalVoters = voters.filter(v => !v.isReplaced).length;
  const votesCast = votes.length;
  const participationRate = totalVoters ? Math.round((votesCast / totalVoters) * 100) : 0;
  const remainingVoters = totalVoters - votesCast;
  
  // Add live indicator
  const liveIndicator = votesUnsubscribe ? '<span style="color:#ff4444;margin-left:10px;font-size:14px">🔴 LIVE</span>' : '';
  
  // Update org counts
  (async () => {
    try {
      const orgRef = doc(db, "organizations", window.currentOrgId);
      await updateDoc(orgRef, {
        voterCount: totalVoters,
        voteCount: votesCast
      });
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        window.currentOrgData = { id: window.currentOrgId, ...orgSnap.data() };
        updateECUI();
      }
    } catch (err) {
      console.warn("Count sync skipped:", err);
      try { updateECUI(); } catch (_) {}
    }
  })();
  
  let html = `
      <div class="card info-card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-around;text-align:center;gap:20px">
          <div>
            <div class="label">${t('active_voters')}</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${totalVoters}</div>
            <div class="subtext" style="font-size:12px">${t('excluding_replaced')}</div>
          </div>
          <div>
            <div class="label">${t('votes_cast')}</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${votesCast}</div>
            <div class="subtext" style="font-size:12px">${t('actual_votes')}</div>
          </div>
          <div>
            <div class="label">${t('participation')}</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${participationRate}%</div>
            <div class="subtext" style="font-size:12px">${votesCast}/${totalVoters}</div>
          </div>
          <div>
            <div class="label">${t('remaining')}</div>
            <div style="font-weight:bold;font-size:28px;color:#ffc107">${remainingVoters}</div>
            <div class="subtext" style="font-size:12px">${t('yet_to_vote')}</div>
          </div>
        </div>
      </div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-chart-bar"></i> ${t('results_by_position')}${liveIndicator}</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn-outline" onclick="refreshOutcomes()">
            <i class="fas fa-redo"></i> ${t('refresh')}
          </button>
          <button class="btn neon-btn" onclick="exportResultsCSV()">
            <i class="fas fa-download"></i> ${t('export_results')}
          </button>
          <button class="btn neon-btn-outline" onclick="syncVoterCounts()" title="Force Sync Voter Counts">
            <i class="fas fa-sync-alt"></i> ${t('sync_counts')}
          </button>
        </div>
      </div>
    `;
    
    if (positions.length === 0) {
      html += `
        <div class="card">
          <p class="subtext">No positions created yet. Add positions in the Positions tab.</p>
        </div>
      `;
    } else {
      positions.forEach(pos => {
        const posCandidates = candidates.filter(c => c.positionId === pos.id);
        if (posCandidates.length === 0) return;
        
        const counts = {};
        votes.forEach(v => {
          if (v.choices && v.choices[pos.id]) {
            let candId = v.choices[pos.id];
            // Handle case where candId might be an object (defensive)
            if (typeof candId === 'object' && candId !== null) {
              candId = candId.id || candId.candidateId || candId.name || String(candId);
            }
            counts[candId] = (counts[candId] || 0) + 1;
          }
        });
        
        const totalPositionVotes = Object.values(counts).reduce((a, b) => a + b, 0);
        
        html += `
          <div class="card" style="margin-bottom:20px">
            <h4 style="color:#00eaff;margin-bottom:15px">
              <i class="fas fa-chart-pie"></i> ${pos.name}
              <span class="subtext">(${totalPositionVotes} votes)</span>
            </h4>
        `;
        
        // SPECIAL CASE: Single candidate position (Yes/No voting)
        if (posCandidates.length === 1) {
          const candidate = posCandidates[0];
          // For single-candidate positions, votes are stored as 'yes' or 'no' strings
          const yesVotes = counts['yes'] || 0;
          const noVotes = counts['no'] || 0;
          const totalPositionVotesForYesNo = yesVotes + noVotes;
          // Calculate percentages based on votes actually cast, not total voters
          const yesPercentage = totalPositionVotesForYesNo ? (yesVotes / totalPositionVotesForYesNo * 100).toFixed(1) : 0;
          const noPercentage = totalPositionVotesForYesNo ? (noVotes / totalPositionVotesForYesNo * 100).toFixed(1) : 0;
          
          html += `
            <div style="margin-bottom:20px;padding:15px;border-radius:8px;background:rgba(0,255,255,0.05);border:1px solid rgba(0,255,255,0.1)">
              <div style="margin-bottom:15px;font-weight:bold;color:#00eaff">Total votes: ${totalPositionVotesForYesNo}</div>
              
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;border-radius:8px;background:rgba(0,255,170,0.1);border-left:4px solid #00ffaa">
                <img src="${candidate.photo || getDefaultAvatar(candidate.name)}" 
                     style="width:50px;height:50px;border-radius:8px;object-fit:cover;border:2px solid rgba(0,255,255,0.2)">
                <div style="flex:1">
                  <div>
                    <strong>${candidate.name}</strong>
                    <span class="subtext" style="margin-left:8px">${yesVotes} vote(s) (${yesPercentage}%)</span>
                  </div>
                  ${candidate.tagline ? `<div class="subtext" style="margin-top:4px;font-size:12px">${candidate.tagline}</div>` : ''}
                </div>
                <div style="width:120px">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${yesPercentage}%;background:#00ffaa"></div>
                  </div>
                </div>
              </div>
              
              <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;background:rgba(255,107,107,0.05);border-left:4px solid #ff6b6b">
                <div style="width:50px;height:50px;border-radius:8px;background:rgba(255,107,107,0.2);display:flex;align-items:center;justify-content:center;color:#ff6b6b;font-weight:bold;font-size:20px">
                  <i class="fas fa-times"></i>
                </div>
                <div style="flex:1">
                  <div>
                    <strong style="color:#ff6b6b">NO (against ${candidate.name})</strong>
                    <span class="subtext" style="margin-left:8px">${noVotes} vote(s) (${noPercentage}%)</span>
                  </div>
                </div>
                <div style="width:120px">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${noPercentage}%;background:#ff6b6b"></div>
                  </div>
                </div>
              </div>
            </div>
          `;
        } else {
          // NORMAL CASE: Multiple candidates
          const sortedCandidates = [...posCandidates].sort((a, b) => {
            return (counts[b.id] || 0) - (counts[a.id] || 0);
          });
          
          sortedCandidates.forEach((candidate, index) => {
            const candidateVotes = counts[candidate.id] || 0;
            const percentage = totalPositionVotes ? Math.round((candidateVotes / totalPositionVotes) * 100) : 0;
            const isLeading = index === 0 && candidateVotes > 0;
            
            html += `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;border-radius:8px;background:${isLeading ? 'rgba(0,255,170,0.1)' : 'rgba(255,255,255,0.02)'};border-left:4px solid ${isLeading ? '#00ffaa' : 'transparent'}">
                <span style="color:#888;min-width:20px">#${index + 1}</span>
                <img src="${candidate.photo || getDefaultAvatar(candidate.name)}" 
                     style="width:50px;height:50px;border-radius:8px;object-fit:cover;border:2px solid rgba(0,255,255,0.2)">
                <div style="flex:1">
                  <strong>${candidate.name}</strong>
                  ${candidate.tagline ? `<div class="subtext">${candidate.tagline}</div>` : ''}
                  <div class="subtext" style="margin-top:4px">${candidateVotes} votes • ${percentage}%</div>
                </div>
                <div style="width:120px">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${percentage}%"></div>
                  </div>
                </div>
              </div>
            `;
          });
          
          if (sortedCandidates.length > 1 && totalPositionVotes > 0) {
            const leadingCandidate = sortedCandidates[0];
            const secondCandidate = sortedCandidates[1];
            const leadingVotes = counts[leadingCandidate.id] || 0;
            const secondVotes = counts[secondCandidate.id] || 0;
            const lead = leadingVotes - secondVotes;
            
            html += `
              <div style="margin-top:15px;padding:12px;border-radius:8px;background:rgba(0,255,255,0.05);border:1px solid rgba(0,255,255,0.1)">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <strong style="color:#00eaff">Current Leader:</strong>
                    <div style="margin-top:4px">${leadingCandidate.name}</div>
                    <div class="subtext">${leadingVotes} votes</div>
                  </div>
                  ${lead > 0 ? `
                    <div style="color:#00ffaa;font-weight:bold;font-size:18px">
                      <i class="fas fa-trophy"></i> +${lead} vote${lead === 1 ? '' : 's'}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }
        }
        
        html += `</div>`;
      });
    }
    
  el.innerHTML = html;
}

// Fallback polling function if real-time listener fails
function loadOutcomesWithPolling() {
  if (votesUnsubscribe) {
    votesUnsubscribe();
    votesUnsubscribe = null;
  }
  
  if (refreshIntervals.outcomes) {
    clearInterval(refreshIntervals.outcomes);
  }
  
  refreshIntervals.outcomes = setInterval(() => {
    if (window.activeTab === 'outcomes') {
      loadECOutcomesSnapshot();
    }
  }, 10000); // 10 second fallback polling
  
  // Immediate load
  loadECOutcomesSnapshot();
}

// Snapshot-based load for polling fallback
async function loadECOutcomesSnapshot() {
  const el = document.getElementById("ecContent-outcomes");
  if (!el || !window.currentOrgId) return;
  
  try {
    const [votesSnap, positionsSnap, candidatesSnap, votersSnap] = await Promise.all([
      getDocs(collection(db, "organizations", window.currentOrgId, "votes")),
      getDocs(collection(db, "organizations", window.currentOrgId, "positions")),
      getDocs(collection(db, "organizations", window.currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", window.currentOrgId, "voters"))
    ]);
    
    const votes = [];
    votesSnap.forEach(s => votes.push(s.data()));
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    const voters = [];
    votersSnap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    renderOutcomesData(votes, positions, candidates, voters, el);
  } catch (err) {
    console.error("Polling fallback error:", err);
  }
}

// Cleanup function for real-time listener
export function cleanupOutcomesListener() {
  if (votesUnsubscribe) {
    votesUnsubscribe();
    votesUnsubscribe = null;
  }
  if (refreshIntervals.outcomes) {
    clearInterval(refreshIntervals.outcomes);
    delete refreshIntervals.outcomes;
  }
  isInitialLoad = true;
}

export function refreshOutcomes() {
  loadECOutcomes();
  showToast("Outcomes refreshed", "success");
}

// Global wrapper for inline onclick handlers
window.refreshOutcomes = async function () {
  try {
    await window.firebaseReady;

    // Best-effort org id discovery
    const params = new URLSearchParams(window.location.search);
    const orgFromUrl = params.get("org");
    const orgId =
      window.CURRENT_ORG_ID ||
      window.currentOrgId ||
      window.EC_STATE?.orgId ||
      window.ORG_ID ||
      orgFromUrl;

    if (!orgId) {
      console.warn("refreshOutcomes: orgId not found");
      return;
    }

    if (typeof window.loadResultsByPosition === "function") {
      return await window.loadResultsByPosition(orgId, { readOnly: false });
    }

    if (typeof window.loadECOutcomes === "function") {
      return await window.loadECOutcomes(orgId);
    }

    console.warn("refreshOutcomes: no outcomes loader found");
  } catch (err) {
    console.error("refreshOutcomes failed:", err);
  }
};
