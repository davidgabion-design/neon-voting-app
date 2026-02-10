/**
 * EC Module - Voters Management
 * Handles all voter CRUD operations, bulk operations, search, and export
 */

import { db } from '../config/firebase.js';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, 
  serverTimestamp, increment, addDoc 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, createModal, showQuickLoading, renderError } from '../utils/ui-helpers.js';
import { escapeHtml, validateEmail, validateDateOfBirth } from '../utils/validation.js';
import { formatPhoneForDisplay, formatDateForDisplay, formatFirestoreTimestamp } from '../utils/formatting.js';
import { normalizePhoneNumber, normalizePhoneE164 } from '../utils/normalization.js';
import { checkEditLock } from './utils.js';
import { getCredentialType, validateCredential, buildVoterDocId } from '../config/credential-types.js';

/**
 * Load and display all voters
 */
export async function loadECVoters() {
  const el = document.getElementById("ecContent-voters");
  if (!el || !window.currentOrgId) return;
  
  showQuickLoading("ecContent-voters", "Loading Voters");
  
  try {
    const snap = await getDocs(collection(db, "organizations", window.currentOrgId, "voters"));
    const voters = [];
    snap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    const activeVoters = voters.filter(v => !v.isReplaced);
    const activeCount = activeVoters.length;
    const replacedCount = voters.length - activeCount;
    
    // Get translation function
    const t = window.t || ((key) => key);
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-users"></i> ${t('voters')} (${activeCount} ${t('active')}${replacedCount ? ` • ${replacedCount} ${t('replaced')}` : ""})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddVoterModal()">
            <i class="fas fa-user-plus"></i> ${t('add_voter')}
          </button>
          <button class="btn neon-btn-outline" onclick="showBulkVoterModal()">
            <i class="fas fa-users"></i> ${t('bulk_add')}
          </button>
          <button class="btn neon-btn-outline" onclick="refreshVoters()">
            <i class="fas fa-redo"></i>
          </button>
        </div>
      </div>
    `;
    
    if (voters.length === 0) {
      html += `
        <div class="card empty-state">
          <i class="fas fa-users"></i>
          <h4>${t('no_voters_yet')}</h4>
          <p class="subtext">${t('add_voters_to_start')}</p>
          <button class="btn neon-btn" onclick="showAddVoterModal()">
            <i class="fas fa-user-plus"></i> ${t('add_first_voter')}
          </button>
        </div>
      `;
    } else {
      let votedCount = voters.filter(v => v.hasVoted && !v.isReplaced).length;
      let pendingCount = voters.filter(v => !v.hasVoted && !v.isReplaced).length;
      
      html += `
        <div class="card info-card" style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-around;text-align:center">
            <div>
              <div class="label">${t('active_voters')}</div>
              <div style="font-size:24px;font-weight:bold;color:#00eaff">${activeCount}</div>
            </div>
            <div>
              <div class="label">${t('voted')}</div>
              <div style="font-size:24px;font-weight:bold;color:#00ffaa">${votedCount}</div>
            </div>
            <div>
              <div class="label">${t('pending')}</div>
              <div style="font-size:24px;font-weight:bold;color:#ffc107">${pendingCount}</div>
            </div>
          </div>
        </div>
        
        <div style="display:flex;gap:10px;margin-bottom:15px">
          <input type="text" id="voterSearch" class="input" placeholder="${t('search_voters')}" style="flex:1" onkeyup="searchVoters()">
          <button class="btn neon-btn-outline" onclick="exportVotersCSV()">
            <i class="fas fa-file-csv"></i> ${t('csv')}
          </button>
          <button class="btn neon-btn" onclick="exportVotersPDF()">
            <i class="fas fa-file-pdf"></i> ${t('pdf')}
          </button>
        </div>
        
        <div id="votersList">
      `;
      
      voters.forEach(v => {
        if (v.isReplaced) return;
        
        // Display credential based on type
        const credType = getCredentialType(window.currentOrgData?.credentialType || 'email_phone');
        const primaryValue = v[credType.primaryField] || decodeURIComponent(v.id);
        const secondaryValue = v[credType.secondaryField] || '';
        const credentialDisplay = primaryValue;
        const secondaryDisplay = secondaryValue ? (credType.secondaryField === 'phone' ? formatPhoneForDisplay(secondaryValue) : secondaryValue) : '';
        
        // Get email for invite button (might be primary or secondary depending on credential type)
        const voterEmail = credType.primaryField === 'email' ? primaryValue : (credType.secondaryField === 'email' ? secondaryValue : '');
        const voterPhone = credType.primaryField === 'phone' ? primaryValue : (credType.secondaryField === 'phone' ? secondaryValue : '');
        
        const status = v.hasVoted ? 
          `<span style="color:#00ffaa;background:rgba(0,255,170,0.1);padding:4px 10px;border-radius:12px;font-size:12px">${t('voted_status')}</span>` :
          `<span style="color:#ffc107;background:rgba(255,193,7,0.1);padding:4px 10px;border-radius:12px;font-size:12px">${t('pending_status')}</span>`;
        
        html += `
          <div class="list-item voter-item" data-email="${primaryValue.toLowerCase()}" data-name="${(v.name || '').toLowerCase()}" style="align-items:center">
            <div style="display:flex;gap:12px;align-items:center;flex:1">
              <div style="width:40px;height:40px;border-radius:8px;background:linear-gradient(135deg,#9D00FF,#00C3FF);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">
                ${(v.name || primaryValue).charAt(0).toUpperCase()}
              </div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div>
                    <strong class="voter-name">${escapeHtml(v.name || primaryValue)}</strong>
                    <div class="subtext voter-email" style="margin-top:2px">
                      <i class="fas ${credType.primaryIcon}"></i> ${escapeHtml(credentialDisplay)}
                    </div>
                    ${secondaryDisplay ? `<div class="subtext" style="margin-top:2px"><i class="fas ${credType.secondaryIcon}"></i> ${escapeHtml(secondaryDisplay)}</div>` : ''}
                  </div>
                  ${status}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="editVoterModal('${escapeHtml(v.id)}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn neon-btn-outline" onclick="showInviteMethodsMenu(event, '${escapeHtml(voterEmail)}', '${escapeHtml(voterPhone)}', '${escapeHtml(v.name || primaryValue)}')" title="Send Invite">
                <i class="fas fa-paper-plane"></i> <i class="fas fa-chevron-down" style="font-size:10px;margin-left:2px"></i>
              </button>
              <button class="btn btn-danger" onclick="removeVoter('${escapeHtml(v.id)}', '${escapeHtml(v.name || primaryValue)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
    }
    
    el.innerHTML = html;
    
  } catch(e) { 
    console.error("Error loading voters:", e);
    renderError("ecContent-voters", "Error loading voters: " + e.message, "loadECVoters()");
  }
}

