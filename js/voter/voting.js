/**
 * Voter Module - Secure Voting Flow
 * Hardened ballot experience with pending vote recovery and server-side submissions
 */

import { db, auth, signInAnonymously, onAuthStateChanged } from '../config/firebase.js';
import { collection, doc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showScreen, getDefaultAvatar, showQuickLoading, renderError } from '../utils/ui-helpers.js';
import { startVoterCountdown, showAlreadyVotedScreen, showVoteSuccess } from './results.js';
import { loadVoterSession, extendVoterSession, clearVoterSession } from './login.js';

const SUBMIT_IDLE_HTML = '<i class="fas fa-paper-plane"></i> Submit Vote';
const SUBMIT_WORKING_HTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
const PENDING_VOTE_KEY = 'neon_pending_vote';

let selectedCandidates = {};
let isSubmittingVote = false;
let authWatcherAttached = false;
let pendingBannerAction = null;

const activeContext = {
  orgId: null,
  orgName: '',
  electionId: null
};

function persistAuthUid(uid) {
  if (typeof sessionStorage === 'undefined') return;
  if (uid) {
    sessionStorage.setItem('voterAuthUid', uid);
  } else {
    sessionStorage.removeItem('voterAuthUid');
  }
}

function getStoredAuthUid() {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem('voterAuthUid') || '';
}

function attachAuthWatcher() {
  if (!auth || authWatcherAttached) return;
  onAuthStateChanged(auth, user => {
    persistAuthUid(user?.uid || '');
    if (user && activeContext.electionId) {
      maybeShowPendingVotePrompt();
    }
  });
  authWatcherAttached = true;
}

async function ensureVoterAuth() {
  if (!auth) return null;
  attachAuthWatcher();

  if (window.firebaseAuthReady && typeof window.firebaseAuthReady.then === 'function') {
    try {
      await window.firebaseAuthReady;
    } catch (err) {
      console.warn('Firebase auth persistence failed to initialize:', err);
    }
  }

  if (auth.currentUser?.uid) {
    persistAuthUid(auth.currentUser.uid);
    return auth.currentUser;
  }

  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.error('[ensureVoterAuth] Anonymous sign-in failed:', err);
  }

  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        persistAuthUid(user.uid);
        unsubscribe();
        resolve(user);
      }
    }, error => {
      console.error('[ensureVoterAuth] onAuthStateChanged error:', error);
      unsubscribe();
      resolve(null);
    });
  });
}

function setSubmitButtonContent(html, disabled) {
  const submitBtn = document.getElementById('submitVoteBtn');
  if (!submitBtn) return;
  if (typeof disabled === 'boolean') {
    submitBtn.disabled = disabled;
  }
  if (html) {
    submitBtn.innerHTML = html;
  }
}

function getPendingVoteBanner() {
  return document.getElementById('pendingVoteBanner');
}

function hidePendingVoteBanner() {
  const banner = getPendingVoteBanner();
  if (banner) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
  }
  pendingBannerAction = null;
}

function showPendingVoteBanner({ title, message, actionLabel, onAction, variant = 'info' }) {
  const banner = getPendingVoteBanner();
  if (!banner) return;
  const safeTitle = title || 'Pending Submission';
  const safeMessage = message || 'Your vote is saved locally. Tap resume when ready.';

  banner.innerHTML = `
    <div class="pending-vote-content ${variant}">
      <div>
        <div class="pending-vote-title">${safeTitle}</div>
        <div class="pending-vote-message">${safeMessage}</div>
      </div>
      ${actionLabel ? `<button class="btn neon-btn" id="pendingVoteActionBtn">${actionLabel}</button>` : ''}
    </div>
  `;

  if (actionLabel) {
    const actionBtn = banner.querySelector('#pendingVoteActionBtn');
    if (actionBtn) {
      pendingBannerAction = onAction;
      actionBtn.onclick = () => {
        if (typeof pendingBannerAction === 'function') {
          pendingBannerAction();
        }
      };
    }
  }

  banner.classList.remove('hidden');
}

function generateRequestId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `req-${Math.random().toString(36).slice(2)}${Date.now()}`;
}

function loadPendingVote() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_VOTE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to parse pending vote payload:', err);
    return null;
  }
}

function storePendingVote(payload) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PENDING_VOTE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to persist pending vote payload:', err);
  }
}

function clearPendingVoteStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_VOTE_KEY);
  } catch (err) {
    console.warn('Failed to clear pending vote payload:', err);
  }
  hidePendingVoteBanner();
}

function relativeTimeFrom(timestamp) {
  if (!timestamp) return 'just now';
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

function maybeShowPendingVotePrompt() {
  const pending = loadPendingVote();
  const userUid = auth?.currentUser?.uid;
  if (!pending || !pending.electionId || !activeContext.electionId) {
    hidePendingVoteBanner();
    return;
  }

  if (pending.electionId !== activeContext.electionId || pending.orgId !== activeContext.orgId) {
    hidePendingVoteBanner();
    return;
  }

  if (pending.uid && userUid && pending.uid !== userUid) {
    // Pending vote belongs to a different authenticated session.
    hidePendingVoteBanner();
    return;
  }

  showPendingVoteBanner({
    title: 'Resume Submission',
    message: `We saved an unfinished vote from ${relativeTimeFrom(pending.ts)}. Reconnect and finish when ready.`,
    actionLabel: 'Resume Now',
    onAction: resumePendingVote,
    variant: 'warning'
  });
}

async function resumePendingVote() {
  const pending = loadPendingVote();
  if (!pending) {
    hidePendingVoteBanner();
    return;
  }

  const authUser = await ensureVoterAuth();
  if (!authUser?.uid) {
    showToast('Unable to resume without authentication. Please refresh.', 'error');
    return;
  }

  if (pending.uid && pending.uid !== authUser.uid) {
    showToast('Pending vote is linked to another secure session.', 'error');
    clearPendingVoteStorage();
    return;
  }

  isSubmittingVote = true;
  setSubmitButtonContent(SUBMIT_WORKING_HTML, true);

  try {
    await sendVotePayload(pending);
  } catch (err) {
    console.error('[resumePendingVote] Failed:', err);
    showToast(err.message || 'Retry failed. Please check your connection.', 'error');
    handlePendingVoteFailure(err.message);
  } finally {
    isSubmittingVote = false;
    updateVoteSummary();
  }
}

function buildSelectionsArray() {
  const selections = [];
  Object.entries(selectedCandidates).forEach(([positionId, candidateIds]) => {
    if (!Array.isArray(candidateIds)) return;
    candidateIds.forEach(candidateId => {
      if (candidateId) {
        selections.push({ positionId, candidateId: String(candidateId) });
      }
    });
  });
  return selections;
}

function buildPendingVotePayload(session, selections, authUser) {
  return {
    clientRequestId: generateRequestId(),
    orgId: session.orgId,
    electionId: activeContext.electionId || session.orgId,
    orgName: activeContext.orgName || 'Election',
    uid: authUser?.uid,
    selections,
    ts: Date.now()
  };
}

function handlePendingVoteFailure(message) {
  const pending = loadPendingVote();
  if (!pending) return;
  showPendingVoteBanner({
    title: 'Reconnect & Retry',
    message: message || 'Connection interrupted. We will keep trying once you are back online.',
    actionLabel: 'Retry Submission',
    onAction: resumePendingVote,
    variant: 'warning'
  });
}

async function sendVotePayload(pendingPayload) {
  const user = auth?.currentUser || await ensureVoterAuth();
  if (!user?.uid) {
    throw new Error('Secure authentication is required. Please refresh and log in again.');
  }

  const idToken = await user.getIdToken(true);
  const body = {
    orgId: pendingPayload.orgId,
    electionId: pendingPayload.electionId,
    selections: pendingPayload.selections,
    clientRequestId: pendingPayload.clientRequestId
  };

  let response;
  try {
    response = await fetch('/.netlify/functions/submit-vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    handlePendingVoteFailure('Network unreachable. Reconnect and retry when you are back online.');
    throw new Error('Network error detected. Your vote is saved locally.');
  }

  let responseBody = null;
  try {
    responseBody = await response.json();
  } catch (parseErr) {
    // Ignore parse errors for empty bodies
  }

  if (response.status === 200) {
    clearPendingVoteStorage();
    selectedCandidates = {};
    showVoteSuccess();
    setTimeout(() => {
      clearVoterSession();
    }, 2500);
    return;
  }

  if (response.status === 409) {
    clearPendingVoteStorage();
    showAlreadyVotedScreen(activeContext.orgId, activeContext.orgName, {
      voterId: user.uid,
      votedAt: responseBody?.submittedAt || new Date().toISOString()
    });
    return;
  }

  if (response.status === 401) {
    clearPendingVoteStorage();
    clearVoterSession();
    throw new Error('Authentication expired. Please log in again.');
  }

  const errorMessage = responseBody?.error || responseBody?.message || 'Unexpected server error.';
  throw new Error(errorMessage);
}

async function checkExistingSubmission(electionId) {
  if (!electionId) return;
  const user = auth?.currentUser || await ensureVoterAuth();
  if (!user?.uid) return;

  try {
    const lockDocId = `${electionId}__${user.uid}`;
    const lockSnap = await getDoc(doc(db, 'vote_submissions', lockDocId));
    if (lockSnap.exists()) {
      clearPendingVoteStorage();
      showAlreadyVotedScreen(activeContext.orgId, activeContext.orgName, {
        voterId: user.uid,
        votedAt: lockSnap.data()?.submittedAt?.toMillis ? new Date(lockSnap.data().submittedAt.toMillis()) : new Date()
      });
    }
  } catch (err) {
    console.warn('Failed to check existing submission lock:', err);
  }
}

function syncCandidateCardState(positionId) {
  const selectedSet = new Set(selectedCandidates[positionId] || []);
  document.querySelectorAll(`[data-position-id="${positionId}"] .candidate-card`).forEach(card => {
    const candidateId = card.getAttribute('data-candidate-id');
    if (candidateId && selectedSet.has(candidateId)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

/**
 * Initialize voting interface when voter/voting.html loads
 */
export async function initVotingInterface() {
  console.log('[initVotingInterface] Starting...');

  const session = loadVoterSession();
  if (!session) {
    console.error('[initVotingInterface] No valid session found');
    showToast('Your session has expired. Please log in again.', 'error');
    setTimeout(() => {
      clearVoterSession();
      showScreen('voterLoginScreen');
    }, 2000);
    return;
  }

  const { orgId, voterDocId } = session;
  console.log('[initVotingInterface] Session loaded:', { orgId, voterDocId });

  extendVoterSession();

  const authUser = await ensureVoterAuth();
  if (!authUser) {
    showToast('Unable to start a secure voting session. Please refresh and log in again.', 'error');
    return;
  }

  await loadVotingBallot(orgId);
}

/**
 * Load ballot for the active organization
 */
export async function loadVotingBallot(orgId) {
  const screen = document.getElementById('votingScreen');
  if (!screen) return;

  const orgIdStr = String(orgId || '').trim();
  if (!orgIdStr || orgIdStr === 'undefined' || orgIdStr === 'null') {
    renderError('votingScreen', 'Invalid organization ID', () => {
      showScreen('voterLoginScreen');
    });
    return;
  }

  showQuickLoading('votingScreen', 'Loading Ballot');

  try {
    const [positionsSnap, candidatesSnap, orgSnap] = await Promise.all([
      getDocs(collection(db, 'organizations', orgIdStr, 'positions')),
      getDocs(collection(db, 'organizations', orgIdStr, 'candidates')),
      getDoc(doc(db, 'organizations', orgIdStr))
    ]);

    if (typeof window.showVoterWalkthrough === 'function') {
      setTimeout(() => window.showVoterWalkthrough(), 2000);
    }

    if (!orgSnap.exists()) {
      showToast('Organization not found', 'error');
      showScreen('voterLoginScreen');
      return;
    }

    const org = orgSnap.data();
    activeContext.orgId = orgIdStr;
    activeContext.orgName = org.name || 'Election';
    activeContext.electionId = org.electionSettings?.electionId || org.electionSettings?.id || orgIdStr;

    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));

    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));

    const candidatesByPosition = {};
    candidates.forEach(candidate => {
      if (!candidatesByPosition[candidate.positionId]) {
        candidatesByPosition[candidate.positionId] = [];
      }
      candidatesByPosition[candidate.positionId].push(candidate);
    });

    const sessionData = loadVoterSession();
    const voterName = sessionData?.voterName || 'Authenticated Voter';
    const voterIdentifier = sessionData?.voterEmail || sessionData?.voterPhone || sessionData?.voterDocId || '';
    const secureUid = getStoredAuthUid();
    const electionTitle = org.electionSettings?.title || `${org.name || 'Election'} Ballot`;

    let html = `
      <div class="ballot-shell">
        <div class="ballot-paper">
          <div class="ballot-ribbon">
            <i class="fas fa-shield-alt"></i>
            <span>${electionTitle}</span>
          </div>
          <div class="ballot-meta">
            <div class="meta-card">
              <span class="meta-label">Organization</span>
              <span class="meta-value">${org.name || 'Election'}</span>
              ${org.tagline ? `<span class="meta-sub">${org.tagline}</span>` : ''}
            </div>
            <div class="meta-card">
              <span class="meta-label">Voter</span>
              <span class="meta-value">${voterName}</span>
              ${voterIdentifier ? `<span class="meta-sub">${voterIdentifier}</span>` : ''}
            </div>
            <div class="meta-card">
              <span class="meta-label">Secure Session</span>
              <span class="meta-value ${secureUid ? 'meta-value-success' : 'meta-value-warning'}">${secureUid ? 'Active' : 'Pending'}</span>
              <span class="meta-sub">${secureUid ? `UID: ${secureUid.substring(0, 6)}•••` : 'Re-establishing secure channel'}</span>
            </div>
          </div>
          <div id="pendingVoteBanner" class="pending-vote-banner hidden"></div>
          <div class="voting-header">
            <h2>${org.name || 'Election'} Ballot</h2>
            <div class="subtext">Make your selections below. Click submit when done.</div>
            <div class="ballot-header-actions">
              <button class="btn neon-btn-outline" onclick="window.cancelVoting()">
                <i class="fas fa-times"></i> Cancel Voting
              </button>
            </div>
          </div>
          <div class="ballot-container" id="votingBallot">
    `;

    if (positions.length === 0) {
      html += `
        <div class="empty-ballot">
          <i class="fas fa-clipboard-list" style="font-size: 64px; color: #00eaff; margin-bottom: 20px;"></i>
          <h3>No Positions Available</h3>
          <p>There are no positions set up for voting yet.</p>
          <button class="btn neon-btn" onclick="window.showScreen('voterLoginScreen')">
            <i class="fas fa-arrow-left"></i> Back to Login
          </button>
        </div>
      `;
    } else {
      positions.forEach((position, index) => {
        const positionCandidates = candidatesByPosition[position.id] || [];
        const isMultiChoice = position.votingType === 'multiple' && (position.maxCandidates || 1) > 1;

        html += `
          <div class="position-card" data-position-id="${position.id}">
            <div class="position-header">
              <div class="position-title">
                <span class="position-number">${index + 1}</span>
                <h3>${position.name}</h3>
              </div>
              <div class="position-info">
                <span class="badge ${isMultiChoice ? 'multiple' : 'single'}">
                  ${isMultiChoice ? 'Multiple Choice' : 'Single Choice'}
                </span>
                <span class="subtext">Select ${position.maxCandidates || 1} candidate(s)</span>
              </div>
            </div>
            ${position.description ? `
              <div class="position-description">
                <p>${position.description}</p>
              </div>
            ` : ''}
            <div class="candidates-grid">
        `;

        if (positionCandidates.length === 0) {
          html += `
            <div class="no-candidates">
              <i class="fas fa-user-slash"></i>
              <p>No candidates available for this position</p>
            </div>
          `;
        } else if (positionCandidates.length === 1) {
          const only = positionCandidates[0];
          html += `
            <div class="candidate-card" data-candidate-id="yes">
              <div class="candidate-checkbox">
                <input type="radio"
                       id="candidate-${position.id}-yes"
                       name="position-${position.id}"
                       value="yes"
                       onchange="window.updateSelectedCandidates('${position.id}', 'yes', true, 1)">
              </div>
              <div class="candidate-info">
                <div class="candidate-details">
                  <h4>YES</h4>
                  <p class="candidate-tagline">Vote YES for: <strong>${only.name || 'Candidate'}</strong></p>
                </div>
              </div>
            </div>
            <div class="candidate-card" data-candidate-id="no">
              <div class="candidate-checkbox">
                <input type="radio"
                       id="candidate-${position.id}-no"
                       name="position-${position.id}"
                       value="no"
                       onchange="window.updateSelectedCandidates('${position.id}', 'no', true, 1)">
              </div>
              <div class="candidate-info">
                <div class="candidate-details">
                  <h4>NO</h4>
                  <p class="candidate-tagline">Vote NO (reject this candidate)</p>
                </div>
              </div>
            </div>
            <div class="subtext" style="grid-column:1/-1;margin-top:6px;opacity:.9">
              Single candidate: <strong>${only.name || 'Candidate'}</strong>
            </div>
          `;
        } else {
          positionCandidates.forEach(candidate => {
            const photoUrl = candidate.photo || getDefaultAvatar(candidate.name);
            html += `
              <div class="candidate-card" data-candidate-id="${candidate.id}">
                <div class="candidate-checkbox">
                  <input type="${isMultiChoice ? 'checkbox' : 'radio'}"
                         id="candidate-${candidate.id}"
                         name="position-${position.id}"
                         value="${candidate.id}"
                         onchange="window.updateSelectedCandidates('${position.id}', '${candidate.id}', this.checked, ${position.maxCandidates || 1})">
                </div>
                <div class="candidate-info">
                  <img src="${photoUrl}" alt="${candidate.name}" class="candidate-photo" loading="lazy">
                  <div class="candidate-details">
                    <h4>${candidate.name}</h4>
                    ${candidate.tagline ? `<p class="candidate-tagline">${candidate.tagline}</p>` : ''}
                    ${candidate.bio ? `<div class="candidate-bio">${candidate.bio.substring(0, 140)}${candidate.bio.length > 140 ? '...' : ''}</div>` : ''}
                  </div>
                </div>
              </div>
            `;
          });
        }

        html += `
            </div>
          </div>
        `;
      });

      html += `
        <div class="voting-footer">
          <div class="vote-summary">
            <div class="summary-item">
              <span class="label">Positions:</span>
              <span class="value">${positions.length}</span>
            </div>
            <div class="summary-item">
              <span class="label">Selected:</span>
              <span id="selectedCount" class="value">0</span>
            </div>
            <div class="summary-item">
              <span class="label">Status:</span>
              <span id="voteStatus" class="value pending">Ready to Vote</span>
            </div>
          </div>
          <div class="vote-actions">
            <button class="btn neon-btn-outline" onclick="window.clearSelections()">
              <i class="fas fa-eraser"></i> Clear All
            </button>
            <button class="btn neon-btn" onclick="window.submitVote()" id="submitVoteBtn" disabled>
              ${SUBMIT_IDLE_HTML}
            </button>
          </div>
        </div>
      `;
    }

    html += `
          </div>
        </div>
      </div>
    `;

    screen.innerHTML = html;
    updateVoteSummary();
    maybeShowPendingVotePrompt();
    checkExistingSubmission(activeContext.electionId);

    if (org.electionSettings?.endTime) {
      startVoterCountdown(org.electionSettings.endTime);
    }
  } catch (error) {
    console.error('Error loading ballot:', error);
    renderError('votingScreen', 'Error loading ballot: ' + error.message, () => {
      showScreen('voterLoginScreen');
    });
  }
}

/**
 * Update selected candidates for a position
 */
export function updateSelectedCandidates(positionId, candidateId, isSelected, maxSelections) {
  extendVoterSession();

  if (!selectedCandidates[positionId]) {
    selectedCandidates[positionId] = [];
  }

  if (isSelected) {
    const positionEl = document.querySelector(`[data-position-id="${positionId}"]`);
    if (positionEl && positionEl.querySelector('input[type="radio"]')) {
      selectedCandidates[positionId] = [candidateId];
      positionEl.querySelectorAll('input[type="radio"]').forEach(input => {
        if (input.value !== candidateId) {
          input.checked = false;
        }
      });
    } else {
      if (selectedCandidates[positionId].includes(candidateId)) {
        // Already selected
      } else if (selectedCandidates[positionId].length >= maxSelections) {
        showToast(`Maximum ${maxSelections} selection(s) allowed for this position`, 'warning');
        const inputEl = document.getElementById(`candidate-${candidateId}`);
        if (inputEl) inputEl.checked = false;
        return;
      } else {
        selectedCandidates[positionId].push(candidateId);
      }
    }
  } else {
    selectedCandidates[positionId] = selectedCandidates[positionId].filter(id => id !== candidateId);
  }

  syncCandidateCardState(positionId);
  updateVoteSummary();
}

/**
 * Refresh vote summary footer
 */
export function updateVoteSummary() {
  let totalSelected = 0;

  Object.keys(selectedCandidates).forEach(positionId => {
    if (selectedCandidates[positionId].length > 0) {
      totalSelected += selectedCandidates[positionId].length;
    }
  });

  const selectedCountEl = document.getElementById('selectedCount');
  const voteStatusEl = document.getElementById('voteStatus');

  if (selectedCountEl) selectedCountEl.textContent = totalSelected;

  if (voteStatusEl) {
    if (totalSelected > 0) {
      voteStatusEl.textContent = 'Ready to Submit';
      voteStatusEl.className = 'value ready';
    } else {
      voteStatusEl.textContent = 'Select Candidates';
      voteStatusEl.className = 'value pending';
    }
  }

  if (!isSubmittingVote) {
    setSubmitButtonContent(SUBMIT_IDLE_HTML, totalSelected === 0);
  } else if (totalSelected === 0) {
    const submitBtn = document.getElementById('submitVoteBtn');
    if (submitBtn) submitBtn.disabled = true;
  }
}

/**
 * Clear all selections after confirmation
 */
export function clearSelections() {
  if (!confirm('Are you sure you want to clear all selections?')) return;
  selectedCandidates = {};
  document.querySelectorAll('.candidate-card input[type="checkbox"], .candidate-card input[type="radio"]').forEach(input => {
    input.checked = false;
  });
  document.querySelectorAll('.candidate-card.selected').forEach(card => card.classList.remove('selected'));
  updateVoteSummary();
  showToast('All selections cleared', 'info');
}

/**
 * Cancel voting and return to login
 */
export function cancelVoting() {
  if (!confirm('Are you sure you want to cancel voting? Your selections will be lost.')) {
    return;
  }
  selectedCandidates = {};
  sessionStorage.removeItem('voterViewMode');
  sessionStorage.removeItem('voterOrgId');
  sessionStorage.removeItem('voterData');
  sessionStorage.removeItem('voterAuthUid');
  clearPendingVoteStorage();
  showScreen('voterLoginScreen');
  showToast('Voting cancelled', 'info');
}

export function getSelectedCandidates() {
  return selectedCandidates;
}

export function clearSelectedCandidates() {
  selectedCandidates = {};
}

/**
 * Submit vote to Netlify function with auth guard
 */
export async function submitVote() {
  if (isSubmittingVote) {
    showToast('Vote submission already in progress. Please wait...', 'warning');
    return;
  }

  extendVoterSession();

  const session = loadVoterSession();
  if (!session) {
    showToast('Your session has expired. Please log in again.', 'error');
    setTimeout(() => {
      clearVoterSession();
      showScreen('voterLoginScreen');
    }, 2000);
    return;
  }

  if (!activeContext.electionId) {
    showToast('Election context is missing. Please refresh.', 'error');
    return;
  }

  const selections = buildSelectionsArray();
  if (!selections.length) {
    showToast('Please select at least one candidate before submitting', 'warning');
    return;
  }

  const authUser = await ensureVoterAuth();
  if (!authUser?.uid) {
    showToast('Secure authentication is required before submitting your vote.', 'error');
    return;
  }

  const pendingPayload = buildPendingVotePayload(session, selections, authUser);
  storePendingVote(pendingPayload);

  showToast('Submitting your vote...', 'info');
  isSubmittingVote = true;
  setSubmitButtonContent(SUBMIT_WORKING_HTML, true);

  try {
    await sendVotePayload(pendingPayload);
  } catch (err) {
    console.error('[submitVote] Error:', err);
    showToast(err.message || 'Failed to submit vote', 'error');
    handlePendingVoteFailure(err.message);
  } finally {
    isSubmittingVote = false;
    updateVoteSummary();
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.initVotingInterface = initVotingInterface;
  window.loadVotingBallot = loadVotingBallot;
  window.updateSelectedCandidates = updateSelectedCandidates;
  window.updateVoteSummary = updateVoteSummary;
  window.clearSelections = clearSelections;
  window.cancelVoting = cancelVoting;
  window.submitVote = submitVote;
  window.getSelectedCandidates = getSelectedCandidates;
}
