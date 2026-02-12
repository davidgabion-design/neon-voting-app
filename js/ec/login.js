/**
 * EC Module - Login & Authentication
 * Handles EC login, panel initialization, and UI updates
 */

import { db } from '../config/firebase.js';
import { doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showScreen, showToast } from '../utils/ui-helpers.js';
import { saveSession, getSession } from '../utils/session.js';

/**
 * Show EC OTP input and handle validation
 * @param {string} orgId
 */
function showECOTPInput(orgId) {
  const loginCard = document.getElementById('ecLoginCard') || document.body;
  // Remove previous OTP input if exists
  const prevOtp = document.getElementById('ecOtpInputGroup');
  if (prevOtp) prevOtp.remove();

  const otpHtml = `
    <div class="form-group" id="ecOtpInputGroup">
      <label class="label">
        <i class="fas fa-key"></i> Enter OTP <span style="color: var(--accent-danger);">*</span>
      </label>
      <input id="ecOtp" class="input" placeholder="6-digit code" autocomplete="off" maxlength="6" type="text">
      <div class="input-hint">
        <i class="fas fa-info-circle"></i> Check your SMS or email for the code. Expires in 5 minutes.
      </div>
      <button class="btn neon-btn-lg" style="width:100%;margin-top:10px;" onclick="window.validateECOTP('${orgId}')">
        <i class="fas fa-check"></i> Validate OTP
      </button>
      <button class="btn neon-btn-outline" style="width:100%;margin-top:5px;" onclick="window.resendECOTP('${orgId}')">
        <i class="fas fa-redo"></i> Resend OTP
      </button>
    </div>
  `;
  loginCard.insertAdjacentHTML('beforeend', otpHtml);
}

/**
 * Validate OTP for EC login
 */
