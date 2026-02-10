// js/super-admin/admin-login.js
import { db } from '../config/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showScreen } from '../utils/ui-helpers.js';
import { saveSession } from '../utils/session.js';

/**
 * Admin login handler (except SuperAdmin)
 */
export async function loginAdmin() {
  const email = document.getElementById('admin-login-email')?.value.trim().toLowerCase();
  const pass = document.getElementById('admin-login-pass')?.value.trim();
  if (!email || !pass) {
    showToast('Enter email and password', 'error');
    return;
  }

  try {
    const ref = doc(db, 'administrators', email);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      showToast('Admin not found', 'error');
      return;
    }
    const admin = snap.data();
    if (admin.role === 'super_admin' || admin.isSuperAdmin) {
      showToast('SuperAdmin must use SuperAdmin login', 'error');
      return;
    }
    if (admin.password !== pass) {
      showToast('Wrong password', 'error');
      return;
    }
    // Step 1: Request OTP for admin
    try {
      showToast('Sending OTP...', 'info');
      const method = admin.phone ? 'sms' : 'email';
      const credential = admin.phone || admin.email;
      const res = await fetch('/.netlify/functions/send-otp', {
        method: 'POST',
        body: JSON.stringify({ orgId: admin.orgId || 'global', userId: email, credential, method }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!data.ok) {
        showToast('Failed to send OTP: ' + (data.error || 'Unknown error'), 'error');
        return;
      }
      showToast('OTP sent! Please check your ' + method + '.', 'success');
      showAdminOTPInput(email, admin.orgId || 'global');
      return;
    } catch (otpErr) {
      showToast('OTP error: ' + otpErr.message, 'error');
      return;
    }
  } catch (e) {
    console.error(e);
    showToast('Login error', 'error');
  }
}

/**
 * Show Admin OTP input and handle validation
 * @param {string} email
 * @param {string} orgId
 */
function showAdminOTPInput(email, orgId) {
  const loginCard = document.getElementById('adminLoginCard') || document.body;
  const prevOtp = document.getElementById('adminOtpInputGroup');
  if (prevOtp) prevOtp.remove();
  const otpHtml = `
    <div class="form-group" id="adminOtpInputGroup">
      <label class="label">
        <i class="fas fa-key"></i> Enter OTP <span style="color: var(--accent-danger);">*</span>
      </label>
      <input id="adminOtp" class="input" placeholder="6-digit code" autocomplete="off" maxlength="6" type="text">
      <div class="input-hint">
        <i class="fas fa-info-circle"></i> Check your SMS or email for the code.
      </div>
      <button class="btn neon-btn-lg" style="width:100%;margin-top:10px;" onclick="window.validateAdminOTP('${email}','${orgId}')">
        <i class="fas fa-check"></i> Validate OTP
      </button>
    </div>
  `;
  loginCard.insertAdjacentHTML('beforeend', otpHtml);
}

/**
 * Validate OTP for admin login
 */
window.validateAdminOTP = async function(email, orgId) {
  const otp = document.getElementById('adminOtp')?.value.trim();
  if (!otp) {
    showToast('Please enter the OTP code', 'error');
    return;
  }
  try {
    showToast('Validating OTP...', 'info');
    const res = await fetch('/.netlify/functions/validate-otp', {
      method: 'POST',
      body: JSON.stringify({ orgId, userId: email, otp }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!data.ok) {
      showToast('OTP validation failed: ' + (data.error || 'Unknown error'), 'error');
      return;
    }
    showToast('OTP validated! Logging you in...', 'success');
    // Establish admin session and show admin panel
    sessionStorage.setItem('adminEmail', email);
    sessionStorage.setItem('adminOrgId', orgId);
    showScreen('adminPanel');
  } catch (otpErr) {
    showToast('OTP validation error: ' + otpErr.message, 'error');
  }
};