/**
 * Show add voter modal
 */
export function showAddVoterModal() {
  // Check edit lock before opening modal
  if (checkEditLock(window.currentOrgData)) return;
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("add voters")) return;

  // Get organization's credential type
  const credType = getCredentialType(window.currentOrgData?.credentialType || 'email_phone');
  
  // Get translation function
  const t = window.t || ((key) => key);

  createModal(
    `<i class="fas fa-user-plus"></i> ${t('add_voter') || 'Add Voter'}`,
    `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="label">${t('full_name') || 'Full Name'} *</label>
          <input id="ecVoterNameInput" class="input" placeholder="${t('enter_full_name') || 'e.g. Ama Mensah'}" autocomplete="off">
        </div>
        
        <!-- Primary Credential Field -->
        <div>
          <label class="label">
            <i class="fas ${credType.primaryIcon}"></i> ${credType.primaryLabel} *
          </label>
          <input id="ecVoterPrimaryCredential" class="input" 
                 placeholder="${credType.primaryPlaceholder}" 
                 autocomplete="off">
          <small class="subtext">
            <i class="fas fa-info-circle"></i> ${credType.useCase}
          </small>
        </div>
        
        <!-- Secondary Credential Field (Optional) -->
        <div>
          <label class="label">
            <i class="fas ${credType.secondaryIcon}"></i> ${credType.secondaryLabel}
          </label>
          <input id="ecVoterSecondaryCredential" class="input" 
                 placeholder="${credType.secondaryPlaceholder}" 
                 autocomplete="off">
          <small class="subtext">${t('optional_field') || 'Optional - for backup access'}</small>
        </div>
        
        <div>
          <label class="label">${t('date_of_birth') || 'Date of Birth'} (${t('optional') || 'Optional'})</label>
          <input id="ecVoterDobInput" class="input" type="date">
        </div>
        
        <div style="background:rgba(0,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(0,255,255,0.2)">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" id="autoSendVoterInvite" checked>
            <span><i class="fas fa-paper-plane"></i> ${t('send_invitation_immediately') || 'Send invitation immediately'}</span>
          </label>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">
        <i class="fas fa-times"></i> ${t('cancel') || 'Cancel'}
      </button>
      <button class="btn neon-btn" onclick="addVoterWithCredential()">
        <i class="fas fa-check"></i> ${t('add_voter') || 'Add Voter'}
      </button>
    `
  );

  setTimeout(() => document.getElementById('ecVoterNameInput')?.focus(), 50);
}

/**
 * Add voter with flexible credential types
 */
