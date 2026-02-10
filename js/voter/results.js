/**
 * Voter Module - Results
 * Handles vote submission, post-vote dashboard, and live results
 */

import { db } from '../config/firebase.js';
import { 
  doc, 
  getDoc, 
  writeBatch, 
  serverTimestamp, 
  increment 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showScreen } from '../utils/ui-helpers.js';
import { escapeHtml } from '../utils/validation.js';
import { saveSession } from '../utils/session.js';
import { writeAudit } from '../features/audit.js';
import { getSelectedCandidates, clearSelectedCandidates } from './voting.js';

// Module state
let voterSession = null;
let session = {};
let voterCountdownInterval = null;

/**
 * Submit voter's ballot
 */
export async function submitVote() {
  if (!voterSession) {
    showToast('Voter session not found. Please login again.', 'error');
    showScreen('voterLoginScreen');
    return;
  }

  const selectedCandidates = getSelectedCandidates();

  // Validate selections
  const positions = document.querySelectorAll('.position-card');
  let isValid = true;
  let validationMessage = '';

  positions.forEach(position => {
    const positionId = position.dataset.positionId;
    const selectedCount = selectedCandidates[positionId]?.length || 0;

    // Require at least 1 selection per position
    if (selectedCount === 0) {
      isValid = false;
      validationMessage = 'Please make a selection for all positions before submitting.';
    }

    // Enforce single-choice if inputs are radios (or YES/NO)
    const hasRadio = position.querySelector('input[type="radio"]');
    if (hasRadio && selectedCount > 1) {
      isValid = false;
      validationMessage = 'Only one selection is allowed for some positions.';
    }
  });

  if (!isValid) {
    showToast(validationMessage || 'Please complete your ballot.', 'error');
    return;
  }

  if (!confirm('Submit your vote? This action cannot be undone.')) return;

  try {
    const batch = writeBatch(db);

    // Use canonical vote doc id = voterKey (prevents double voting)
    const voteDocId = voterSession.voterKey || voterSession.voterDocId;
    const voteRef = doc(db, "organizations", voterSession.orgId, "votes", voteDocId);

    // prevent overwrite
    const existingVote = await getDoc(voteRef);
    if (existingVote.exists()) {
      showToast('A vote for this voter already exists.', 'warning');
      return;
    }

    // Flatten choices: store as { positionId: choice } when single, or array when multi
    // Ensure we only store candidate IDs as strings, not objects
    const choices = {};
    Object.keys(selectedCandidates).forEach(pid => {
      const arr = selectedCandidates[pid] || [];
      // Convert any objects to their ID property or string value
      const cleanArr = arr.map(item => {
        if (typeof item === 'object' && item !== null) {
          return item.id || item.candidateId || String(item);
        }
        return String(item);
      });
      choices[pid] = cleanArr.length <= 1 ? (cleanArr[0] || null) : cleanArr;
    });

    const voteData = {
      voterKey: voteDocId,
      voterId: voteDocId,
      voterEmail: voterSession.email || "",
      voterPhone: voterSession.phone || "",
      voterName: voterSession.voterData?.name || voterSession.email || voterSession.phone || "Voter",
      choices,
      votedAt: serverTimestamp(),
      userAgent: navigator.userAgent
    };

    batch.set(voteRef, voteData);

    // Update voter status (canonical voter doc)
    const voterDocId = voterSession.voterDocId || encodeURIComponent(voterSession.email || "");
    const voterRef = doc(db, "organizations", voterSession.orgId, "voters", voterDocId);
    batch.update(voterRef, { hasVoted: true, votedAt: serverTimestamp() });

    // Update org vote count (best-effort)
    const orgRef = doc(db, "organizations", voterSession.orgId);
    batch.update(orgRef, { voteCount: increment(1) });

    await batch.commit();

    await writeAudit(voterSession.orgId, "VOTE_SUBMITTED", voteDocId, { positions: Object.keys(choices).length });

    // Clear voter session (in-memory and sessionStorage)
    voterSession = null;
    clearSelectedCandidates();
    session.voterSession = null;
    saveSession();
    
    // Clear sessionStorage to prevent auto-restore
    sessionStorage.removeItem('voterViewMode');
    sessionStorage.removeItem('voterOrgId');
    sessionStorage.removeItem('voterData');

    showToast('✅ Vote submitted successfully!', 'success');
    showScreen('gatewayScreen');
  } catch (error) {
    console.error('Error submitting vote:', error);
    showToast('Failed to submit vote. Please try again.', 'error');
  }
}

/**
 * Show vote success screen
 */
