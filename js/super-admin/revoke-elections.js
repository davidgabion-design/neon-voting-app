/**
 * Super Admin Module - Revoke Elections
 * Handles election revocation functionality
 */

import { db } from '../config/firebase.js';
import { collection, doc, getDocs, getDoc, updateDoc, serverTimestamp, addDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showQuickLoading, getDefaultLogo } from '../utils/ui-helpers.js';
import { escapeHtml } from '../utils/validation.js';
import { applyTranslations } from '../utils/i18n.js';

let allElections = [];
let filteredElections = [];

/**
 * Helper: Safely convert Firestore timestamp to Date
 */
function safeTimestampToDate(timestamp) {
  if (!timestamp) return null;
  
  try {
    // Firestore Timestamp object with seconds property
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    // Already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    // Firestore Timestamp with toDate method
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    // String timestamp
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    return null;
  } catch (error) {
    console.warn('Error converting timestamp:', error);
    return null;
  }
}

/**
 * Helper: Format date for display
 */
function formatDate(timestamp, includeTime = false) {
  const date = safeTimestampToDate(timestamp);
  if (!date || isNaN(date.getTime())) return 'N/A';
  
  try {
    if (includeTime) {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Load elections list for revocation
 */
export async function loadRevokeElectionsList() {
  const container = document.getElementById('revokeElectionsList');
  if (!container) return;

  showQuickLoading('revokeElectionsList', 'Loading elections...');

  try {
    // Fetch all organizations
    const orgsSnapshot = await getDocs(collection(db, 'organizations'));
    allElections = [];

    orgsSnapshot.forEach(orgDoc => {
      const orgData = orgDoc.data();
      if (!orgData.isDeleted) {
        allElections.push({
          id: orgDoc.id,
          ...orgData
        });
      }
    });

    console.log(`Loaded ${allElections.length} organizations for revocation`);

    // Apply initial filter
    filterRevokeElections();

  } catch (error) {
    console.error('Error loading elections for revocation:', error);
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:40px;border-color:rgba(255,68,68,0.3)">
        <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#ff4444;margin-bottom:16px"></i>
        <p style="color:#ff9999">Failed to load elections: ${escapeHtml(error.message)}</p>
        <button class="btn neon-btn" onclick="window.loadRevokeElectionsList()">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

/**
 * Filter elections based on search and status
 */
export function filterRevokeElections() {
  const searchInput = document.getElementById('revokeElectionSearch');
  const statusFilter = document.getElementById('revokeElectionStatusFilter');
  const container = document.getElementById('revokeElectionsList');

  if (!container) return;

  const searchTerm = searchInput?.value?.toLowerCase() || '';
  const statusValue = statusFilter?.value || 'active';

  // Filter elections
  filteredElections = allElections.filter(election => {
    // Search filter
    const matchesSearch = !searchTerm || 
      election.id.toLowerCase().includes(searchTerm) ||
      (election.name || '').toLowerCase().includes(searchTerm);

    // Status filter
    const electionStatus = (election.electionStatus || 'pending').toLowerCase();
    const matchesStatus = statusValue === 'all' || electionStatus === statusValue;

    return matchesSearch && matchesStatus;
  });

  renderRevokeElectionsList();
}

/**
 * Render filtered elections list
 */
function renderRevokeElectionsList() {
  const container = document.getElementById('revokeElectionsList');
  if (!container) return;

  if (filteredElections.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:40px">
        <i class="fas fa-inbox" style="font-size:48px;color:#00eaff;margin-bottom:16px;opacity:0.5"></i>
        <p class="subtext">No elections found matching your criteria.</p>
      </div>
    `;
    return;
  }

  // Sort by date (newest first)
  filteredElections.sort((a, b) => {
    const dateA = safeTimestampToDate(a.createdAt) || new Date(0);
    const dateB = safeTimestampToDate(b.createdAt) || new Date(0);
    return dateB - dateA;
  });

  let html = '';

  filteredElections.forEach(election => {
    const status = (election.electionStatus || 'pending').toLowerCase();
    const isRevoked = status === 'revoked';
    const voterCount = election.voterCount || 0;
    const voteCount = election.voteCount || 0;
    const participationRate = voterCount > 0 ? Math.round((voteCount / voterCount) * 100) : 0;

    // Status badge
    let statusBadge = '';
    let statusColor = '#00eaff';
    
    switch(status) {
      case 'active':
        statusBadge = '<span class="badge success"><i class="fas fa-play-circle"></i> Active</span>';
        statusColor = '#00ffaa';
        break;
      case 'ended':
        statusBadge = '<span class="badge warning"><i class="fas fa-stop-circle"></i> Ended</span>';
        statusColor = '#ffc107';
        break;
      case 'declared':
        statusBadge = '<span class="badge info"><i class="fas fa-check-circle"></i> Declared</span>';
        statusColor = '#00d4ff';
        break;
      case 'revoked':
        statusBadge = '<span class="badge danger"><i class="fas fa-ban"></i> Revoked</span>';
        statusColor = '#ff4444';
        break;
      default:
        statusBadge = '<span class="badge"><i class="fas fa-clock"></i> Pending</span>';
        statusColor = '#888';
    }

    // Approval status
    const approvalStatus = election.approval?.status || 'pending';
    let approvalBadge = '';
    
    if (approvalStatus === 'approved') {
      approvalBadge = '<span class="badge success" style="margin-left:8px"><i class="fas fa-shield-check"></i> Approved</span>';
    } else if (approvalStatus === 'rejected') {
      approvalBadge = '<span class="badge danger" style="margin-left:8px"><i class="fas fa-shield-xmark"></i> Rejected</span>';
    } else {
      approvalBadge = '<span class="badge warning" style="margin-left:8px"><i class="fas fa-shield-halved"></i> Pending Approval</span>';
    }

    html += `
      <div class="card list-item" style="margin-bottom:12px;border-left:4px solid ${statusColor}">
        <div style="flex:1">
          <div style="display:flex;gap:12px;align-items:flex-start">
            <img 
              src="${election.logoUrl || getDefaultLogo(election.name)}" 
              style="width:60px;height:60px;border-radius:12px;object-fit:cover;border:2px solid ${statusColor}40"
              alt="Logo"
            >
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <strong style="color:#fff;font-size:16px">${escapeHtml(election.name || election.id)}</strong>
                ${statusBadge}
                ${approvalBadge}
              </div>
              
              <div class="subtext" style="margin-bottom:8px">
                <i class="fas fa-fingerprint"></i> ID: <code style="background:rgba(0,255,255,0.1);padding:2px 6px;border-radius:4px">${election.id}</code>
              </div>
              
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:8px">
                <div>
                  <div class="subtext" style="font-size:11px"><i class="fas fa-users"></i> Voters</div>
                  <div style="color:#00eaff;font-weight:600">${voterCount}</div>
                </div>
                <div>
                  <div class="subtext" style="font-size:11px"><i class="fas fa-check-circle"></i> Votes Cast</div>
                  <div style="color:#00ffaa;font-weight:600">${voteCount}</div>
                </div>
                <div>
                  <div class="subtext" style="font-size:11px"><i class="fas fa-chart-pie"></i> Turnout</div>
                  <div style="color:#ffc107;font-weight:600">${participationRate}%</div>
                </div>
                <div>
                  <div class="subtext" style="font-size:11px"><i class="fas fa-calendar"></i> Created</div>
                  <div style="color:#00d4ff;font-weight:600;font-size:12px">
                    ${formatDate(election.createdAt)}
                  </div>
                </div>
              </div>
              
              ${isRevoked ? `
                <div style="margin-top:12px;padding:10px;background:rgba(255,68,68,0.1);border-radius:6px;border:1px solid rgba(255,68,68,0.3)">
                  <div style="color:#ff9999;font-size:12px;margin-bottom:4px">
                    <i class="fas fa-ban"></i> <strong>REVOKED</strong>
                  </div>
                  ${election.revokedReason ? `
                    <div class="subtext" style="margin-top:4px">
                      <i class="fas fa-info-circle"></i> Reason: ${escapeHtml(election.revokedReason)}
                    </div>
                  ` : ''}
                  ${election.revokedAt ? `
                    <div class="subtext" style="margin-top:4px">
                      <i class="fas fa-clock"></i> Revoked: ${formatDate(election.revokedAt, true)}
                    </div>
                  ` : ''}
                  ${election.revokedBy ? `
                    <div class="subtext" style="margin-top:4px">
                      <i class="fas fa-user-shield"></i> By: ${escapeHtml(election.revokedBy)}
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div style="display:flex;flex-direction:column;gap:8px;margin-left:12px">
          ${isRevoked ? `
            <button class="btn" disabled style="opacity:0.5">
              <i class="fas fa-ban"></i> Already Revoked
            </button>
          ` : `
            <button 
              class="btn btn-danger" 
              onclick="window.showRevokeElectionModal('${election.id}', '${escapeHtml(election.name || election.id).replace(/'/g, "\\'")}')"
              style="white-space:nowrap"
            >
              <i class="fas fa-ban"></i> Revoke Election
            </button>
          `}
          
          <button 
            class="btn neon-btn-outline" 
            onclick="window.viewElectionDetails('${election.id}')"
            style="white-space:nowrap"
          >
            <i class="fas fa-info-circle"></i> View Details
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  applyTranslations();
}

/**
 * Show revoke election modal with reason input
 */
export function showRevokeElectionModal(orgId, orgName) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:550px">
      <div class="modal-header">
        <h3 style="margin:0">
          <i class="fas fa-ban" style="color:#ff4444"></i> Revoke Election
        </h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="modal-body">
        <div style="padding:16px;background:rgba(255,68,68,0.1);border-radius:8px;border:1px solid rgba(255,68,68,0.3);margin-bottom:20px">
          <div style="color:#ff9999;font-weight:600;margin-bottom:8px">
            <i class="fas fa-exclamation-triangle"></i> Warning: This action is irreversible
          </div>
          <div class="subtext" style="font-size:13px">
            Revoking this election will:
          </div>
          <ul style="margin:8px 0 0 20px;font-size:13px;color:#ffcccc">
            <li>Immediately stop all voting</li>
            <li>Prevent voters from casting ballots</li>
            <li>Mark the election as revoked permanently</li>
            <li>Create an audit trail entry</li>
            <li>Cannot be undone</li>
          </ul>
        </div>
        
        <div style="margin-bottom:16px">
          <label style="display:block;margin-bottom:6px;color:#00eaff">
            <i class="fas fa-building"></i> Election to Revoke:
          </label>
          <div style="padding:12px;background:rgba(0,255,255,0.05);border-radius:6px;border:1px solid rgba(0,255,255,0.2)">
            <strong style="color:#fff">${escapeHtml(orgName)}</strong>
            <div class="subtext" style="margin-top:4px">Organization ID: ${orgId}</div>
          </div>
        </div>
        
        <div style="margin-bottom:16px">
          <label for="revokeReasonInput" style="display:block;margin-bottom:6px;color:#00eaff">
            <i class="fas fa-clipboard"></i> Reason for Revocation: <span style="color:#ff4444">*</span>
          </label>
          <textarea 
            id="revokeReasonInput" 
            class="input" 
            rows="4" 
            placeholder="Enter a detailed reason for revoking this election (required)..."
            required
            style="resize:vertical"
          ></textarea>
          <div class="subtext" style="margin-top:4px">
            This reason will be permanently recorded and visible to Election Commissioners.
          </div>
        </div>
        
        <div style="margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="revokeConfirmCheckbox">
            <span style="color:#fff;font-size:14px">
              I understand this action cannot be undone
            </span>
          </label>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn neon-btn-outline" onclick="this.closest('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button 
          class="btn btn-danger" 
          onclick="window.confirmRevokeElection('${orgId}', '${escapeHtml(orgName).replace(/'/g, "\\'")}')"
        >
          <i class="fas fa-ban"></i> Revoke Election
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus on reason input
  setTimeout(() => {
    document.getElementById('revokeReasonInput')?.focus();
  }, 100);
}

/**
 * Confirm and execute election revocation
 */
export async function confirmRevokeElection(orgId, orgName) {
  const reasonInput = document.getElementById('revokeReasonInput');
  const confirmCheckbox = document.getElementById('revokeConfirmCheckbox');
  
  // Validate reason
  const reason = reasonInput?.value?.trim();
  if (!reason) {
    showToast('Please enter a reason for revocation', 'error');
    reasonInput?.focus();
    return;
  }
  
  if (reason.length < 10) {
    showToast('Reason must be at least 10 characters', 'error');
    reasonInput?.focus();
    return;
  }
  
  // Validate confirmation
  if (!confirmCheckbox?.checked) {
    showToast('Please confirm you understand this action is irreversible', 'error');
    return;
  }
  
  // Final confirmation
  if (!confirm(`FINAL CONFIRMATION\n\nAre you absolutely sure you want to revoke "${orgName}"?\n\nThis will immediately stop all voting and cannot be undone.`)) {
    return;
  }
  
  try {
    // Get super admin email from session
    const superAdminEmail = sessionStorage.getItem('neon_super_admin_email') || 'superadmin@system';
    
    // Update organization document
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      showToast('Election not found', 'error');
      return;
    }
    
    const orgData = orgSnap.data();
    const previousStatus = orgData.electionStatus || 'pending';
    
    // Update election status to revoked
    await updateDoc(orgRef, {
      electionStatus: 'revoked',
      revokedAt: serverTimestamp(),
      revokedBy: superAdminEmail,
      revokedReason: reason,
      previousStatus: previousStatus
    });
    
    // Log audit trail
    try {
      const auditRef = collection(db, 'organizations', orgId, 'auditTrail');
      await addDoc(auditRef, {
        action: 'ELECTION_REVOKED',
        timestamp: serverTimestamp(),
        performedBy: superAdminEmail,
        role: 'superadmin',
        reason: reason,
        metadata: {
          previousStatus: previousStatus,
          organizationName: orgData.name || orgId,
          voterCount: orgData.voterCount || 0,
          voteCount: orgData.voteCount || 0
        }
      });
    } catch (auditError) {
      console.warn('Failed to create audit trail entry:', auditError);
    }
    
    // Close modal
    document.querySelector('.modal-overlay')?.remove();
    
    // Show success message
    showToast(`✅ Election "${orgName}" has been revoked`, 'success');
    
    // Reload the list
    setTimeout(() => {
      loadRevokeElectionsList();
    }, 500);
    
  } catch (error) {
    console.error('Error revoking election:', error);
    showToast(`Failed to revoke election: ${error.message}`, 'error');
  }
}

/**
 * View election details in a modal
 */
export async function viewElectionDetails(orgId) {
  if (!orgId) return;
  
  try {
    // Fetch organization details
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      showToast('Election not found', 'error');
      return;
    }
    
    const orgData = { id: orgSnap.id, ...orgSnap.data() };
    
    // Fetch additional data in parallel
    const [votersSnap, positionsSnap, candidatesSnap, votesSnap] = await Promise.all([
      getDocs(collection(db, 'organizations', orgId, 'voters')),
      getDocs(collection(db, 'organizations', orgId, 'positions')),
      getDocs(collection(db, 'organizations', orgId, 'candidates')),
      getDocs(collection(db, 'organizations', orgId, 'votes'))
    ]);
    
    const voters = votersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const positions = positionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const candidates = candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const votes = votesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Calculate statistics
    const activeVoters = voters.filter(v => !v.isReplaced).length;
    const votedCount = voters.filter(v => v.hasVoted).length;
    const turnoutRate = activeVoters > 0 ? Math.round((votedCount / activeVoters) * 100) : 0;
    
    // Election status
    const status = (orgData.electionStatus || 'pending').toLowerCase();
    const isRevoked = status === 'revoked';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:900px;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <div>
            <h3 style="margin:0;display:flex;align-items:center;gap:12px">
              <img src="${orgData.logoUrl || getDefaultLogo(orgData.name)}" 
                   style="width:40px;height:40px;border-radius:8px;object-fit:cover">
              ${escapeHtml(orgData.name || orgId)}
            </h3>
            <div class="subtext" style="margin-top:4px">
              Organization ID: <code style="background:rgba(0,255,255,0.1);padding:2px 6px;border-radius:4px">${orgId}</code>
            </div>
          </div>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <!-- Status Banner -->
          <div style="padding:12px;background:${isRevoked ? 'rgba(255,68,68,0.1)' : 'rgba(0,255,170,0.05)'};border-radius:8px;border:1px solid ${isRevoked ? 'rgba(255,68,68,0.3)' : 'rgba(0,255,170,0.2)'};margin-bottom:20px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="flex:1">
                <div style="font-weight:600;color:${isRevoked ? '#ff4444' : '#00ffaa'};margin-bottom:4px">
                  ${isRevoked ? '<i class="fas fa-ban"></i> ELECTION REVOKED' : '<i class="fas fa-check-circle"></i> ' + status.toUpperCase()}
                </div>
                ${isRevoked && orgData.revokedReason ? `
                  <div class="subtext">Reason: ${escapeHtml(orgData.revokedReason)}</div>
                  <div class="subtext" style="margin-top:4px">
                    Revoked by ${escapeHtml(orgData.revokedBy || 'Unknown')} on ${formatDate(orgData.revokedAt, true)}
                  </div>
                ` : ''}
              </div>
              <div>
                ${orgData.approval?.status === 'approved' 
                  ? '<span class="badge success"><i class="fas fa-shield-check"></i> Approved</span>'
                  : orgData.approval?.status === 'rejected'
                    ? '<span class="badge danger"><i class="fas fa-shield-xmark"></i> Rejected</span>'
                    : '<span class="badge warning"><i class="fas fa-shield-halved"></i> Pending Approval</span>'
                }
              </div>
            </div>
          </div>
          
          <!-- Statistics Grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
            <div class="card" style="text-align:center;padding:16px">
              <div style="font-size:32px;color:#00eaff;font-weight:700">${activeVoters}</div>
              <div class="subtext" style="font-size:12px;margin-top:4px"><i class="fas fa-users"></i> Active Voters</div>
            </div>
            <div class="card" style="text-align:center;padding:16px">
              <div style="font-size:32px;color:#00ffaa;font-weight:700">${votedCount}</div>
              <div class="subtext" style="font-size:12px;margin-top:4px"><i class="fas fa-check-circle"></i> Votes Cast</div>
            </div>
            <div class="card" style="text-align:center;padding:16px">
              <div style="font-size:32px;color:#ffc107;font-weight:700">${turnoutRate}%</div>
              <div class="subtext" style="font-size:12px;margin-top:4px"><i class="fas fa-chart-pie"></i> Turnout</div>
            </div>
            <div class="card" style="text-align:center;padding:16px">
              <div style="font-size:32px;color:#9d00ff;font-weight:700">${positions.length}</div>
              <div class="subtext" style="font-size:12px;margin-top:4px"><i class="fas fa-briefcase"></i> Positions</div>
            </div>
            <div class="card" style="text-align:center;padding:16px">
              <div style="font-size:32px;color:#00d4ff;font-weight:700">${candidates.length}</div>
              <div class="subtext" style="font-size:12px;margin-top:4px"><i class="fas fa-user-tie"></i> Candidates</div>
            </div>
          </div>
          
          <!-- Detailed Information -->
          <div style="display:grid;gap:16px">
            <!-- Organization Info -->
            <div class="card">
              <h4 style="margin:0 0 12px;color:#00eaff"><i class="fas fa-building"></i> Organization Information</h4>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;font-size:14px">
                <div>
                  <div class="subtext" style="margin-bottom:4px">Created</div>
                  <div style="color:#fff">${formatDate(orgData.createdAt, true)}</div>
                </div>
                <div>
                  <div class="subtext" style="margin-bottom:4px">Credential Type</div>
                  <div style="color:#fff">${escapeHtml(orgData.credentialType || 'email_phone')}</div>
                </div>
                ${orgData.description ? `
                  <div style="grid-column:1/-1">
                    <div class="subtext" style="margin-bottom:4px">Description</div>
                    <div style="color:#fff">${escapeHtml(orgData.description)}</div>
                  </div>
                ` : ''}
              </div>
            </div>
            
            <!-- Positions & Candidates -->
            ${positions.length > 0 ? `
              <div class="card">
                <h4 style="margin:0 0 12px;color:#00eaff"><i class="fas fa-briefcase"></i> Positions & Candidates</h4>
                <div style="display:grid;gap:10px">
                  ${positions.slice(0, 5).map(pos => {
                    const posCandidates = candidates.filter(c => c.positionId === pos.id);
                    return `
                      <div style="padding:10px;background:rgba(0,255,255,0.03);border-radius:6px;border:1px solid rgba(0,255,255,0.1)">
                        <div style="font-weight:600;color:#00ffaa;margin-bottom:4px">${escapeHtml(pos.title || pos.name)}</div>
                        <div class="subtext" style="font-size:12px">
                          ${posCandidates.length} candidate${posCandidates.length !== 1 ? 's' : ''} • 
                          Max selections: ${pos.maxCandidates || 1}
                        </div>
                        ${posCandidates.length > 0 ? `
                          <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">
                            ${posCandidates.slice(0, 4).map(c => 
                              `<span style="font-size:11px;padding:2px 6px;background:rgba(0,195,255,0.1);border-radius:4px">${escapeHtml(c.name)}</span>`
                            ).join('')}
                            ${posCandidates.length > 4 ? `<span style="font-size:11px;color:#888">+${posCandidates.length - 4} more</span>` : ''}
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                  ${positions.length > 5 ? `
                    <div class="subtext" style="text-align:center;font-size:12px">
                      And ${positions.length - 5} more position${positions.length - 5 !== 1 ? 's' : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : '<div class="card"><div class="subtext" style="text-align:center">No positions configured</div></div>'}
            
            <!-- Timeline -->
            <div class="card">
              <h4 style="margin:0 0 12px;color:#00eaff"><i class="fas fa-clock"></i> Timeline</h4>
              <div style="display:grid;gap:8px;font-size:13px">
                ${orgData.createdAt ? `
                  <div style="display:flex;gap:8px;align-items:center">
                    <i class="fas fa-plus-circle" style="color:#00ffaa;width:16px"></i>
                    <div class="subtext" style="flex:1">Created</div>
                    <div style="color:#fff">${formatDate(orgData.createdAt, true)}</div>
                  </div>
                ` : ''}
                ${orgData.approval?.requestedAt ? `
                  <div style="display:flex;gap:8px;align-items:center">
                    <i class="fas fa-paper-plane" style="color:#00d4ff;width:16px"></i>
                    <div class="subtext" style="flex:1">Submitted for Approval</div>
                    <div style="color:#fff">${formatDate(orgData.approval.requestedAt, true)}</div>
                  </div>
                ` : ''}
                ${orgData.approval?.approvedAt ? `
                  <div style="display:flex;gap:8px;align-items:center">
                    <i class="fas fa-check-circle" style="color:#00ffaa;width:16px"></i>
                    <div class="subtext" style="flex:1">Approved by ${escapeHtml(orgData.approval.approvedBy || 'SuperAdmin')}</div>
                    <div style="color:#fff">${formatDate(orgData.approval.approvedAt, true)}</div>
                  </div>
                ` : ''}
                ${orgData.revokedAt ? `
                  <div style="display:flex;gap:8px;align-items:center">
                    <i class="fas fa-ban" style="color:#ff4444;width:16px"></i>
                    <div class="subtext" style="flex:1">Revoked by ${escapeHtml(orgData.revokedBy || 'Unknown')}</div>
                    <div style="color:#fff">${formatDate(orgData.revokedAt, true)}</div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center">
          <div class="subtext" style="font-size:12px">
            <i class="fas fa-info-circle"></i> Last updated: ${formatDate(orgData.updatedAt || orgData.createdAt, true)}
          </div>
          <button class="btn neon-btn-outline" onclick="this.closest('.modal-overlay').remove()">
            <i class="fas fa-times"></i> Close
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading election details:', error);
    showToast(`Failed to load details: ${error.message}`, 'error');
  }
}

// Export to window for onclick handlers
if (typeof window !== 'undefined') {
  window.loadRevokeElectionsList = loadRevokeElectionsList;
  window.filterRevokeElections = filterRevokeElections;
  window.showRevokeElectionModal = showRevokeElectionModal;
  window.confirmRevokeElection = confirmRevokeElection;
  window.viewElectionDetails = viewElectionDetails;
}