export async function addVoterWithCredential() {
  // Check edit lock before allowing voter creation
  if (checkEditLock(window.currentOrgData)) return;
  
  try {
    if (!window.currentOrgId) {
      showToast("No organization selected", "error");
      return;
    }

    if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("add voters")) return;

    const name = (document.getElementById('ecVoterNameInput')?.value || "").trim();
    const primaryCredential = (document.getElementById('ecVoterPrimaryCredential')?.value || "").trim();
    const secondaryCredential = (document.getElementById('ecVoterSecondaryCredential')?.value || "").trim();
    const dob = (document.getElementById('ecVoterDobInput')?.value || "").trim();

    if (!name) {
      showToast("Name is required", "error");
      return;
    }

    if (!primaryCredential) {
      showToast("Primary credential is required", "error");
      return;
    }

    // Get organization's credential type
    const credentialTypeId = window.currentOrgData?.credentialType || 'email_phone';
    const credType = getCredentialType(credentialTypeId);

    // Validate primary credential
    const primaryValidation = validateCredential(credentialTypeId, primaryCredential, 'primary');
    if (!primaryValidation.isValid) {
      showToast(primaryValidation.error, "error");
      return;
    }

    // Validate secondary credential if provided
    if (secondaryCredential) {
      const secondaryValidation = validateCredential(credentialTypeId, secondaryCredential, 'secondary');
      if (!secondaryValidation.isValid) {
        showToast(secondaryValidation.error, "error");
        return;
      }
    }

    // Build document ID based on credential type
    const docId = buildVoterDocId(credentialTypeId, primaryCredential);

    // Check if voter already exists
    const voterRef = doc(db, "organizations", window.currentOrgId, "voters", docId);
    const existingSnap = await getDoc(voterRef);
    if (existingSnap.exists()) {
      const ex = existingSnap.data();
      if (!ex.isReplaced) {
        showToast("A voter with this credential already exists", "error");
        return;
      }
    }

    // Build voter payload with appropriate fields
    const payload = {
      name,
      credentialType: credentialTypeId,
      [credType.primaryField]: primaryCredential.trim(),
      hasVoted: false,
      isReplaced: false,
      addedAt: serverTimestamp(),
      addedByRole: "ec",
      orgId: window.currentOrgId
    };

    // Add secondary credential if provided
    if (secondaryCredential) {
      payload[credType.secondaryField] = secondaryCredential.trim();
    }

    // Add optional fields
    if (dob) payload.dateOfBirth = dob;

    await setDoc(voterRef, payload, { merge: true });

    // Increment voter count
    if (!existingSnap.exists()) {
      try {
        await updateDoc(doc(db, "organizations", window.currentOrgId), { voterCount: increment(1) });
      } catch (e) {
        console.warn("Could not increment voterCount:", e);
      }
    }

    // Auto-send invite if checked and email is available
    const shouldAutoSend = document.getElementById('autoSendVoterInvite')?.checked;
    const voterEmail = credType.primaryField === 'email' ? primaryCredential : (credType.secondaryField === 'email' ? secondaryCredential : null);
    
    if (shouldAutoSend && voterEmail) {
      try {
        const response = await fetch("/.netlify/functions/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: voterEmail,
            recipientType: "voter",
            orgName: window.currentOrgData?.name || window.currentOrgId,
            orgId: window.currentOrgId,
            recipientName: name,
            credentials: { 
              credential: primaryCredential, 
              type: credType.primaryField,
              label: credType.primaryLabel
            }
          })
        });

        if (!response.ok) {
          if (response.status === 405 || response.status === 404) {
            showToast("⚠️ Netlify Functions not available. Please run 'netlify dev' instead of Live Server.", "error", 5000);
            console.error("Netlify Functions Error: Make sure to run 'netlify dev' in terminal.");
          } else {
            showToast("Voter added, but invitation failed. You can resend manually.", "warning");
          }
        } else {
          const text = await response.text();
          const result = text ? JSON.parse(text) : {};
        
          if (result.ok) {
            showToast("Voter added and invitation sent!", "success");
          } else {
            showToast("Voter added, but invitation failed. You can resend manually.", "warning");
          }
        }
      } catch (inviteError) {
        console.error("Error sending invite:", inviteError);
        showToast("Voter added, but invitation failed. You can resend manually.", "warning");
      }
    } else {
      showToast("Voter added successfully!", "success");
    }

    // Close modal and reload
    document.querySelector('.modal-overlay')?.remove();
    if (typeof loadECVoters === 'function') loadECVoters();

  } catch (error) {
    console.error("Error adding voter:", error);
    showToast("Error: " + error.message, "error");
  }
}

/**
 * Add voter with email or phone
 */
