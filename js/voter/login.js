/**
 * Show OTP input and handle validation
 * @param {string} orgId
 * @param {string} voterDocId
 */
function showOTPInput(orgId, voterDocId) {
  const loginCard = document.getElementById('voterLoginCard');
  if (!loginCard) return;
  // Remove previous OTP input if exists
  const prevOtp = document.getElementById('otpInputGroup');
  if (prevOtp) prevOtp.remove();

  const otpHtml = `
    <div class="form-group" id="otpInputGroup">
      <label class="label">
        <i class="fas fa-key"></i> Enter OTP <span style="color: var(--accent-danger);">*</span>
      </label>
      <input id="voterOtp" class="input" placeholder="6-digit code" autocomplete="off" maxlength="6" type="text">
      <div class="input-hint">
        <i class="fas fa-info-circle"></i> Check your email, SMS, or WhatsApp for the code.
      </div>
      <button class="btn neon-btn-lg" style="width:100%;margin-top:10px;" onclick="window.validateVoterOTP('${orgId}','${voterDocId}')">
        <i class="fas fa-check"></i> Validate OTP
      </button>
    </div>
  `;
  loginCard.insertAdjacentHTML('beforeend', otpHtml);
}

/**
 * Validate OTP for voter login
 */
window.validateVoterOTP = async function(orgId, voterDocId) {
  const otp = document.getElementById('voterOtp')?.value.trim();
  if (!otp) {
    showToast('Please enter the OTP code', 'error');
    return;
  }
  try {
    showToast('Validating OTP...', 'info');
    const res = await fetch('/.netlify/functions/validate-otp', {
      method: 'POST',
      body: JSON.stringify({ orgId, userId: voterDocId, otp }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!data.ok) {
      showToast('OTP validation failed: ' + (data.error || 'Unknown error'), 'error');
      return;
    }
    showToast('OTP validated! Logging you in...', 'success');
    // Proceed to fetch voter document and continue login
    // ...existing code for successful login...
    // You may want to call loadVotingBallot() or redirect as needed
    // For now, reload page or call loginVoterWithCredential again to continue
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (otpErr) {
    showToast('OTP validation error: ' + otpErr.message, 'error');
  }
};
/**
 * Voter Module - Login
 * Handles voter authentication and credential management
 */

import { db } from '../config/firebase.js';
import { collection, doc, getDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { 
  validateEmail, 
  normalizeEmailAddr, 
  normalizePhoneE164,
  normalizeOrgVoterId,
  buildVoterDocIdFromCredential 
} from '../utils/validation.js';
import { showToast, showScreen, createModal } from '../utils/ui-helpers.js';
import { saveSession } from '../utils/session.js';
import { writeAudit } from '../features/audit.js';
import { loadVotingBallot } from './voting.js';
import { showVoterLiveDashboard } from './results.js';
import { getCredentialType, validateCredential, buildVoterDocId } from '../config/credential-types.js';

// Module state
let voterSession = null;
let session = {};

/**
 * Updates the voter login screen with dynamic credential fields
 */
export async function updateVoterLoginScreen() {
  const screen = document.getElementById('voterLoginScreen');
  if (!screen) return;

  // Get organization ID from URL if available
  const urlParams = new URLSearchParams(window.location.search);
  const urlOrgId = urlParams.get('org') || urlParams.get('orgId');
  
  let credType = getCredentialType('email_phone'); // default
  let orgName = '';
  
  // If org ID in URL, fetch its credential type
  if (urlOrgId) {
    try {
      const orgDoc = await getDoc(doc(db, 'organizations', urlOrgId));
      if (orgDoc.exists()) {
        credType = getCredentialType(orgDoc.data().credentialType || 'email_phone');
        orgName = orgDoc.data().name || '';
      }
    } catch (e) {
      console.error('Error fetching org credential type:', e);
    }
  }

  // Modern, clean voter login interface with dynamic credentials
  const formHtml = `
    <div class="login-container">
      <div class="login-header">
        <div class="login-logo">
          <i class="fas fa-vote-yea" style="font-size: 48px; color: #00eaff;"></i>
        </div>
        <h2>Voter Login</h2>
        <p class="subtext">Enter your voting credentials provided by the Election Commissioner</p>
        ${orgName ? `<p class="subtext" style="color: var(--neon-cyan); font-weight: 600;"><i class="fas fa-building"></i> ${orgName}</p>` : ''}
      </div>

      <div class="login-card" id="voterLoginCard">
        <div class="form-group">
          <label class="label">
            <i class="fas fa-building"></i> Organization ID <span style="color: var(--accent-danger);">*</span>
          </label>
          <input 
            id="voterOrgId" 
            class="input" 
            placeholder="e.g. ORG-12345" 
            autocomplete="off"
            value="${urlOrgId || ''}"
            ${urlOrgId ? '' : 'required'}
            onchange="window.updateCredentialFieldsForOrg()"
          >
          <div class="input-hint">
            <i class="fas fa-info-circle"></i> Required - Provided by your Election Commissioner
          </div>
        </div>

        <div class="form-group" id="credentialFieldsContainer">
          ${credType.id === 'email_phone' ? `
          <label class="label">Choose Login Method <span style="color: var(--accent-danger);">*</span></label>
          <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <button type="button" class="btn neon-btn-outline active" data-type="email" 
                    onclick="window.setCredentialType('email')" 
                    style="flex: 1; padding: 10px;">
              <i class="fas fa-envelope"></i> Email
            </button>
            <button type="button" class="btn neon-btn-outline" data-type="phone" 
                    onclick="window.setCredentialType('phone')" 
                    style="flex: 1; padding: 10px;">
              <i class="fas fa-phone"></i> Phone
            </button>
          </div>
          
          <div id="emailInputGroup" style="display: block;">
            <label class="label">
              <i class="fas fa-envelope"></i> Email Address <span style="color: var(--accent-danger);">*</span>
            </label>
            <input 
              id="voterEmail" 
              class="input" 
              placeholder="voter@example.com" 
              autocomplete="off"
              type="email"
            >
            <div class="input-hint">
              <i class="fas fa-info-circle"></i> Your registered email address
            </div>
          </div>
          
          <div id="phoneInputGroup" style="display: none;">
            <label class="label">
              <i class="fas fa-phone"></i> Phone Number <span style="color: var(--accent-danger);">*</span>
            </label>
            <input 
              id="voterPhone" 
              class="input" 
              placeholder="+233501234567" 
              autocomplete="off"
              type="tel"
            >
            <div class="input-hint">
              <i class="fas fa-info-circle"></i> Your registered phone number with country code
            </div>
          </div>
          ` : `
          <label class="label">
            <i class="fas ${credType.primaryIcon}"></i> ${credType.primaryLabel} <span style="color: var(--accent-danger);">*</span>
          </label>
          <input 
            id="voterPrimaryCredential" 
            class="input" 
            placeholder="${credType.primaryPlaceholder}" 
            autocomplete="off"
            required
          >
          <div class="input-hint">
            <i class="fas ${credType.primaryIcon}"></i> ${credType.useCase}
          </div>
          `}
        </div>

        <div class="form-group">
          <button 
            class="btn neon-btn-lg" 
            style="width: 100%; padding: 14px;"
            onclick="window.loginVoterWithCredential()"
          >
            <i class="fas fa-unlock-alt"></i> Login & Start Voting
          </button>
        </div>

        <div class="login-footer">
          <div class="divider">
            <span>Need Help?</span>
          </div>
          
          <div class="help-links">
            <button class="btn neon-btn-outline" onclick="window.showScreen('gatewayScreen')">
              <i class="fas fa-home"></i> Back to Gateway
            </button>
            
            <button class="btn neon-btn-outline" onclick="window.showVoterHelpModal()">
              <i class="fas fa-question-circle"></i> Voting Help
            </button>
          </div>
        </div>
      </div>

      <div class="security-notice">
        <i class="fas fa-shield-alt"></i>
        <span>Your vote is secure and anonymous. No personal voting data is stored.</span>
      </div>
    </div>
  `;

  const contentDiv = screen.querySelector('.screen-content') || screen;
  contentDiv.innerHTML = formHtml;
  
  // Prefill credential from URL if present
  try {
    const voterCred = urlParams.get('voter');
    if (voterCred) {
      const decodedCred = decodeURIComponent(voterCred);
      document.getElementById('voterPrimaryCredential')?.setAttribute('value', decodedCred);
    }
  } catch (e) {
    console.log('No URL params to prefill');
  }
}

/**
 * Update credential fields based on organization
 */
export async function updateCredentialFieldsForOrg() {
  const orgId = document.getElementById('voterOrgId')?.value.trim();
  if (!orgId) return;
  
  try {
    const orgDoc = await getDoc(doc(db, 'organizations', orgId));
    if (!orgDoc.exists()) {
      showToast('Organization not found', 'error');
      return;
    }
    
    const orgData = orgDoc.data();
    const credType = getCredentialType(orgData.credentialType || 'email_phone');
    
    // Update credential field dynamically
    const container = document.getElementById('credentialFieldsContainer');
    if (container) {
      container.innerHTML = credType.id === 'email_phone' ? `
        <label class="label">Choose Login Method <span style="color: var(--accent-danger);">*</span></label>
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
          <button type="button" class="btn neon-btn-outline active" data-type="email" 
                  onclick="window.setCredentialType('email')" 
                  style="flex: 1; padding: 10px;">
            <i class="fas fa-envelope"></i> Email
          </button>
          <button type="button" class="btn neon-btn-outline" data-type="phone" 
                  onclick="window.setCredentialType('phone')" 
                  style="flex: 1; padding: 10px;">
            <i class="fas fa-phone"></i> Phone
          </button>
        </div>
        
        <div id="emailInputGroup" style="display: block;">
          <label class="label">
            <i class="fas fa-envelope"></i> Email Address <span style="color: var(--accent-danger);">*</span>
          </label>
          <input 
            id="voterEmail" 
            class="input" 
            placeholder="voter@example.com" 
            autocomplete="off"
            type="email"
          >
          <div class="input-hint">
            <i class="fas fa-info-circle"></i> Your registered email address
          </div>
        </div>
        
        <div id="phoneInputGroup" style="display: none;">
          <label class="label">
            <i class="fas fa-phone"></i> Phone Number <span style="color: var(--accent-danger);">*</span>
          </label>
          <input 
            id="voterPhone" 
            class="input" 
            placeholder="+233501234567" 
            autocomplete="off"
            type="tel"
          >
          <div class="input-hint">
            <i class="fas fa-info-circle"></i> Your registered phone number with country code
          </div>
        </div>
      ` : `
        <label class="label">
          <i class="fas ${credType.primaryIcon}"></i> ${credType.primaryLabel} <span style="color: var(--accent-danger);">*</span>
        </label>
        <input 
          id="voterPrimaryCredential" 
          class="input" 
          placeholder="${credType.primaryPlaceholder}" 
          autocomplete="off"
          required
        >
        <div class="input-hint">
          <i class="fas ${credType.primaryIcon}"></i> ${credType.useCase}
        </div>
      `;
    }
    
    showToast(`Login using your ${credType.primaryLabel}`, 'info');
    
  } catch (error) {
    console.error('Error updating credential fields:', error);
  }
}

/**
 * Login voter with flexible credential
 */
export async function loginVoterWithCredential() {
  const orgId = document.getElementById('voterOrgId')?.value.trim();
  
  // Get credential - check both tabbed interface and single field
  const email = document.getElementById('voterEmail')?.value.trim();
  const phone = document.getElementById('voterPhone')?.value.trim();
  const singleField = document.getElementById('voterPrimaryCredential')?.value.trim();
  
  // Determine which credential to use
  const emailVisible = document.getElementById('emailInputGroup')?.style.display !== 'none';
  const phoneVisible = document.getElementById('phoneInputGroup')?.style.display !== 'none';
  
  let primaryCredential = singleField; // For non-email_phone types
  
  // For email_phone types with tabs
  if (emailVisible && email) {
    primaryCredential = email;
  } else if (phoneVisible && phone) {
    primaryCredential = phone;
  }
  
  if (!orgId) {
    showToast('Please enter Organization ID', 'error');
    return;
  }
  
  if (!primaryCredential) {
    showToast('Please enter your credential', 'error');
    return;
  }
  
  try {
    showToast('Verifying credentials...', 'info');
    
    // Fetch organization
    const orgDoc = await getDoc(doc(db, 'organizations', orgId));
    if (!orgDoc.exists()) {
      showToast('Organization not found', 'error');
      return;
    }
    
    const orgData = orgDoc.data();
    const credentialTypeId = orgData.credentialType || 'email_phone';
    const credType = getCredentialType(credentialTypeId);
    
    // Check organization approval status
    if (orgData.isDeleted) {
      showToast('This organization is currently disabled', 'warning');
      return;
    }
    
    const approvalStatus = orgData.approval?.status || 'pending';
    if (approvalStatus !== 'approved') {
      let message = 'Organization awaiting approval. Voting will be available once approved.';
      if (approvalStatus === 'rejected') {
        message = 'Organization was rejected. Contact your EC for details.';
      }
      showToast(message, 'warning');
      return;
    }
    
    // Validate credential
    const validation = validateCredential(credentialTypeId, primaryCredential, 'primary');
    if (!validation.isValid) {
      showToast(validation.error, 'error');
      return;
    }

    // Build voter document ID
    const voterDocId = buildVoterDocId(credentialTypeId, primaryCredential);

    // Step 1: Request OTP
    try {
      showToast('Sending OTP...', 'info');
      const method = emailVisible ? 'email' : phoneVisible ? 'sms' : 'email';
      const credential = emailVisible ? email : phoneVisible ? phone : singleField;
      const res = await fetch('/.netlify/functions/send-otp', {
        method: 'POST',
        body: JSON.stringify({ orgId, userId: voterDocId, credential, method }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!data.ok) {
        showToast('Failed to send OTP: ' + (data.error || 'Unknown error'), 'error');
        return;
      }
      showToast('OTP sent! Please check your ' + method + '.', 'success');
      // Show OTP input field
      showOTPInput(orgId, voterDocId);
      return;
    } catch (otpErr) {
      showToast('OTP error: ' + otpErr.message, 'error');
      return;
    }
    
    // Fetch voter document
    let voterDoc = await getDoc(doc(db, 'organizations', orgId, 'voters', voterDocId));
    
    // Fallback: Try old tel: format for phone numbers (backward compatibility)
    if (!voterDoc.exists() && !primaryCredential.includes('@')) {
      const legacyPhone = primaryCredential.replace(/\D/g, '');
      const legacyDocId = encodeURIComponent('tel:' + legacyPhone);
      voterDoc = await getDoc(doc(db, 'organizations', orgId, 'voters', legacyDocId));
      
      if (!voterDoc.exists()) {
        showToast(`No voter found with this ${credType.primaryLabel}`, 'error');
        return;
      }
    }
    
    if (!voterDoc.exists()) {
      showToast(`No voter found with this ${credType.primaryLabel}`, 'error');
      return;
    }
    
    const voterData = voterDoc.data();
    
    // Check if voter is replaced
    if (voterData.isReplaced) {
      showToast('This voter account has been replaced. Contact EC.', 'error');
      return;
    }
    
    // Check election timing (before allowing to vote)
    const now = new Date();
    
    // Check if voting has started
    if (orgData.electionSettings?.startTime) {
      const startTime = new Date(orgData.electionSettings.startTime);
      if (startTime > now) {
        showToast(`Voting starts at ${startTime.toLocaleString()}`, 'warning');
        return;
      }
    }
    
    // Check if voting has ended - block new voters but allow those who voted to view results
    if (orgData.electionSettings?.endTime) {
      const endTime = new Date(orgData.electionSettings.endTime);
      if (endTime <= now && !voterData.hasVoted) {
        showToast('Voting has ended for this election. You cannot vote anymore.', 'warning');
        return;
      }
    }
    
    // Check if already voted
    if (voterData.hasVoted) {
      // Check if voting has ended and track view count
      let votingEnded = false;
      if (orgData.electionSettings?.endTime) {
        const endTime = new Date(orgData.electionSettings.endTime);
        votingEnded = endTime <= now;
      }

      // Track post-vote logins (max 10 views after voting ends)
      const viewLimit = 10;
      const currentViewCount = voterData.postVoteLoginCount || 0;

      if (votingEnded && currentViewCount >= viewLimit) {
        showToast(`You have reached the maximum number of result views (${viewLimit}). Contact EC for more access.`, 'warning');
        return;
      }

      // Increment view counter if voting has ended
      if (votingEnded) {
        try {
          const { updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          const voterRef = doc(db, 'organizations', orgId, 'voters', voterDocId);
          await updateDoc(voterRef, {
            postVoteLoginCount: (currentViewCount + 1),
            lastViewedAt: new Date().toISOString()
          });
          
          // Update local voter data
          voterData.postVoteLoginCount = currentViewCount + 1;
          voterData.lastViewedAt = new Date().toISOString();
          
          showToast(`Results view ${currentViewCount + 1} of ${viewLimit}`, 'info');
        } catch (e) {
          console.warn('Failed to update view counter:', e);
        }
      } else {
        showToast('You have already voted. Redirecting to results...', 'warning');
      }
      
      // Store session
      window.currentOrgId = orgId;
      window.currentOrgData = orgData;
      window.voterData = voterData;
      sessionStorage.setItem('voterViewMode', 'readonly');
      sessionStorage.setItem('voterOrgId', orgId);
      sessionStorage.setItem('voterData', JSON.stringify(voterData));
      
      // Redirect to results after 2 seconds
      setTimeout(() => {
        showVoterLiveDashboard(orgId, voterData);
      }, 2000);
      return;
    }
    
    // Successful login
    showToast('Login successful! Loading ballot...', 'success');
    
    // Store session
    window.currentOrgId = orgId;
    window.currentOrgData = orgData;
    window.voterData = voterData;
    window.voterDocId = voterDocId;
    sessionStorage.setItem('voterViewMode', 'active');
    sessionStorage.setItem('voterOrgId', orgId);
    sessionStorage.setItem('voterData', JSON.stringify(voterData));
    
    await writeAudit({
      type: 'voter_login',
      orgId: orgId,
      voterName: voterData.name,
      message: `Voter logged in using ${credType.primaryLabel}`
    });
    
    // Load voting ballot
    setTimeout(() => {
      loadVotingBallot();
    }, 1000);
    
  } catch (error) {
    console.error('Login error:', error);
    showToast('Login failed: ' + error.message, 'error');
  }
}

/**
 * Set credential type (email or phone)
 * @param {string} type - 'email', 'phone', or 'id'
 */
export function setCredentialType(type) {
  const emailGroup = document.getElementById('emailInputGroup');
  const phoneGroup = document.getElementById('phoneInputGroup');
  const idGroup = document.getElementById('idInputGroup');

  const emailBtn = document.querySelector('[data-type="email"]');
  const phoneBtn = document.querySelector('[data-type="phone"]');
  const idBtn = document.querySelector('[data-type="id"]');

  // defaults
  if (emailGroup) emailGroup.style.display = 'none';
  if (phoneGroup) phoneGroup.style.display = 'none';
  if (idGroup) idGroup.style.display = 'none';

  emailBtn?.classList.remove('active');
  phoneBtn?.classList.remove('active');
  idBtn?.classList.remove('active');

  if (type === 'phone') {
    phoneGroup && (phoneGroup.style.display = 'block');
    phoneBtn?.classList.add('active');
    document.getElementById('voterPhone')?.focus();
  } else if (type === 'id') {
    idGroup && (idGroup.style.display = 'block');
    idBtn?.classList.add('active');
    document.getElementById('voterOrgVoterId')?.focus();
  } else {
    emailGroup && (emailGroup.style.display = 'block');
    emailBtn?.classList.add('active');
    document.getElementById('voterEmail')?.focus();
  }
}

/**
 * New voter login function for Org + Credential
 */
export async function loginVoterOrgCredential() {
  let orgId = (document.getElementById('voterOrgId')?.value || "").trim();
  const email = (document.getElementById('voterEmail')?.value || "").trim();
  const phone = (document.getElementById('voterPhone')?.value || "").trim();
  const orgVoterId = (document.getElementById('voterOrgVoterId')?.value || "").trim();

  const emailGroupVisible = document.getElementById('emailInputGroup')?.style.display !== 'none';
  const phoneGroupVisible = document.getElementById('phoneInputGroup')?.style.display !== 'none';
  const idGroupVisible = document.getElementById('idInputGroup')?.style.display !== 'none';

  const credential = emailGroupVisible ? email : (phoneGroupVisible ? phone : orgVoterId);

  // Validate Organization ID is provided
  if (!orgId) {
    showToast('Please enter your Organization ID', 'error');
    document.getElementById('voterOrgId')?.focus();
    return;
  }

  if (!credential) {
    showToast('Please enter your credential (Email, Phone, or Voter ID)', 'error');
    (emailGroupVisible ? document.getElementById('voterEmail') :
      phoneGroupVisible ? document.getElementById('voterPhone') :
      document.getElementById('voterOrgVoterId'))?.focus();
    return;
  }

  // basic validation
  if (emailGroupVisible && !validateEmail(normalizeEmailAddr(email))) {
    showToast('Please enter a valid email address', 'error');
    document.getElementById('voterEmail')?.focus();
    return;
  }
  if (phoneGroupVisible && normalizePhoneE164(phone).length < 8) {
    showToast('Please enter a valid phone number', 'error');
    document.getElementById('voterPhone')?.focus();
    return;
  }

  try {
    showToast('Verifying your credentials...', 'info');

    // Load organization document
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    if (!orgSnap.exists()) {
      showToast('Organization not found. Please check your Organization ID.', 'error');
      return;
    }
    const org = { id: orgSnap.id, ...(orgSnap.data() || {}) };

    // 2) Approval/enabled checks
    if (org.isDeleted) {
      showToast('This organization is currently disabled.', 'warning');
      return;
    }

    // 2.5) Check if organization is approved by SuperAdmin for voting
    const approvalStatus = org.approval?.status || 'pending';
    if (approvalStatus !== 'approved') {
      let message = 'Organization awaiting SuperAdmin approval. Voting will be available once approved.';
      if (approvalStatus === 'rejected') {
        message = 'Organization was rejected by SuperAdmin. Contact your EC for details.';
      }
      showToast(message, 'warning');
      return;
    }

    // 3) Find voter FIRST (before schedule checks)
    const result = window.__resolvedVoterResult || await findVoterByEmailOrPhone(orgId, credential);
    window.__resolvedVoterResult = null;

    if (!result.found) {
      showToast('Voter not found. Please check your credential or contact EC.', 'error');
      return;
    }

    const voter = result.voter;

    // 4) Schedule checks (but allow voters who already voted to see results)
    const now = new Date();
    
    // Check if voting has started
    if (org.electionSettings?.startTime) {
      const startTime = new Date(org.electionSettings.startTime);
      if (startTime > now) {
        showToast(`Voting starts at ${startTime.toLocaleString()}`, 'warning');
        return;
      }
    }
    
    // Check if voting has ended - but allow voters who already voted to view results
    if (org.electionSettings?.endTime) {
      const endTime = new Date(org.electionSettings.endTime);
      if (endTime <= now && !voter.hasVoted) {
        showToast('Voting has ended for this election. You cannot vote anymore.', 'warning');
        return;
      }
    }
    
    // ✅ PATCH: allow login even if voter has voted, set viewMode
    if (voter.hasVoted) {
      // Check if voting has ended
      const now = new Date();
      let votingEnded = false;
      if (org.electionSettings?.endTime) {
        const endTime = new Date(org.electionSettings.endTime);
        votingEnded = endTime <= now;
      }

      // Track post-vote logins (max 10 views after voting ends)
      const viewLimit = 10;
      const currentViewCount = voter.postVoteLoginCount || 0;

      if (votingEnded && currentViewCount >= viewLimit) {
        showToast(`You have reached the maximum number of result views (${viewLimit}). Contact EC for more access.`, 'warning');
        return;
      }

      // Increment view counter
      if (votingEnded) {
        try {
          const voterDocId = result.voterDocId || voter.id;
          const voterRef = doc(db, "organizations", orgId, "voters", voterDocId);
          const { updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          await updateDoc(voterRef, {
            postVoteLoginCount: (currentViewCount + 1),
            lastViewedAt: new Date().toISOString()
          });
          
          // Update local voter data
          voter.postVoteLoginCount = currentViewCount + 1;
          voter.lastViewedAt = new Date().toISOString();
          
          showToast(`Results view ${currentViewCount + 1} of ${viewLimit}`, 'info');
        } catch (e) {
          console.warn('Failed to update view counter:', e);
        }
      }

      sessionStorage.setItem('voterViewMode', 'readonly');
      sessionStorage.setItem('voterOrgId', orgId);
      sessionStorage.setItem('voterData', JSON.stringify(voter));
      await showVoterLiveDashboard(orgId, voter);
      return;
    } else {
      sessionStorage.setItem('voterViewMode', 'active');
      sessionStorage.setItem('voterOrgId', orgId);
      sessionStorage.setItem('voterData', JSON.stringify(voter));
    }

    // 5) Create voter session (canonical)
    const voterDocId = result.voterDocId || voter.id;
    const voterKey = voterDocId; // we use docId as canonical key

    voterSession = {
      orgId,
      voterKey,
      voterDocId,
      email: voter.email || "",
      phone: voter.phone || "",
      voterData: voter,
      orgData: org,
      matchedBy: result.matchedBy,
      startTime: new Date()
    };

    session.voterSession = voterSession;
    saveSession();

    await writeAudit(orgId, "VOTER_LOGIN", voterKey, { matchedBy: result.matchedBy });

    await loadVotingBallot(orgId);
    showScreen('votingScreen');
    const greetingName = voter.name || voter.voterId || 'Voter';
    showToast(`Welcome, ${greetingName}! Please cast your vote.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Login failed. Please try again.', 'error');
  }
}

/**
 * Find voter by email or phone across organization
 * @param {string} orgId - Organization ID
 * @param {string} credential - Email or phone credential
 * @returns {Promise<Object>} Result with found status and voter data
 */
export async function findVoterByEmailOrPhone(orgId, credential) {
  try {
    const docId = buildVoterDocIdFromCredential(credential);
    if (!docId) return { found: false };

    // 1) Direct lookup (fast path, Option 3 style IDs)
    const directRef = doc(db, "organizations", orgId, "voters", docId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      const voter = directSnap.data() || {};
      return {
        found: true,
        voter: { id: directSnap.id, ...voter },
        matchedBy: docId.startsWith("tel%3A") ? "phone" : (docId.startsWith("id%3A") ? "orgVoterId" : "email"),
        voterDocId: directSnap.id
      };
    }

    // 2) Backward-compat fallback scan (older docs / different IDs)
    const cred = String(credential || "").trim();
    const email = normalizeEmailAddr(cred);
    const phone = normalizePhoneE164(cred);
    const oid = normalizeOrgVoterId(cred);

    const votersSnap = await getDocs(query(
      collection(db, "organizations", orgId, "voters"),
      where("isReplaced", "==", false)
    ));

    for (const voterDoc of votersSnap.docs) {
      const data = voterDoc.data() || {};
      const dEmail = normalizeEmailAddr(data.email);
      const dPhone = normalizePhoneE164(data.phone || data.phoneNumber);
      const dOid = normalizeOrgVoterId(data.orgVoterId || data.voterId);

      if (email && dEmail && email === dEmail) {
        return { found: true, voter: { id: voterDoc.id, ...data }, matchedBy: "email", voterDocId: voterDoc.id };
      }
      if (phone && dPhone && phone === dPhone) {
        return { found: true, voter: { id: voterDoc.id, ...data }, matchedBy: "phone", voterDocId: voterDoc.id };
      }
      if (oid && dOid && oid === dOid) {
        return { found: true, voter: { id: voterDoc.id, ...data }, matchedBy: "orgVoterId", voterDocId: voterDoc.id };
      }
    }

    return { found: false };
  } catch (error) {
    console.error('Error finding voter:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Help modal for voters
 */
export function showVoterHelpModal() {
  createModal(
    '<i class="fas fa-question-circle"></i> Voting Help',
    `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="help-section">
          <h4 style="color: #00eaff; margin-bottom: 10px;">
            <i class="fas fa-key"></i> How to Get Your Credentials
          </h4>
          <ul style="color: #9beaff; padding-left: 20px;">
            <li>Your Organization ID is provided by the Election Commissioner (EC)</li>
            <li>Use the <strong>email</strong> or <strong>phone number</strong> you registered with</li>
            <li>If you don't have credentials, contact your EC</li>
          </ul>
        </div>
        
        <div class="help-section">
          <h4 style="color: #00eaff; margin-bottom: 10px;">
            <i class="fas fa-vote-yea"></i> Voting Process
          </h4>
          <ul style="color: #9beaff; padding-left: 20px;">
            <li>Select your preferred candidates for each position</li>
            <li>Review your selections before submitting</li>
            <li>Once submitted, your vote cannot be changed</li>
          </ul>
        </div>
        
        <div class="help-section">
          <h4 style="color: #00eaff; margin-bottom: 10px;">
            <i class="fas fa-shield-alt"></i> Security & Privacy
          </h4>
          <ul style="color: #9beaff; padding-left: 20px;">
            <li>Your vote is anonymous and secure</li>
            <li>No one can see how you voted</li>
            <li>Your credential is only used for authentication</li>
          </ul>
        </div>
        
        <div class="help-section" style="background: rgba(255, 193, 7, 0.1); padding: 15px; border-radius: 10px;">
          <h4 style="color: #ffc107; margin-bottom: 10px;">
            <i class="fas fa-exclamation-triangle"></i> Important Notes
          </h4>
          <ul style="color: #ffcc80; padding-left: 20px;">
            <li>Do not share your voting credentials</li>
            <li>Complete voting in one session</li>
            <li>Contact EC immediately if you encounter issues</li>
          </ul>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">
        <i class="fas fa-times"></i> Close
      </button>
      <button class="btn neon-btn" onclick="document.querySelector('.modal-overlay')?.remove(); window.updateVoterLoginScreen();">
        <i class="fas fa-redo"></i> Back to Login
      </button>
    `
  );
}

/**
 * Debug function to check voter status
 */
export async function debugVoterStatus() {
  const orgId = prompt('Enter Organization ID:');
  const credential = prompt('Enter voter email/phone:');
  
  if (!orgId || !credential) return;
  
  try {
    const result = await findVoterByEmailOrPhone(orgId, credential);
    if (result.found) {
      console.log('Voter found:', result.voter);
      alert(`
Voter Status:
* Name: ${result.voter.name}
* Email: ${result.voter.email}
* Phone: ${result.voter.phone}
* Has Voted: ${result.voter.hasVoted ? 'YES' : 'NO'}
* Is Replaced: ${result.voter.isReplaced ? 'YES' : 'NO'}
* Voter ID: ${result.voter.voterId || 'N/A'}
      `);
    } else {
      alert('Voter not found');
    }
  } catch(e) {
    console.error('Debug error:', e);
    alert('Error: ' + e.message);
  }
}

/**
 * Restore voter session on page load
 */
export async function restoreVoterSession() {
  try {
    const voterViewMode = sessionStorage.getItem('voterViewMode');
    const voterOrgId = sessionStorage.getItem('voterOrgId');
    const voterDataStr = sessionStorage.getItem('voterData');

    if (!voterViewMode || !voterOrgId || !voterDataStr) {
      return false; // No session to restore
    }

    const voterData = JSON.parse(voterDataStr);

    // If voter is in readonly mode (has already voted), show dashboard
    if (voterViewMode === 'readonly' && voterData.hasVoted) {
      await showVoterLiveDashboard(voterOrgId, voterData);
      return true;
    }

    // If voter is in active mode (hasn't voted yet), load voting ballot
    if (voterViewMode === 'active' && !voterData.hasVoted) {
      await loadVotingBallot(voterOrgId);
      showScreen('votingScreen');
      return true;
    }

    // Session data invalid, clear it
    sessionStorage.removeItem('voterViewMode');
    sessionStorage.removeItem('voterOrgId');
    sessionStorage.removeItem('voterData');
    return false;
  } catch (e) {
    console.error('Failed to restore voter session:', e);
    // Clear invalid session data
    sessionStorage.removeItem('voterViewMode');
    sessionStorage.removeItem('voterOrgId');
    sessionStorage.removeItem('voterData');
    return false;
  }
}

/**
 * Logout voter and clear session
 */
export function logoutVoter() {
  sessionStorage.removeItem('voterViewMode');
  sessionStorage.removeItem('voterOrgId');
  sessionStorage.removeItem('voterData');
  if (typeof window.showScreen === 'function') {
    window.showScreen('voterLoginScreen');
  }
  showToast('Logged out successfully', 'success');
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.updateVoterLoginScreen = updateVoterLoginScreen;
  window.updateCredentialFieldsForOrg = updateCredentialFieldsForOrg;
  window.loginVoterWithCredential = loginVoterWithCredential;
  window.setCredentialType = setCredentialType;
  window.loginVoterOrgCredential = loginVoterOrgCredential;
  window.showVoterHelpModal = showVoterHelpModal;
  window.debugVoterStatus = debugVoterStatus;
  window.restoreVoterSession = restoreVoterSession;
  window.logoutVoter = logoutVoter;
  
  // Auto-fill org ID from invite link
  window.addEventListener('load', () => {
    const inviteOrgId = sessionStorage.getItem('inviteOrgId');
    if (inviteOrgId) {
      const orgIdField = document.getElementById('voterOrgId');
      if (orgIdField) {
        orgIdField.value = inviteOrgId;
        console.log('✅ Pre-filled Voter org ID from invite link:', inviteOrgId);
        // Clear it so it doesn't persist
        sessionStorage.removeItem('inviteOrgId');
      }
    }
  });
}
