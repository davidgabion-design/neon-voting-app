/**
 * Super Admin Module - Settings
 * Handles SuperAdmin settings and configuration
 */

import { db } from '../config/firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast } from '../utils/ui-helpers.js';

/**
 * Load Super Admin settings tab
 */
export async function loadSuperSettings() {
  const el = document.getElementById("superContent-settings");
  if (!el) return;
  
  el.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-user-shield"></i> SuperAdmin Security</h3>
      <label class="label">Change SuperAdmin Password</label>
      <input id="new-super-pass" class="input" placeholder="New password (min 8 characters)" type="password">
      <div style="margin-top:10px">
        <button class="btn neon-btn" onclick="window.changeSuperPassword()">
          <i class="fas fa-key"></i> Change Password
        </button>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-building"></i> Create New Organization</h3>
      <p class="subtext">Quick organization creation is now available in the Organizations tab.</p>
      <div style="margin-top:15px">
        <button class="btn neon-btn" onclick="window.showCreateOrgModal()">
          <i class="fas fa-plus-circle"></i> Create Organization
        </button>
      </div>
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-cog"></i> System Settings</h3>
      <div style="margin-top:20px">
        <div class="toggle-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
          <span>Enable Email Notifications</span>
          <input type="checkbox" id="enable-email-alerts" checked>
        </div>
        <div class="toggle-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
          <span>Enable SMS Notifications</span>
          <input type="checkbox" id="enable-sms-alerts" checked>
        </div>
        <div class="toggle-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
          <span>Auto-delete ended elections after 30 days</span>
          <input type="checkbox" id="auto-delete-ended" checked>
        </div>
        <div class="toggle-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
          <span>Require Super Admin approval for elections</span>
          <input type="checkbox" id="enable-approval" checked>
        </div>
      </div>
      <div style="margin-top:20px">
        <button class="btn neon-btn" onclick="window.saveSystemSettings()">
          <i class="fas fa-save"></i> Save Settings
        </button>
      </div>
    </div>
  `;
}

/**
 * Change SuperAdmin password
 */
export async function changeSuperPassword() {
  const newPass = document.getElementById('new-super-pass')?.value;
  
  if (!newPass || newPass.length < 8) {
    showToast('New password must be at least 8 characters', 'error');
    return;
  }
  
  try {
    const ref = doc(db, "meta", "superAdmin");
    await updateDoc(ref, { password: newPass });
    
    showToast('SuperAdmin password changed successfully!', 'success');
    document.getElementById('new-super-pass').value = '';
  } catch(e) {
    console.error('Error changing password:', e);
    showToast('Error changing password: ' + e.message, 'error');
  }
}

/**
 * Save system settings
 */
export async function saveSystemSettings() {
  const emailAlerts = document.getElementById('enable-email-alerts')?.checked;
  const smsAlerts = document.getElementById('enable-sms-alerts')?.checked;
  const autoDelete = document.getElementById('auto-delete-ended')?.checked;
  const enableApproval = document.getElementById('enable-approval')?.checked;
  
  try {
    // ✅ PATCH: persist system settings to Firestore (single source of truth)
    await updateDoc(doc(db, "meta", "system"), {
      emailAlerts,
      smsAlerts,
      autoDelete,
      requireApproval: enableApproval,
      updatedAt: serverTimestamp()
    });

    showToast('System settings saved successfully!', 'success');
  } catch(e) {
    console.error('Error saving settings:', e);
    showToast('Error saving settings: ' + e.message, 'error');
  }
  
  // Also save to localStorage for backward compatibility
  localStorage.setItem('system_settings', JSON.stringify({
    emailAlerts,
    smsAlerts,
    autoDelete,
    enableApproval
  }));
  
  showToast('System settings saved successfully!', 'success');
}

/**
 * Check Firebase connection status
 */
export async function checkFirebaseStatus() {
  const display = document.getElementById('firebaseStatusDisplay');
  if (!display) return;
  
  try {
    display.innerHTML = '<div class="badge info">Checking...</div>';
    
    // Try to read from Firestore
    const testRef = doc(db, "meta", "superAdmin");
    const testSnap = await getDoc(testRef);
    
    if (testSnap.exists()) {
      display.innerHTML = '<div class="badge success"><i class="fas fa-check-circle"></i> Connected</div>';
      showToast('Firebase connection is healthy', 'success');
    } else {
      display.innerHTML = '<div class="badge warning"><i class="fas fa-exclamation-triangle"></i> Connected (No data)</div>';
    }
  } catch(e) {
    console.error('Firebase status check failed:', e);
    display.innerHTML = '<div class="badge error"><i class="fas fa-times-circle"></i> Connection Error</div>';
    showToast('Firebase connection error: ' + e.message, 'error');
  }
}

/**
 * Save sync settings
 */
export async function saveSyncSettings() {
  const realtimeSync = document.getElementById('enableRealtimeSync')?.checked;
  const autoRefresh = document.getElementById('enableAutoRefresh')?.checked;
  const activityLogging = document.getElementById('enableActivityLogging')?.checked;
  
  try {
    await updateDoc(doc(db, "meta", "system"), {
      realtimeSync,
      autoRefresh,
      activityLogging,
      updatedAt: serverTimestamp()
    });
    
    localStorage.setItem('sync_settings', JSON.stringify({
      realtimeSync,
      autoRefresh,
      activityLogging
    }));
    
    showToast('Sync settings saved successfully!', 'success');
  } catch(e) {
    console.error('Error saving sync settings:', e);
    showToast('Error saving sync settings: ' + e.message, 'error');
  }
}

/**
 * Reset all app data (DANGER ZONE)
 */
export async function resetAppData() {
  const confirmed = confirm(
    '⚠️ DANGER: This will delete ALL organizations, voters, votes, and settings. This action CANNOT be undone!\n\nType "RESET" in the next prompt to confirm.'
  );
  
  if (!confirmed) return;
  
  const confirmText = prompt('Type "RESET" to confirm deletion of all data:');
  if (confirmText !== 'RESET') {
    showToast('Reset cancelled - confirmation text did not match', 'info');
    return;
  }
  
  try {
    showToast('Resetting app data... This may take a while.', 'info');
    
    // This is a placeholder - actual implementation would need to:
    // 1. Delete all organizations and subcollections
    // 2. Reset meta collections
    // 3. Clear storage
    
    showToast('⚠️ Reset app data function not fully implemented yet', 'warning');
    console.warn('resetAppData: Full implementation required');
    
  } catch(e) {
    console.error('Error resetting app data:', e);
    showToast('Error resetting app data: ' + e.message, 'error');
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadSuperSettings = loadSuperSettings;
  window.changeSuperPassword = changeSuperPassword;
  window.saveSystemSettings = saveSystemSettings;
  window.checkFirebaseStatus = checkFirebaseStatus;
  window.saveSyncSettings = saveSyncSettings;
  window.resetAppData = resetAppData;
}