export async function addVoterWithEmailOrPhone() {
  // ✅ PATCH 2: Check edit lock before allowing voter creation
  if (checkEditLock(window.currentOrgData)) return;
  
  try {
    if (!window.currentOrgId) {
      showToast("No organization selected", "error");
      return;
    }

    if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("add voters")) return;

    const name = (document.getElementById('ecVoterNameInput')?.value || "").trim();
    const credentialRaw = (document.getElementById('ecVoterCredentialInput')?.value || "").trim();
    const dob = (document.getElementById('ecVoterDobInput')?.value || "").trim();

    if (!name) {
      showToast("Name is required", "error");
      return;
    }

    if (!credentialRaw) {
      showToast("Credential (Email/Phone) is required", "error");
      return;
    }

    const credentialLower = credentialRaw.toLowerCase().trim();
    const isEmail = validateEmail(credentialLower);
    const docId = buildVoterDocId('email_phone', credentialRaw);

    let voterEmail = "";
    let voterPhone = "";

    if (isEmail) {
      voterEmail = credentialLower;
    } else {
      // Extract normalized phone from the credential
      const phoneMatch = credentialRaw.replace(/[\s\-\(\)]/g, '');
      if (!phoneMatch || phoneMatch.length < 7) {
        showToast("Please enter a valid phone number", "error");
        return;
      }
      voterPhone = phoneMatch;
    }

    // Check if voter already exists
    const voterRef = doc(db, "organizations", window.currentOrgId, "voters", docId);
    const existingSnap = await getDoc(voterRef);
    if (existingSnap.exists()) {
      const ex = existingSnap.data();
      if (!ex.isReplaced) {
        showToast("A voter with this credential already exists", "error");
        return;
      }
    }

    // Save voter
    const payload = {
      name,
      credentialType: 'email_phone',
      email: voterEmail || "",
      phone: normalizePhoneE164(voterPhone || ""),
      hasVoted: false,
      isReplaced: false,
      addedAt: serverTimestamp(),
      addedByRole: "ec",
      orgId: window.currentOrgId
    };

    if (dob) payload.dateOfBirth = dob;

    await setDoc(voterRef, payload, { merge: true });

    // Increment voter count
    if (!existingSnap.exists()) {
      try {
        await updateDoc(doc(db, "organizations", window.currentOrgId), { voterCount: increment(1) });
      } catch (e) {
        console.warn("Could not increment voterCount:", e);
      }
    }

    // Auto-send invite if checked
    const shouldAutoSend = document.getElementById('autoSendVoterInvite')?.checked && voterEmail;
    if (shouldAutoSend) {
      try {
        const response = await fetch("/.netlify/functions/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: voterEmail,
            recipientType: "voter",
            orgName: window.currentOrgData?.name || window.currentOrgId,
            orgId: window.currentOrgId,
            recipientName: name,
            credentials: { credential: voterEmail, type: 'email' }
          })
        });
        
        if (response.ok) {
          const text = await response.text();
          const result = text ? JSON.parse(text) : {};
          
          if (result.ok) {
            const inviteRef = collection(db, "organizations", window.currentOrgId, "invites");
            await addDoc(inviteRef, {
              type: "voter",
              email: voterEmail,
              name: name,
              sentAt: serverTimestamp(),
              status: "sent",
              sentBy: "ec"
            });
          }
        }
      } catch (e) {
        console.warn("Auto-send invite failed:", e);
      }
    }

    document.querySelector('.modal-overlay')?.remove();
    showToast("Voter added successfully" + (shouldAutoSend ? " & invite sent" : ""), "success");
    loadECVoters();
  } catch (e) {
    console.error("Error adding voter:", e);
    showToast("Failed to add voter: " + (e?.message || "Unknown error"), "error");
  }
}

/**
 * Edit voter modal
 */
export async function editVoterModal(voterId) {
  try {
    // Check edit lock before opening modal
    if (checkEditLock(window.currentOrgData)) return;
    if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("edit voters")) return;

    const voterRef = doc(db, "organizations", window.currentOrgId, "voters", voterId);
    const voterSnap = await getDoc(voterRef);
    
    if (!voterSnap.exists()) {
      showToast('Voter not found', 'error');
      return;
    }
    
    const voter = voterSnap.data();
    const currentEmail = decodeURIComponent(voterId);
    
    createModal(
      `<i class="fas fa-edit"></i> Edit Voter: ${voter.name}`,
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Current Email</label>
            <input class="input" value="${escapeHtml(currentEmail)}" disabled style="background: rgba(255,255,255,0.05);">
          </div>
          <div>
            <label class="label">Full Name *</label>
            <input id="editVoterName" class="input" value="${escapeHtml(voter.name || '')}" required>
          </div>
          <div>
            <label class="label">Phone Number</label>
            <input id="editVoterPhone" class="input" value="${escapeHtml(voter.phone || '')}" placeholder="+233XXXXXXXXX">
          </div>
          <div>
            <label class="label">Date of Birth</label>
            <input id="editVoterDob" class="input" value="${voter.dateOfBirth || ''}" type="date">
          </div>
          <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px;">
            <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
              <i class="fas fa-info-circle"></i> Voter Status:
            </div>
            <div style="font-size: 12px; color: ${voter.hasVoted ? '#00ffaa' : '#ffc107'};">
              ${voter.hasVoted ? '✅ Has voted' : '⏳ Pending vote'}
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updateVoter('${voterId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => document.getElementById('editVoterName')?.focus(), 100);
  } catch(e) {
    console.error('Error loading voter:', e);
    showToast('Error loading voter details', 'error');
  }
}

/**
 * Update voter
 */
export async function updateVoter(voterId) {
  // ✅ PATCH 2: Check edit lock before allowing voter update
  if (checkEditLock(window.currentOrgData)) return;
  
  const name = document.getElementById('editVoterName')?.value.trim();
  const dob = document.getElementById('editVoterDob')?.value.trim();
  const phone = document.getElementById('editVoterPhone')?.value.trim();
  
  if (!name) {
    showToast('Name is required', 'error');
    return;
  }
  
  try {
    const voterRef = doc(db, "organizations", window.currentOrgId, "voters", voterId);
    const updateData = {
      name: name,
      phone: normalizePhoneE164(phone || ''),
      updatedAt: serverTimestamp()
    };
    
    if (dob) {
      updateData.dateOfBirth = dob;
    }
    
    await updateDoc(voterRef, updateData);
    
    showToast('Voter updated successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECVoters();
  } catch(e) {
    console.error('Error updating voter:', e);
    showToast('Error updating voter: ' + e.message, 'error');
  }
}

/**
 * Remove voter
 */
export async function removeVoter(voterId, voterName) {
  // ✅ PATCH 2: Check edit lock before allowing voter deletion
  if (checkEditLock(window.currentOrgData)) return;
  
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("delete voters")) return;

  if (!confirm(`Delete voter: ${voterName}?\n\nThis cannot be undone.`)) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, "organizations", window.currentOrgId, "voters", voterId));
    
    try {
      await updateDoc(doc(db, "organizations", window.currentOrgId), { voterCount: increment(-1) });
    } catch (e) {
      console.warn("Could not decrement voterCount:", e);
    }
    
    showToast('Voter deleted successfully', 'success');
    loadECVoters();
  } catch(e) {
    console.error('Error deleting voter:', e);
    showToast('Error deleting voter: ' + e.message, 'error');
  }
}