export function showVoteSuccess() {
  const screen = document.getElementById('votingScreen');
  if (!screen) return;
  
  screen.innerHTML = `
    <div class="vote-success">
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h2>Vote Submitted Successfully!</h2>
      <p>Thank you for participating in the election.</p>
      <div class="success-details">
        <div class="detail-item">
          <span class="label">Time:</span>
          <span class="value">${new Date().toLocaleString()}</span>
        </div>
        <div class="detail-item">
          <span class="label">Voter:</span>
          <span class="value">${voterSession?.email || 'Unknown'}</span>
        </div>
      </div>
      <div class="success-actions">
        <button class="btn neon-btn-outline" onclick="window.showScreen('voterLoginScreen')">
          <i class="fas fa-redo"></i> Vote Again
        </button>
        <button class="btn neon-btn" onclick="window.showScreen('gatewayScreen')">
          <i class="fas fa-home"></i> Return Home
        </button>
      </div>
    </div>
  `;
}

/**
 * Show already voted screen
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name
 * @param {Object} voter - Voter data
 */
export function showAlreadyVotedScreen(orgId, orgName, voter) {
  try {
    const sub = document.getElementById('alreadyVotedSubtext');
    const title = document.getElementById('alreadyVotedTitle');
    const details = document.getElementById('alreadyVotedDetails');

    if (title) title.textContent = 'You already voted';
    if (sub) sub.textContent = `Our system shows you have already submitted your vote for ${orgName || 'this election'}.`;
    if (details) {
      const votedAt = voter?.votedAt ? new Date(voter.votedAt) : null;
      details.innerHTML = `
        <div style="text-align:left; margin-top:16px; padding:14px; border-radius:14px; border:1px solid rgba(0,255,255,0.10); background:rgba(255,255,255,0.03)">
          <div style="font-size:12px; opacity:0.8; margin-bottom:6px"><i class="fas fa-building"></i> Organization</div>
          <div style="font-weight:700">${escapeHtml(orgName || orgId || '')}</div>

          <div style="height:10px"></div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
            <div>
              <div style="font-size:12px; opacity:0.8"><i class="fas fa-id-card"></i> Voter ID</div>
              <div style="font-weight:700">${escapeHtml(voter?.voterId || voter?.id || '')}</div>
            </div>
            <div>
              <div style="font-size:12px; opacity:0.8"><i class="fas fa-clock"></i> Voted At</div>
              <div style="font-weight:700">${votedAt ? votedAt.toLocaleString() : 'Recorded'}</div>
            </div>
          </div>
        </div>
      `;
    }

    // Store minimal session so "Back" can return to voter login with org prefilled
    try {
      session.lastVoterOrg = orgId || '';
      saveSession();
    } catch(e) {}

    showScreen('alreadyVotedScreen');
  } catch (e) {
    console.error('showAlreadyVotedScreen error:', e);
    showToast('You have already voted.', 'error');
  }
}

/**
 * Start countdown timer for voting
 * @param {string} endTime - Election end time
 */