window.validateECOTP = async function(orgId) {
  const otp = document.getElementById('ecOtp')?.value.trim();
  if (!otp) {
    showToast('Please enter the OTP code', 'error');
    return;
  }
  try {
    showToast('Validating OTP...', 'info');
    const res = await fetch('/.netlify/functions/validate-otp', {
      method: 'POST',
      body: JSON.stringify({ orgId, userId: 'ec', otp }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!data.ok) {
      showToast('OTP validation failed: ' + (data.error || 'Unknown error'), 'error');
      return;
    }
    showToast('OTP validated! Logging you in...', 'success');
    
    // Fetch org data first
    const orgDoc = await getDoc(doc(db, 'organizations', orgId));
    if (!orgDoc.exists()) {
      showToast('Organization not found', 'error');
      return;
    }
    const orgData = orgDoc.data();
    
    // Establish EC session and open panel
    const session = getSession();
    session.role = 'ec'; 
    session.orgId = orgId; 
    window.currentOrgId = orgId;
    window.currentOrgData = orgData;
    window.signatureState = window.signatureState || { ec:null, superAdmin:null };
    window.signatureState.ec = { 
      name: orgData.ecName || 'Election Commissioner', 
      role: 'Election Commissioner', 
      signedAt: new Date().toLocaleString(), 
      image: null 
    };
    saveSession();
    showScreen("ecPanel");
    await openECPanel(orgId);
    // Start automatic alert scheduler
    if (typeof startAlertScheduler === 'function') {
      startAlertScheduler();
    }
    document.getElementById("ec-org-id") && (document.getElementById("ec-org-id").value = "");
    document.getElementById("ec-pass") && (document.getElementById("ec-pass").value = "");
    showToast("EC logged in successfully", "success");
  } catch (otpErr) {
    showToast('OTP validation error: ' + otpErr.message, 'error');
  }
};

/**
 * Resend OTP for EC login
 */
window.resendECOTP = async function(orgId) {
  try {
    showToast('Resending OTP...', 'info');
    const org = window.currentOrgData;
    if (!org) {
      showToast('Session expired. Please refresh and try again.', 'error');
      return;
    }
    
    const credential = org.ecEmail || org.ecPhone || org.contactEmail || org.contactPhone || '';
    const method = org.ecEmail || org.contactEmail ? 'email' : 'sms';
    
    if (!credential) {
      showToast('No contact information found.', 'error');
      return;
    }
    
    const res = await fetch('/.netlify/functions/send-otp', {
      method: 'POST',
      body: JSON.stringify({ orgId, userId: 'ec', credential, method }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!data.ok) {
      showToast('Failed to resend OTP: ' + (data.error || 'Unknown error'), 'error');
      return;
    }
    showToast('OTP resent to ' + credential + '!', 'success');
  } catch (err) {
    showToast('Resend error: ' + err.message, 'error');
  }
};

/**
 * Login as Election Commissioner
 */
export async function loginEC() {
  const id = document.getElementById("ec-org-id")?.value.trim();
  const pass = document.getElementById("ec-pass")?.value.trim();
  
  if (!id || !pass) { 
    showToast("Enter organization ID and password", "error"); 
    return; 
  }
  
  // Check if Firebase is initialized
  if (!db) {
    showToast("Firebase not initialized. Please refresh the page.", "error");
    console.error("Firebase db is not initialized");
    return;
  }
  
  try {
    const ref = doc(db, "organizations", id);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) { 
      showToast("Organization not found", "error"); 
      return; 
    }
    
    const org = snap.data();
    
    if (org.ecPassword !== pass) { 
      showToast("Wrong EC password", "error"); 
      return; 
    }

    // Step 1: Request OTP for EC
    try {
      showToast('Sending OTP...', 'info');
      // Try email first, fallback to phone, then use org contact
      const credential = org.ecEmail || org.ecPhone || org.contactEmail || org.contactPhone || '';
      const method = org.ecEmail || org.contactEmail ? 'email' : 'sms';
      
      if (!credential) {
        showToast('No contact information found. Contact Super Admin to add EC email/phone.', 'error');
        return;
      }
      
      // Store org data for later use
      window.currentOrgData = org;
      window.currentOrgData.id = id;
      
      const res = await fetch('/.netlify/functions/send-otp', {
        method: 'POST',
        body: JSON.stringify({ orgId: id, userId: 'ec', credential, method }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!data.ok) {
        showToast('Failed to send OTP: ' + (data.error || 'Unknown error'), 'error');
        return;
      }
      showToast('OTP sent to ' + credential + ' via ' + method + '!', 'success');
      // Show OTP input field
      showECOTPInput(id);
      return;
    } catch (otpErr) {
      showToast('OTP error: ' + otpErr.message, 'error');
      return;
    }
  } catch(e) { 
    console.error(e); 
    showToast("Login failed", "error"); 
  }
}

/**
 * Open EC panel and set up real-time listener
 */
export async function openECPanel(orgId) {
  window.currentOrgId = orgId;
  
  if (window.currentOrgUnsub) {
    window.currentOrgUnsub();
    window.currentOrgUnsub = null;
  }
  
  try {
    const ref = doc(db, "organizations", orgId);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      showToast("Organization not found", "error");
      if (typeof window.logout === 'function') window.logout();
      return;
    }
    
    window.currentOrgData = { id: window.currentOrgId, ...snap.data() };
    
    // ✅ PATCH: Validate election type is configured
    if (!window.currentOrgData.electionType) {
      showToast('Election type not configured. Contact Super Admin.', 'warning');
      console.warn('Organization missing electionType field');
      // Continue anyway but log the issue
    }
    
    updateECUI();
    
    // ✅ Show first-time walkthrough for new EC users
    if (typeof window.showECWalkthrough === 'function') {
      setTimeout(() => window.showECWalkthrough(), 1500);
    }
    
    // ✅ PATCH 3: Render approval status banner
    const { renderECApprovalStatus } = await import('./dashboard.js');
    renderECApprovalStatus(window.currentOrgData);
    
    if (typeof electionRealtimeTick === 'function') {
      electionRealtimeTick(window.currentOrgId, window.currentOrgData);
    }
    
    const { showECTab } = await import('./dashboard.js');
    await showECTab(window.activeTab || 'voters');
    
    window.currentOrgUnsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        window.currentOrgData = { id: window.currentOrgId, ...snap.data() };
        updateECUI();
        
        // ✅ PATCH 3: Update approval banner on real-time changes
        renderECApprovalStatus(window.currentOrgData);
        
        if (typeof electionRealtimeTick === 'function') {
          electionRealtimeTick(window.currentOrgId, window.currentOrgData);
        }
        
        // Reload active tab data
        if (window.activeTab === 'outcomes' && typeof loadECOutcomes === 'function') {
          loadECOutcomes();
        } else if (window.activeTab === 'voters' && typeof loadECVoters === 'function') {
          loadECVoters();
        } else if (window.activeTab === 'approval' && typeof loadECApproval === 'function') {
          loadECApproval();
        }
      } else {
        showToast("Organization deleted", "error");
        if (typeof window.logout === 'function') window.logout();
      }
    });
    
  } catch (e) {
    console.error("Error opening EC panel:", e);
    showToast("Error loading organization data", "error");
  }
}

/**
 * Update EC UI with current organization data
 */
export function updateECUI() {
  if (!window.currentOrgData) return;
  
  const orgNameEl = document.getElementById('ecOrgName');
  const orgIdEl = document.getElementById('ecOrgIdDisplay');
  const electionTypeEl = document.getElementById('ecElectionType');
  const electionStatusEl = document.getElementById('ecElectionStatus');
  
  if (orgNameEl) {
    orgNameEl.textContent = window.currentOrgData.name || window.currentOrgId;
  }
  
  if (orgIdEl) {
    orgIdEl.textContent = window.currentOrgId;
  }
  
  // Update election type
  if (electionTypeEl) {
    const electionTypeLabels = {
      'single_winner': '🏆 Single Winner',
      'multiple_winner': '👥 Multiple Winners',
      'referendum': '✓ Referendum',
      'custom': '⚙️ Custom'
    };
    electionTypeEl.textContent = electionTypeLabels[window.currentOrgData.electionType] || '—';
    electionTypeEl.className = 'badge info';
  }
  
  // Update election status
  if (electionStatusEl) {
    const status = window.currentOrgData.electionStatus || 'active';
    const statusConfig = {
      'active': { label: 'Active', class: 'success' },
      'scheduled': { label: 'Scheduled', class: 'warning' },
      'declared': { label: 'Results Declared', class: 'info' },
      'locked': { label: 'Locked', class: 'warning' }
    };
    const config = statusConfig[status] || { label: status, class: '' };
    electionStatusEl.textContent = config.label;
    electionStatusEl.className = `badge ${config.class}`;
  }
}

/**
 * Restore EC session from localStorage
 * Called on app initialization to maintain login state across page refreshes
 * @returns {Promise<boolean>} True if session was restored, false otherwise
 */
export async function restoreECSession() {
  try {
    const { getSession } = await import('../utils/session.js');
    const session = getSession();
    
    // Check if EC session exists
    if (session && session.role === 'ec' && session.orgId) {
      console.log('Restoring EC session for org:', session.orgId);
      
      // Verify organization still exists
      const ref = doc(db, "organizations", session.orgId);
      const snap = await getDoc(ref);
      
      if (!snap.exists()) {
        console.warn('Organization no longer exists, clearing session');
        const { clearSession } = await import('../utils/session.js');
        clearSession();
        return false;
      }
      
      // Restore EC panel
      showScreen("ecPanel");
      await openECPanel(session.orgId);
      
      // Start alert scheduler
      if (typeof window.startAlertScheduler === 'function') {
        window.startAlertScheduler();
      }
      
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error restoring EC session:', e);
    return false;
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loginEC = loginEC;
  window.openECPanel = openECPanel;
  window.updateECUI = updateECUI;
  window.restoreECSession = restoreECSession;
  
  // Auto-fill org ID from invite link
  window.addEventListener('load', () => {
    const inviteOrgId = sessionStorage.getItem('inviteOrgId');
    if (inviteOrgId) {
      const orgIdField = document.getElementById('ec-org-id');
      if (orgIdField) {
        orgIdField.value = inviteOrgId;
        console.log('✅ Pre-filled EC org ID from invite link:', inviteOrgId);
        // Clear it so it doesn't persist
        sessionStorage.removeItem('inviteOrgId');
      }
    }
  });
}