/**
 * Search voters (client-side filter)
 */
export function searchVoters() {
  const search = document.getElementById('voterSearch')?.value.toLowerCase() || '';
  const items = document.querySelectorAll('.voter-item');
  
  items.forEach(item => {
    const name = item.getAttribute('data-name') || '';
    const email = item.getAttribute('data-email') || '';
    const matches = name.includes(search) || email.includes(search);
    item.style.display = matches ? 'flex' : 'none';
  });
}

/**
 * Refresh voters list
 */
export function refreshVoters() {
  loadECVoters();
  showToast("Voters list refreshed", "success");
}

/**
 * Show bulk voter add modal
 */
export function showBulkVoterModal() {
  // Check edit lock before opening modal
  if (checkEditLock(window.currentOrgData)) return;
  
  createModal(
    '<i class="fas fa-users"></i> Bulk Add Voters',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <!-- Tab Switcher -->
        <div style="display: flex; gap: 8px; padding: 4px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08);">
          <button class="bulk-import-tab active" onclick="switchBulkImportTab('manual')" data-tab="manual" style="flex: 1; padding: 10px 16px; border: 1px solid transparent; border-radius: 10px; background: linear-gradient(135deg, var(--accent-primary), var(--accent-success)); color: #002b2b; font-weight: 600; cursor: pointer; transition: all 0.3s;">
            <i class="fas fa-keyboard"></i> Manual Entry
          </button>
          <button class="bulk-import-tab" onclick="switchBulkImportTab('file')" data-tab="file" style="flex: 1; padding: 10px 16px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; background: transparent; color: var(--text-muted); font-weight: 600; cursor: pointer; transition: all 0.3s;">
            <i class="fas fa-file-excel"></i> Upload Excel
          </button>
        </div>
        
        <!-- Manual Entry Tab -->
        <div id="bulkImportManual" class="bulk-import-content">
          <div>
            <label class="label">Voter Data (CSV Format)</label>
            <textarea id="bulkVoterData" class="input" placeholder="Format: Name, Email, Phone&#10;John Doe, john@example.com, +233501234567&#10;Jane Smith, jane@example.com, +233502345678" rows="8" style="font-family: monospace;"></textarea>
            <div class="subtext" style="margin-top: 5px;">
              <i class="fas fa-info-circle"></i> One voter per line. Email OR Phone is required.
            </div>
          </div>
        </div>
        
        <!-- File Upload Tab -->
        <div id="bulkImportFile" class="bulk-import-content" style="display: none;">
          <div>
            <label class="label">Upload Excel File (.xlsx, .xls)</label>
            <input type="file" id="bulkVoterFile" class="input" accept=".xlsx,.xls" onchange="handleBulkVoterFile()">
            <div class="subtext" style="margin-top: 5px;">
              <i class="fas fa-info-circle"></i> Excel file should have columns: Name, Email, Phone (Header row optional)
            </div>
            <div id="excelPreview" style="margin-top: 15px; display: none;">
              <div style="padding: 12px; background: rgba(0, 255, 170, 0.1); border: 1px solid rgba(0, 255, 170, 0.3); border-radius: 8px;">
                <div style="color: #00ffaa; font-weight: bold; margin-bottom: 5px;">
                  <i class="fas fa-check-circle"></i> File Loaded
                </div>
                <div class="subtext" id="excelPreviewText"></div>
              </div>
            </div>
          </div>
          <div style="margin-top: 15px; padding: 12px; background: rgba(0, 234, 255, 0.05); border: 1px solid rgba(0, 234, 255, 0.2); border-radius: 8px;">
            <div style="font-weight: bold; color: #00eaff; margin-bottom: 8px;">
              <i class="fas fa-download"></i> Download Excel Template
            </div>
            <button class="btn neon-btn-outline" onclick="downloadVoterTemplate()" style="width: 100%;">
              <i class="fas fa-file-excel"></i> Download Template (.xlsx)
            </button>
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="processBulkVoters()">
        <i class="fas fa-upload"></i> Import Voters
      </button>
    `
  );
}

/**
 * Switch between manual and file import tabs
 */
window.switchBulkImportTab = function(tab) {
  // Update tab buttons
  document.querySelectorAll('.bulk-import-tab').forEach(btn => {
    if (btn.dataset.tab === tab) {
      btn.style.background = 'linear-gradient(135deg, var(--accent-primary), var(--accent-success))';
      btn.style.color = '#002b2b';
      btn.style.borderColor = 'transparent';
      btn.classList.add('active');
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text-muted)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      btn.classList.remove('active');
    }
  });
  
  // Show/hide content
  document.getElementById('bulkImportManual').style.display = tab === 'manual' ? 'block' : 'none';
  document.getElementById('bulkImportFile').style.display = tab === 'file' ? 'block' : 'none';
};

/**
 * Handle Excel file upload
 */
window.handleBulkVoterFile = async function() {
  const fileInput = document.getElementById('bulkVoterFile');
  const file = fileInput?.files?.[0];
  
  if (!file) return;
  
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    
    // Check if first row looks like headers
    const hasHeaders = jsonData[0]?.some(cell => 
      typeof cell === 'string' && 
      (cell.toLowerCase().includes('name') || 
       cell.toLowerCase().includes('email') || 
       cell.toLowerCase().includes('phone'))
    );
    
    // Skip header row if detected
    const dataRows = hasHeaders ? jsonData.slice(1) : jsonData;
    const validRows = dataRows.filter(row => row && row.length > 0 && row.some(cell => cell));
    
    // Store parsed data globally for processBulkVoters
    window.parsedExcelVoters = validRows.map(row => ({
      name: row[0] || '',
      email: row[1] || '',
      phone: normalizePhoneE164(row[2] || '')
    })).filter(v => v.name && (v.email || v.phone));
    
    // Show preview
    const preview = document.getElementById('excelPreview');
    const previewText = document.getElementById('excelPreviewText');
    if (preview && previewText) {
      preview.style.display = 'block';
      previewText.textContent = `${window.parsedExcelVoters.length} voters ready to import`;
    }
    
    showToast(`✅ Loaded ${window.parsedExcelVoters.length} voters from Excel`, 'success');
  } catch (e) {
    console.error('Error parsing Excel:', e);
    showToast('Error reading Excel file: ' + e.message, 'error');
    window.parsedExcelVoters = null;
  }
};

/**
 * Download voter template Excel file
 */
window.downloadVoterTemplate = function() {
  // Create sample data
  const data = [
    ['Name', 'Email', 'Phone'],
    ['John Doe', 'john.doe@example.com', '+233501234567'],
    ['Jane Smith', 'jane.smith@example.com', '+233502345678'],
    ['Bob Johnson', 'bob.johnson@example.com', '+233503456789']
  ];
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Name
    { wch: 30 }, // Email
    { wch: 20 }  // Phone
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Voters');
  
  // Download
  XLSX.writeFile(wb, 'voter_template.xlsx');
  showToast('Template downloaded!', 'success');
};

/**
 * Process bulk voters
 */
export async function processBulkVoters() {
  let votersToAdd = [];
  
  // Check if we have Excel data
  if (window.parsedExcelVoters && window.parsedExcelVoters.length > 0) {
    votersToAdd = window.parsedExcelVoters;
    window.parsedExcelVoters = null; // Clear after use
  } else {
    // Parse manual text input
    const data = document.getElementById('bulkVoterData')?.value.trim();
    if (!data) {
      showToast('Please enter voter data or upload an Excel file', 'error');
      return;
    }
    
    const lines = data.split('\n').filter(line => line.trim());
    votersToAdd = lines.map(line => {
      const parts = line.split(',').map(part => part.trim());
      return {
        name: parts[0] || '',
        email: parts[1] ? parts[1].toLowerCase() : '',
        phone: normalizePhoneE164(parts[2] || '')
      };
    }).filter(v => v.name && (v.email || v.phone));
  }
  
  if (votersToAdd.length === 0) {
    showToast('No valid voter data found', 'error');
    return;
  }
  
  let added = 0;
  let failed = 0;
  
  showToast(`Importing ${votersToAdd.length} voters...`, 'info');
  
  for (const voter of votersToAdd) {
    const { name, email, phone } = voter;
    
    if (!name || (!email && !phone)) {
      failed++;
      continue;
    }
    
    try {
      const isEmail = validateEmail(email);
      const credential = isEmail ? email : phone;
      const docId = buildVoterDocId('email_phone', credential);
      
      const voterRef = doc(db, "organizations", window.currentOrgId, "voters", docId);
      await setDoc(voterRef, {
        name,
        email: email || "",
        phone: normalizePhoneE164(phone || ""),
        credentialType: 'email_phone',
        hasVoted: false,
        isReplaced: false,
        addedAt: serverTimestamp(),
        addedByRole: "ec",
        orgId: window.currentOrgId
      }, { merge: true });
      
      added++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch(e) {
      console.error('Error adding voter:', e);
      failed++;
    }
  }
  
  document.querySelector('.modal-overlay')?.remove();
  showToast(`Added ${added} voters${failed > 0 ? `. Failed: ${failed}` : ''}`, added > 0 ? 'success' : 'error');
  
  if (added > 0) {
    try {
      await updateDoc(doc(db, "organizations", window.currentOrgId), { voterCount: increment(added) });
    } catch(e) {
      console.warn("Could not update voterCount:", e);
    }
    loadECVoters();
  }
}

/**
 * Export voters to CSV
 */
export async function exportVotersCSV() {
  try {
    const snap = await getDocs(collection(db, "organizations", window.currentOrgId, "voters"));
    const voters = [];
    snap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    let csv = "Name,Email,Phone,Voted\n";
    voters.forEach(v => {
      if (v.isReplaced) return;
      const email = decodeURIComponent(v.id);
      csv += `"${v.name || ''}","${email}","${v.phone || ''}","${v.hasVoted ? 'Yes' : 'No'}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voters-${window.currentOrgId}-${Date.now()}.csv`;
    a.click();
    
    showToast('Voters exported successfully', 'success');
  } catch(e) {
    console.error('Error exporting voters:', e);
    showToast('Error exporting voters', 'error');
  }
}

