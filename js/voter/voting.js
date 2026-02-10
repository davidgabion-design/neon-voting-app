/**
 * Voter Module - Voting
 * Handles ballot loading, candidate selection, and voting UI
 */

import { db } from '../config/firebase.js';
import { collection, doc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showScreen, getDefaultAvatar, showQuickLoading, renderError } from '../utils/ui-helpers.js';
import { startVoterCountdown } from './results.js';

// Module state
let selectedCandidates = {};

/**
 * Load voting ballot for organization
 * @param {string} orgId - Organization ID
 */
export async function loadVotingBallot(orgId) {
  const screen = document.getElementById('votingScreen');
  if (!screen) return;
  
  showQuickLoading('votingScreen', 'Loading Ballot');
  
  try {
    const [positionsSnap, candidatesSnap, orgSnap] = await Promise.all([
      getDocs(collection(db, "organizations", orgId, "positions")),
      getDocs(collection(db, "organizations", orgId, "candidates")),
      getDoc(doc(db, "organizations", orgId))
    ]);
    
    // ✅ Show first-time voter walkthrough
    if (typeof window.showVoterWalkthrough === 'function') {
      setTimeout(() => window.showVoterWalkthrough(), 2000);
    }
    
    if (!orgSnap.exists()) {
      showToast('Organization not found', 'error');
      showScreen('voterLoginScreen');
      return;
    }
    
    const org = orgSnap.data();
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    // Group candidates by position
    const candidatesByPosition = {};
    candidates.forEach(c => {
      if (!candidatesByPosition[c.positionId]) {
        candidatesByPosition[c.positionId] = [];
      }
      candidatesByPosition[c.positionId].push(c);
    });
    
    let html = `
      <div class="voting-header">
        <h2>${org.name || 'Election'} Ballot</h2>
        <div class="subtext">Make your selections below. Click submit when done.</div>
        <div style="margin-top: 10px;">
          <button class="btn neon-btn-outline" onclick="window.cancelVoting()">
            <i class="fas fa-times"></i> Cancel Voting
          </button>
        </div>
      </div>
      
      <div class="ballot-container">
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
        
        html += `
          <div class="position-card" data-position-id="${position.id}">
            <div class="position-header">
              <div class="position-title">
                <span class="position-number">${index + 1}</span>
                <h3>${position.name}</h3>
              </div>
              <div class="position-info">
                <span class="badge ${position.votingType === 'multiple' ? 'multiple' : 'single'}">
                  ${position.votingType === 'multiple' ? 'Multiple Choice' : 'Single Choice'}
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
          const onlyPhoto = only.photo || getDefaultAvatar(only.name || "Candidate");
          html += `
            <div class="candidate-card" data-candidate-id="yes">
              <div class="candidate-checkbox">
                <input type="radio"
                       id="candidate-${position.id}-yes"
                       name="position-${position.id}"
                       value="yes"
                       onchange="window.updateSelectedCandidates('${position.id}', 'yes', true, 1)">
                <label for="candidate-${position.id}-yes"></label>
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
                <label for="candidate-${position.id}-no"></label>
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
                  <input type="radio" 
                         id="candidate-${candidate.id}" 
                         name="position-${position.id}" 
                         value="${candidate.id}"
                         onchange="window.updateSelectedCandidates('${position.id}', '${candidate.id}', this.checked, ${position.maxCandidates || 1})">
                  <label for="candidate-${candidate.id}"></label>
                </div>
                <div class="candidate-info">
                  <img src="${photoUrl}" alt="${candidate.name}" class="candidate-photo">
                  <div class="candidate-details">
                    <h4>${candidate.name}</h4>
                    ${candidate.tagline ? `<p class="candidate-tagline">${candidate.tagline}</p>` : ''}
                    ${candidate.bio ? `<div class="candidate-bio">${candidate.bio.substring(0, 100)}${candidate.bio.length > 100 ? '...' : ''}</div>` : ''}
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
              <i class="fas fa-paper-plane"></i> Submit Vote
            </button>
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
    screen.innerHTML = html;
    
    // Add countdown timer if election has end time
    if (org.electionSettings?.endTime) {
      startVoterCountdown(org.electionSettings.endTime);
    }
    
  } catch(e) {
    console.error('Error loading ballot:', e);
    renderError('votingScreen', 'Error loading ballot: ' + e.message, () => {
      showScreen('voterLoginScreen');
    });
  }
}

/**
 * Update selected candidates for a position
 * @param {string} positionId - Position ID
 * @param {string} candidateId - Candidate ID
 * @param {boolean} isSelected - Whether candidate is selected
 * @param {number} maxSelections - Maximum selections allowed
 */
export function updateSelectedCandidates(positionId, candidateId, isSelected, maxSelections) {
  if (!selectedCandidates[positionId]) {
    selectedCandidates[positionId] = [];
  }
  
  if (isSelected) {
    // For single choice, clear previous selection
    const positionEl = document.querySelector(`[data-position-id="${positionId}"]`);
    if (positionEl && positionEl.querySelector('input[type="radio"]')) {
      selectedCandidates[positionId] = [candidateId];
      // Uncheck other radio buttons
      positionEl.querySelectorAll('input[type="radio"]').forEach(input => {
        if (input.value !== candidateId) {
          input.checked = false;
        }
      });
    } else {
      // For multiple choice, check max selections
      if (selectedCandidates[positionId].length >= maxSelections) {
        showToast(`Maximum ${maxSelections} selection(s) allowed for this position`, 'warning');
        document.getElementById(`candidate-${candidateId}`).checked = false;
        return;
      }
      selectedCandidates[positionId].push(candidateId);
    }
  } else {
    selectedCandidates[positionId] = selectedCandidates[positionId].filter(id => id !== candidateId);
  }
  
  updateVoteSummary();
}

/**
 * Update vote summary display
 */
export function updateVoteSummary() {
  let totalSelected = 0;
  let totalPositions = 0;
  
  Object.keys(selectedCandidates).forEach(positionId => {
    if (selectedCandidates[positionId].length > 0) {
      totalSelected += selectedCandidates[positionId].length;
      totalPositions++;
    }
  });
  
  const selectedCountEl = document.getElementById('selectedCount');
  const voteStatusEl = document.getElementById('voteStatus');
  const submitBtn = document.getElementById('submitVoteBtn');
  
  if (selectedCountEl) selectedCountEl.textContent = totalSelected;
  
  if (totalSelected > 0) {
    if (voteStatusEl) {
      voteStatusEl.textContent = 'Ready to Submit';
      voteStatusEl.className = 'value ready';
    }
    if (submitBtn) submitBtn.disabled = false;
  } else {
    if (voteStatusEl) {
      voteStatusEl.textContent = 'Select Candidates';
      voteStatusEl.className = 'value pending';
    }
    if (submitBtn) submitBtn.disabled = true;
  }
}

/**
 * Clear all candidate selections
 */
export function clearSelections() {
  if (!confirm('Are you sure you want to clear all selections?')) return;
  
  selectedCandidates = {};
  
  // Uncheck all checkboxes and radios
  document.querySelectorAll('.candidate-card input[type="checkbox"], .candidate-card input[type="radio"]').forEach(input => {
    input.checked = false;
  });
  
  updateVoteSummary();
  showToast('All selections cleared', 'info');
}

/**
 * Cancel voting and return to login
 */
export function cancelVoting() {
  if (confirm('Are you sure you want to cancel voting? Your selections will be lost.')) {
    // Clear the voter session
    selectedCandidates = {};
    
    // Clear session storage to prevent auto-restore on refresh
    sessionStorage.removeItem('voterViewMode');
    sessionStorage.removeItem('voterOrgId');
    sessionStorage.removeItem('voterData');
    
    // Go back to voter login
    showScreen('voterLoginScreen');
    showToast('Voting cancelled', 'info');
  }
}

/**
 * Get selected candidates (for export to results module)
 */
export function getSelectedCandidates() {
  return selectedCandidates;
}

/**
 * Clear selected candidates (for export to results module)
 */
export function clearSelectedCandidates() {
  selectedCandidates = {};
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadVotingBallot = loadVotingBallot;
  window.updateSelectedCandidates = updateSelectedCandidates;
  window.updateVoteSummary = updateVoteSummary;
  window.clearSelections = clearSelections;
  window.cancelVoting = cancelVoting;
}
