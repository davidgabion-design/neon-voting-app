/**
 * Invites Module - Bulk Operations
 * Handles bulk invite sending and voter selection
 */

import { db } from '../config/firebase.js';
import { collection, getDocs, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, createModal } from '../utils/ui-helpers.js';
import { escapeHtml } from '../utils/validation.js';

/**
 * Show bulk voter invite modal
 */
export async function showBulkVoterModal() {
  try {
    const snap = await getDocs(collection(db, "organizations", window.currentOrgId, "voters"));
    const voters = [];
    snap.forEach(s => {
      const v = s.data();
      if (!v.isReplaced && (v.email || v.phone)) {
        voters.push({ id: s.id, ...v });
      }
    });
    
    let html = `
      <div style="display:flex;flex-direction:column;gap:15px">
        <div>
          <label class="label">Select Voters to Send Invites</label>
          <p class="subtext">Choose invite method and select voters</p>
        </div>
        
        <div>
          <label class="label">Invite Method</label>
          <select id="bulkInviteMethod" class="input" style="width:100%;margin-bottom:10px">
            <option value="email"><i class="fas fa-envelope"></i> Email</option>
            <option value="sms"><i class="fas fa-sms"></i> SMS</option>
            <option value="whatsapp"><i class="fab fa-whatsapp"></i> WhatsApp</option>
          </select>
        </div>
        
        <div>
          <button class="btn neon-btn-outline" onclick="selectAllBulkVoters()">
            <i class="fas fa-check-square"></i> Select All
          </button>
          <button class="btn neon-btn-outline" onclick="deselectAllBulkVoters()">
            <i class="fas fa-square"></i> Deselect All
          </button>
          <div id="selectedCount" class="subtext" style="margin-top:10px">Selected: 0</div>
        </div>
        
        <div style="max-height:400px;overflow-y:auto;border:1px solid rgba(0,255,255,0.2);border-radius:8px;padding:10px">
    `;
    
    voters.forEach(v => {
      const displayContact = v.email || v.phone || 'No contact';
      const hasEmail = !!v.email;
      const hasPhone = !!v.phone;
      html += `
        <label style="display:flex;gap:10px;padding:8px;align-items:center;cursor:pointer">
          <input type="checkbox" class="bulk-voter-checkbox" value="${escapeHtml(v.id)}" 
            data-email="${escapeHtml(v.email || '')}" 
            data-phone="${escapeHtml(v.phone || '')}" 
            data-name="${escapeHtml(v.name || displayContact)}" 
            onchange="updateBulkVoterCount()">
          <span>${escapeHtml(v.name || displayContact)}</span>
          <span class="subtext">
            ${hasEmail ? `<i class="fas fa-envelope" title="Has email"></i>` : ''}
            ${hasPhone ? `<i class="fas fa-phone" title="Has phone"></i>` : ''}
            ${displayContact}
          </span>
        </label>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    createModal(
      '<i class="fas fa-users"></i> Bulk Send Invites',
      html,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="sendBulkVoterInvites()">
          <i class="fas fa-paper-plane"></i> Send Invites
        </button>
      `
    );
  } catch (e) {
    console.error("Error showing bulk invite modal:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Select all bulk voters
 */
export function selectAllBulkVoters() {
  document.querySelectorAll(".bulk-voter-checkbox").forEach(cb => cb.checked = true);
  updateBulkVoterCount();
}

/**
 * Deselect all bulk voters
 */
export function deselectAllBulkVoters() {
  document.querySelectorAll(".bulk-voter-checkbox").forEach(cb => cb.checked = false);
  updateBulkVoterCount();
}

/**
 * Update bulk voter count display
 */
export function updateBulkVoterCount() {
  const count = document.querySelectorAll(".bulk-voter-checkbox:checked").length;
  const display = document.getElementById("selectedCount");
  if (display) display.textContent = `Selected: ${count}`;
}

/**
 * Send bulk voter invites
 */
export async function sendBulkVoterInvites() {
  try {
    const selected = Array.from(document.querySelectorAll(".bulk-voter-checkbox:checked"));
    if (selected.length === 0) {
      showToast("Please select at least one voter", "error");
      return;
    }
    
    const method = document.getElementById('bulkInviteMethod')?.value || 'email';
    
    if (!confirm(`Send ${method.toUpperCase()} invites to ${selected.length} voters?`)) return;
    
    showToast(`Sending ${selected.length} ${method.toUpperCase()} invites...`, "info");
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const checkbox of selected) {
      try {
        const email = checkbox.dataset.email;
        const phone = checkbox.dataset.phone;
        const name = checkbox.dataset.name;
        
        let response, inviteType, phoneToStore = phone;
        
        if (method === 'email') {
          if (!email) {
            skippedCount++;
            continue;
          }
          response = await fetch("/.netlify/functions/send-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: email,
              recipientType: "voter",
              orgName: window.currentOrgData?.name || window.currentOrgId,
              orgId: window.currentOrgId,
              recipientName: name,
              credentials: { credential: email, type: 'email' }
            })
          });
          inviteType = "voter";
        } else if (method === 'sms') {
          if (!phone) {
            skippedCount++;
            continue;
          }
          
          // Format phone to E.164 for Twilio
          let formattedPhone = phone.trim();
          formattedPhone = formattedPhone.replace(/[\s\-\(\)]/g, '');
          
          if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.startsWith('233')) {
              formattedPhone = '+' + formattedPhone;
            } else if (formattedPhone.startsWith('0')) {
              formattedPhone = '+233' + formattedPhone.substring(1);
            } else {
              formattedPhone = '+233' + formattedPhone;
            }
          }
          
          const appUrl = window.location.origin;
          const message = `Hi ${name}! You're invited to vote in ${window.currentOrgData?.name || window.currentOrgId} election. Visit: ${appUrl} Use Org ID: ${window.currentOrgId} 🗳️`;
          phoneToStore = formattedPhone; // Store formatted phone
          response = await fetch("/.netlify/functions/send-invite-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: formattedPhone,
              message: message,
              recipientType: "voter",
              orgId: window.currentOrgId,
              recipientName: name
            })
          });
          inviteType = "voter_sms";
        } else if (method === 'whatsapp') {
          if (!phone) {
            skippedCount++;
            continue;
          }
          let formattedPhone = phone.trim();
          
          // Remove spaces and special characters
          formattedPhone = formattedPhone.replace(/[\s\-\(\)]/g, '');
          
          if (!formattedPhone.startsWith('+')) {
            // If starts with 233 (country code), just add +
            if (formattedPhone.startsWith('233')) {
              formattedPhone = '+' + formattedPhone;
            }
            // If starts with 0, replace with +233
            else if (formattedPhone.startsWith('0')) {
              formattedPhone = '+233' + formattedPhone.substring(1);
            }
            // Otherwise assume local number
            else {
              formattedPhone = '+233' + formattedPhone;
            }
          }
          const appUrl = window.location.origin;
          const message = `Hi ${name}! You're invited to vote in ${window.currentOrgData?.name || window.currentOrgId} election. Visit: ${appUrl} Use Org ID: ${window.currentOrgId} 🗳️`;
          phoneToStore = formattedPhone; // Store formatted phone
          response = await fetch("/.netlify/functions/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: formattedPhone,
              message: message,
              voterName: name,
              orgId: window.currentOrgId
            })
          });
          inviteType = "voter_whatsapp";
        }
        
        if (!response.ok) {
          if (response.status === 405 || response.status === 404) {
            showToast("⚠️ Netlify Functions not available. Please run 'netlify dev' instead of Live Server.", "error", 5000);
            console.error("Netlify Functions Error: Make sure to run 'netlify dev' in terminal.");
            break;
          }
          errorCount++;
          continue;
        }
        
        const text = await response.text();
        const result = text ? JSON.parse(text) : { ok: false };
        
        if (result.ok) {
          successCount++;
          const inviteRef = collection(db, "organizations", window.currentOrgId, "invites");
          await addDoc(inviteRef, {
            type: inviteType,
            email: email || undefined,
            phone: phoneToStore || undefined,
            name: name,
            sentAt: serverTimestamp(),
            status: "sent",
            sentBy: "ec"
          });
        } else {
          errorCount++;
        }
        
        // Delay between sends
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        errorCount++;
      }
    }
    
    document.querySelector('.modal-overlay')?.remove();
    const summary = `✅ Sent: ${successCount}, Failed: ${errorCount}${skippedCount > 0 ? `, Skipped: ${skippedCount}` : ''}`;
    showToast(summary, successCount > 0 ? "success" : "error");
    
    // Reload tracking if available
    if (typeof window.loadInvitesTracking === 'function') {
      window.loadInvitesTracking();
    }
  } catch (e) {
    console.error("Error in bulk send:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Show bulk invite tab (for multi-tab bulk interface)
 */
export function showBulkTab(tabName) {
  try {
    // Hide all tabs
    document.querySelectorAll('.bulk-invite-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    document.querySelectorAll('.bulk-invite-container').forEach(container => {
      container.style.display = 'none';
    });
    
    // Show selected tab
    const targetTab = document.querySelector(`.bulk-invite-tab[onclick*="${tabName}"]`);
    if (targetTab) targetTab.classList.add('active');
    
    const targetContainer = document.getElementById(`bulkTab-${tabName}`);
    if (targetContainer) targetContainer.style.display = 'block';
  } catch (e) {
    console.error("Error in showBulkTab:", e);
  }
}

/**
 * Switch to bulk invite (from EC panel button)
 */
export function switchToBulkInvite() {
  try {
    // Switch to invites tab if showECTab is available
    if (typeof window.showECTab === 'function') {
      window.showECTab('invites');
    }
    
    // Wait for tab to load, then show bulk modal
    setTimeout(() => {
      showBulkVoterModal();
    }, 100);
  } catch (e) {
    console.error("Error in switchToBulkInvite:", e);
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.showBulkVoterModal = showBulkVoterModal;
  window.selectAllBulkVoters = selectAllBulkVoters;
  window.deselectAllBulkVoters = deselectAllBulkVoters;
  window.updateBulkVoterCount = updateBulkVoterCount;
  window.sendBulkVoterInvites = sendBulkVoterInvites;
  window.showBulkTab = showBulkTab;
  window.switchToBulkInvite = switchToBulkInvite;
}