/**
 * Export voters list as PDF
 */
export async function exportVotersPDF() {
  try {
    const jsp = window.jspdf;
    if (!jsp || !jsp.jsPDF) return showToast("PDF library missing", "error");

    const pdf = new jsp.jsPDF("p", "mm", "a4");
    const margin = 15;
    const pageHeight = 297;
    let y = 15;

    // Load org data and images
    const orgSnap = await getDoc(doc(db, "organizations", window.currentOrgId));
    const org = orgSnap.exists() ? orgSnap.data() : {};
    
    const { loadImageAsBase64 } = await import('../reports/exports.js');
    const appLogoData = await loadImageAsBase64('./neon-logo.png');
    const orgLogoData = org.logoUrl ? await loadImageAsBase64(org.logoUrl) : null;

    // ===== HEADER =====
    pdf.setFillColor(26, 189, 156);
    pdf.rect(0, 0, 210, 28, "F");

    if (appLogoData) {
      try {
        // Add matching background behind logo for seamless blend
        pdf.setFillColor(26, 189, 156);
        pdf.rect(margin - 1, 3, 22, 22, "F");
        pdf.addImage(appLogoData, 'PNG', margin, 4, 20, 20);
      } catch (e) {
        console.warn('Failed to add app logo:', e);
      }
    }

    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("VOTER LIST", appLogoData ? margin + 24 : margin, 12);

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(220, 240, 235);
    pdf.text("Neon Voting Platform - Official Voter Registry", appLogoData ? margin + 24 : margin, 19);

    y = 35;

    // ===== ORG INFO =====
    pdf.setFillColor(248, 250, 251);
    const metaBoxHeight = orgLogoData ? 24 : 18;
    pdf.rect(margin, y - 2, 180, metaBoxHeight, "F");
    pdf.setDrawColor(200, 200, 210);
    pdf.rect(margin, y - 2, 180, metaBoxHeight);

    if (orgLogoData) {
      try {
        pdf.addImage(orgLogoData, 'PNG', margin + 3, y, 18, 18);
      } catch (e) {
        console.warn('Failed to add org logo:', e);
      }
    }

    const textStartX = orgLogoData ? margin + 24 : margin + 3;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 130, 110);
    pdf.text("ORGANIZATION DETAILS", textStartX, y + 2);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 70);
    pdf.text(`Organization: ${org.name || window.currentOrgId}`, textStartX, y + 7);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, textStartX, y + 11);
    pdf.text(`Election Type: ${org.electionType || 'N/A'}`, textStartX, y + 15);

    y += metaBoxHeight + 6;

    // ===== FETCH VOTERS =====
    const snap = await getDocs(collection(db, "organizations", window.currentOrgId, "voters"));
    const voters = [];
    snap.forEach(s => {
      const data = s.data();
      if (!data.isReplaced) {
        voters.push({ id: s.id, ...data });
      }
    });

    const totalVoters = voters.length;
    const votedCount = voters.filter(v => v.hasVoted).length;
    const pendingCount = totalVoters - votedCount;

    // ===== SUMMARY STATS =====
    pdf.setFillColor(248, 250, 251);
    pdf.rect(margin, y - 2, 180, 14, "F");
    pdf.setDrawColor(200, 200, 210);
    pdf.rect(margin, y - 2, 180, 14);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 130, 110);
    pdf.text("SUMMARY", margin + 3, y + 2);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 70);
    pdf.text(`Total Voters: ${totalVoters}  |  Voted: ${votedCount}  |  Pending: ${pendingCount}`, margin + 3, y + 8);

    y += 18;

    // ===== TABLE HEADER =====
    pdf.setFillColor(26, 189, 156);
    pdf.rect(margin, y, 180, 7, "F");

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("Name", margin + 2, y + 4.5);
    pdf.text("Email", margin + 50, y + 4.5);
    pdf.text("Phone", margin + 110, y + 4.5);
    pdf.text("Status", margin + 160, y + 4.5);

    y += 7.5;

    // ===== TABLE ROWS =====
    voters.forEach((v, idx) => {
      // Check if need new page
      if (y > pageHeight - 30) {
        pdf.addPage();
        y = 15;
        
        // Repeat header on new page
        pdf.setFillColor(26, 189, 156);
        pdf.rect(margin, y, 180, 7, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text("Name", margin + 2, y + 4.5);
        pdf.text("Email", margin + 50, y + 4.5);
        pdf.text("Phone", margin + 110, y + 4.5);
        pdf.text("Status", margin + 160, y + 4.5);
        y += 7.5;
      }

      // Alternating row background
      if (idx % 2 === 0) {
        pdf.setFillColor(255, 255, 255);
      } else {
        pdf.setFillColor(248, 250, 251);
      }
      pdf.rect(margin, y, 180, 6, "F");

      // Row border
      pdf.setDrawColor(200, 200, 210);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, y, 180, 6);

      // Row content
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 50);

      const email = decodeURIComponent(v.id);
      const name = v.name || 'N/A';
      const phone = v.phone || 'N/A';
      const status = v.hasVoted ? 'Voted' : 'Pending';

      // Truncate long text
      pdf.text(name.substring(0, 25), margin + 2, y + 4);
      pdf.text(email.substring(0, 30), margin + 50, y + 4);
      pdf.text(phone.substring(0, 18), margin + 110, y + 4);
      
      // Status with color
      if (v.hasVoted) {
        pdf.setTextColor(0, 170, 0);
        pdf.setFont("helvetica", "bold");
        pdf.text("VOTED", margin + 160, y + 4);
        pdf.setFont("helvetica", "normal");
      } else {
        pdf.setTextColor(255, 150, 0);
        pdf.text("Pending", margin + 160, y + 4);
      }

      y += 6;
    });

    // ===== FOOTER =====
    const footerY = pageHeight - 10;
    pdf.setDrawColor(26, 189, 156);
    pdf.setLineWidth(0.8);
    pdf.line(margin, footerY - 2, 210 - margin, footerY - 2);

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120, 120, 130);
    pdf.text(`Neon Voting Platform | ${new Date().toLocaleString()}`, margin, footerY);
    pdf.text(`Org: ${org.name || window.currentOrgId}`, 210 - margin - 50, footerY);

    pdf.save(`Voters_${org.name || window.currentOrgId}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Voter list exported as PDF successfully', 'success');
  } catch(e) {
    console.error('Error exporting voters PDF:', e);
    showToast('Error exporting PDF: ' + e.message, 'error');
  }
}

/**
 * Show invite methods dropdown menu
 */
function showInviteMethodsMenu(event, voterEmail, voterPhone, voterName) {
  event.stopPropagation();
  
  // Remove any existing menu
  const existingMenu = document.querySelector('.invite-methods-menu');
  if (existingMenu) {
    existingMenu.remove();
    return; // Toggle off if clicking same button
  }
  
  const hasEmail = voterEmail && voterEmail !== 'undefined' && voterEmail.includes('@');
  const hasPhone = voterPhone && voterPhone !== 'undefined' && voterPhone.length > 5;
  
  // Create dropdown menu
  const menu = document.createElement('div');
  menu.className = 'invite-methods-menu';
  menu.style.cssText = `
    position: fixed;
    background: var(--card-bg, #1a2332);
    border: 1px solid var(--neon-cyan, #00ffff);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 255, 255, 0.3);
    z-index: 10000;
    min-width: 180px;
    padding: 8px 0;
  `;
  
  // Position menu near the button
  const buttonRect = event.target.closest('button').getBoundingClientRect();
  menu.style.top = `${buttonRect.bottom + 5}px`;
  menu.style.left = `${buttonRect.left}px`;
  
  // Menu options
  const options = [
    {
      icon: 'fas fa-envelope',
      label: 'Email',
      available: hasEmail,
      action: () => window.sendVoterInvite(voterEmail, voterName, voterPhone),
      unavailableMsg: 'No email on file'
    },
    {
      icon: 'fas fa-sms',
      label: 'SMS',
      available: hasPhone,
      action: () => window.sendVoterInviteSMS(voterPhone, voterName),
      unavailableMsg: 'No phone on file'
    },
    {
      icon: 'fab fa-whatsapp',
      label: 'WhatsApp',
      available: hasPhone,
      action: () => window.sendVoterInviteWhatsApp(voterPhone, voterName),
      unavailableMsg: 'No phone on file'
    }
  ];
  
  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'invite-method-item';
    item.style.cssText = `
      padding: 10px 16px;
      cursor: ${opt.available ? 'pointer' : 'not-allowed'};
      display: flex;
      align-items: center;
      gap: 10px;
      color: ${opt.available ? 'var(--text-color, #fff)' : '#666'};
      opacity: ${opt.available ? '1' : '0.5'};
      transition: all 0.2s;
    `;
    
    if (opt.available) {
      item.onmouseover = () => {
        item.style.background = 'rgba(0, 255, 255, 0.1)';
        item.style.color = 'var(--neon-cyan, #00ffff)';
      };
      item.onmouseout = () => {
        item.style.background = 'transparent';
        item.style.color = 'var(--text-color, #fff)';
      };
      item.onclick = () => {
        menu.remove();
        opt.action();
      };
    } else {
      item.title = opt.unavailableMsg;
    }
    
    item.innerHTML = `
      <i class="${opt.icon}" style="width: 20px; text-align: center;"></i>
      <span>${opt.label}</span>
      ${!opt.available ? `<i class="fas fa-ban" style="margin-left: auto; font-size: 12px;"></i>` : ''}
    `;
    
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }, { once: true });
  }, 0);
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadECVoters = loadECVoters;
  window.showAddVoterModal = showAddVoterModal;
  window.addVoterWithCredential = addVoterWithCredential;
  window.addVoterWithEmailOrPhone = addVoterWithEmailOrPhone;
  window.editVoterModal = editVoterModal;
  window.updateVoter = updateVoter;
  window.removeVoter = removeVoter;
  window.searchVoters = searchVoters;
  window.refreshVoters = refreshVoters;
  window.showBulkVoterModal = showBulkVoterModal;
  window.processBulkVoters = processBulkVoters;
  window.exportVotersCSV = exportVotersCSV;
  window.exportVotersPDF = exportVotersPDF;
  window.showInviteMethodsMenu = showInviteMethodsMenu;
}