export function startVoterCountdown(endTime) {
  if (!endTime) return;
  
  const endDate = new Date(endTime);
  const now = new Date();
  
  if (endDate <= now) {
    showToast('Voting has ended', 'error');
    showScreen('voterLoginScreen');
    return;
  }
  
  // Create countdown container if it doesn't exist
  let countdownContainer = document.getElementById('countdown-container');
  if (!countdownContainer) {
    countdownContainer = document.createElement('div');
    countdownContainer.id = 'countdown-container';
    countdownContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 255, 255, 0.2);
      border-radius: 12px;
      padding: 12px 20px;
      color: white;
      z-index: 1000;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(countdownContainer);
  }
  
  function updateCountdown() {
    const now = new Date();
    const diff = endDate - now;
    
    if (diff <= 0) {
      countdownContainer.innerHTML = `
        <i class="fas fa-hourglass-end" style="color: #ff4444;"></i>
        <span style="color: #ff4444;">Voting Ended</span>
      `;
      clearInterval(voterCountdownInterval);
      
      // Auto-submit if voting in progress
      if (document.getElementById('submitVoteBtn') && !document.getElementById('submitVoteBtn').disabled) {
        showToast('Voting time has ended. Submitting your vote...', 'warning');
        setTimeout(() => submitVote(), 1000);
      }
      
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    countdownContainer.innerHTML = `
      <i class="fas fa-clock" style="color: #00eaff;"></i>
      <span style="color: ${hours < 1 ? '#ff9800' : '#00ffaa'}">
        ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}
      </span>
      <span class="subtext" style="font-size: 12px; color: #9beaff;">Remaining</span>
    `;
  }
  
  updateCountdown();
  voterCountdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Show voter live dashboard with election results
 * @param {string} orgId - Organization ID
 * @param {Object} voterData - Voter data
 */
export async function showVoterLiveDashboard(orgId, voterData) {
  try {
    // Use provided params or fall back to stored session
    orgId = orgId || window.currentOrgId;
    voterData = voterData || window.voterData;
    
    if (!orgId) {
      console.error('No organization ID available for dashboard');
      showToast('Session expired. Please login again.', 'error');
      showScreen('voterLoginScreen');
      return;
    }
    
    // Ensure Firebase is ready
    if (window.firebaseReady) await window.firebaseReady;

    // Show the enhanced alreadyVotedScreen
    if (typeof window.showScreen === "function") {
      window.showScreen("alreadyVotedScreen");
    } else {
      document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
      document.getElementById("alreadyVotedScreen")?.classList.remove("hidden");
    }

    // Load org data and stats
    const orgSnap = await getDoc(doc(db, "organizations", orgId));
    const org = orgSnap.exists() ? orgSnap.data() : {};
    
    const voterCount = org.voterCount || 0;
    const voteCount = org.voteCount || 0;
    const electionStatus = org.electionStatus || "active";

    // Update voter details display
    const detailsEl = document.getElementById("alreadyVotedDetails");
    if (detailsEl && voterData) {
      const votedAt = voterData?.votedAt ? (voterData.votedAt.toDate ? voterData.votedAt.toDate() : new Date(voterData.votedAt)) : null;
      detailsEl.innerHTML = `
        <div style="text-align:left; margin-top:16px; padding:14px; border-radius:14px; border:1px solid rgba(0,255,255,0.10); background:rgba(255,255,255,0.03)">
          <div style="font-size:12px; opacity:0.8; margin-bottom:6px"><i class="fas fa-building"></i> Organization</div>
          <div style="font-weight:700">${escapeHtml(org.name || orgId || '')}</div>

          <div style="height:10px"></div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
            <div>
              <div style="font-size:12px; opacity:0.8"><i class="fas fa-id-card"></i> Voter ID</div>
              <div style="font-weight:700">${escapeHtml(voterData?.name || voterData?.voterId || voterData?.id || '')}</div>
            </div>
            <div>
              <div style="font-size:12px; opacity:0.8"><i class="fas fa-clock"></i> Voted At</div>
              <div style="font-weight:700">${votedAt ? votedAt.toLocaleString() : 'Recorded'}</div>
            </div>
          </div>
        </div>
      `;
    }

    // Display view counter if voting has ended
    const now = new Date();
    let votingEnded = false;
    if (org.electionSettings?.endTime) {
      const endTime = new Date(org.electionSettings.endTime);
      votingEnded = endTime <= now;
    }

    if (votingEnded && voterData) {
      const viewCounterNotice = document.getElementById('viewCounterNotice');
      const viewCounterText = document.getElementById('viewCounterText');
      const viewLimit = 10;
      const currentViews = voterData?.postVoteLoginCount || 0;
      const remaining = viewLimit - currentViews;

      if (viewCounterNotice && viewCounterText) {
        viewCounterNotice.style.display = 'block';
        if (remaining > 3) {
          viewCounterText.innerHTML = `You have <strong>${remaining} views remaining</strong> to check election results`;
        } else if (remaining > 0) {
          viewCounterText.innerHTML = `<strong style="color:var(--accent-warning)">${remaining} views remaining</strong> - Contact EC for more access`;
          viewCounterText.style.color = 'var(--accent-warning)';
        } else {
          viewCounterText.innerHTML = `<strong style="color:var(--accent-danger)">No views remaining</strong> - Contact EC for access`;
          viewCounterText.style.color = 'var(--accent-danger)';
        }
      }
    }

    // 1️⃣ Render live turnout progress bar
    renderVoterTurnout(voteCount, voterCount);

    // 2️⃣ Update election status banner
    updateVoterStatusBanner(electionStatus);

    // 3️⃣ Load and render results (if declared)
    await loadVoterResults(orgId, org);

    // 4️⃣ Enable PDF download (if results declared)
    enableVoterPdfDownload(orgId, org);

    // Store session for refresh
    window.currentOrgId = orgId;
    window.currentOrgData = org;

    // Auto-refresh every 15 seconds for live updates
    clearInterval(window.__voterLiveTimer);
    window.__voterLiveTimer = setInterval(async () => {
      try {
        const orgSnap2 = await getDoc(doc(db, "organizations", orgId));
        if (orgSnap2.exists()) {
          const org2 = orgSnap2.data();
          renderVoterTurnout(org2.voteCount || 0, org2.voterCount || 0);
          updateVoterStatusBanner(org2.electionStatus || "active");
          await loadVoterResults(orgId, org2);
          enableVoterPdfDownload(orgId, org2);
        }
      } catch (e) {
        console.error("Auto-refresh error:", e);
      }
    }, 15000);

  } catch (err) {
    console.error("showVoterLiveDashboard failed:", err);
    showToast("Failed to load dashboard. Please refresh.", "error");
  }
}

/**
 * Render live turnout progress bar
 */
function renderVoterTurnout(votesCount, eligibleCount) {
  const pct = eligibleCount > 0 ? Math.round((votesCount / eligibleCount) * 100) : 0;

  const textEl = document.getElementById('turnoutText');
  const fillEl = document.getElementById('turnoutFill');
  const votesEl = document.getElementById('turnoutVotes');
  const eligibleEl = document.getElementById('turnoutEligible');

  if (textEl) textEl.textContent = `${pct}% voter turnout`;
  if (fillEl) fillEl.style.width = `${Math.min(100, pct)}%`;
  if (votesEl) votesEl.textContent = `${votesCount} votes cast`;
  if (eligibleEl) eligibleEl.textContent = `${eligibleCount} eligible voters`;
}

/**
 * Update election status banner
 */
function updateVoterStatusBanner(status) {
  const bannerEl = document.getElementById('voterStatusBanner');
  const statusEl = document.getElementById('voterLiveStatus');
  
  if (!bannerEl || !statusEl) return;

  const statusMap = {
    'pending_approval': { icon: 'hourglass-half', text: 'Election awaiting approval', class: 'pending' },
    'active': { icon: 'sync', text: '🟢 Voting in progress — Live updates', class: 'active' },
    'ended': { icon: 'flag-checkered', text: '🏁 Voting has ended', class: 'ended' },
    'declared': { icon: 'chart-bar', text: '✅ Results have been declared', class: 'active' }
  };

  const config = statusMap[status] || statusMap['active'];
  
  bannerEl.className = `status-banner ${config.class}`;
  statusEl.innerHTML = `<i class="fas fa-${config.icon}"></i> ${config.text}`;
}

/**
 * Load and display voter results (when declared)
 */
async function loadVoterResults(orgId, org) {
  const resultsSection = document.getElementById('voterResultsSection');
  const resultsContainer = document.getElementById('voterLiveResultsContainer');
  
  if (!resultsSection || !resultsContainer) return;

  if (org.electionStatus === 'declared') {
    resultsSection.style.display = 'block';
    
    try {
      // Reuse EC outcomes rendering logic
      window.currentOrgId = orgId;
      window.currentOrgData = org;

      if (typeof window.loadECOutcomes === 'function') {
        await window.loadECOutcomes();
        const sourceContent = document.getElementById('ecContent-outcomes');
        if (sourceContent) {
          resultsContainer.innerHTML = sourceContent.innerHTML;
        } else {
          resultsContainer.innerHTML = '<div class="subtext">Results are being compiled...</div>';
        }
      } else {
        resultsContainer.innerHTML = '<div class="subtext">Results loading system not available.</div>';
      }
    } catch (e) {
      console.error("Results load error:", e);
      resultsContainer.innerHTML = '<div class="subtext">Results will appear here when declared.</div>';
    }
  } else {
    resultsSection.style.display = 'none';
  }
}

/**
 * Enable PDF download button (when results declared)
 */
function enableVoterPdfDownload(orgId, org) {
  const btn = document.getElementById("btnVoterPDF");
  if (!btn) return;

  if (org.electionStatus === 'declared') {
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

/**
 * Download voter results as PDF (print method)
 */
export function downloadVoterResultsPDF() {
  const orgData = window.currentOrgData || {};
  const resultsContent = document.getElementById('voterResultsSection')?.innerHTML || '';
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${orgData.name || 'Election'} - Results</title>
      <link rel="stylesheet" href="./css/variables.css">
      <link rel="stylesheet" href="./css/base.css">
      <link rel="stylesheet" href="./css/components.css">
      <style>
        body { padding: 20px; background: white; color: #000; }
        .btn, .tabs, button { display: none !important; }
        .card { border: 1px solid #ddd; background: white; }
        .status-banner { border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <h1>${orgData.name || 'Election'} - Official Results</h1>
      <p>Downloaded: ${new Date().toLocaleString()}</p>
      <hr>
      ${resultsContent}
      <script>
        window.onload = () => { 
          setTimeout(() => window.print(), 500); 
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Get IP address (for audit)
 */
async function getIPAddress() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch(e) {
    return 'unknown';
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.submitVote = submitVote;
  window.showVoteSuccess = showVoteSuccess;
  window.showAlreadyVotedScreen = showAlreadyVotedScreen;
  window.startVoterCountdown = startVoterCountdown;
  window.showVoterLiveDashboard = showVoterLiveDashboard;
  window.downloadVoterResultsPDF = downloadVoterResultsPDF;
}
