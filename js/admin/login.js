/**
 * Admin Module - Login & Authentication
 * Handles administrator login, session management, and panel initialization
 */

import { db } from '../config/firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showScreen, showToast } from '../utils/ui-helpers.js';
import { setAdminSession, getSession } from '../utils/session.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { hasPermission, ADMIN_ROLES, getRolePermissions } from '../config/admin-roles.js';
import { adminHasPermission, requirePermission } from '../utils/admin-guard.js';

/**
 * Normalize admin permissions based on role
 * Ensures every admin has a clean, consistent permission array
 * @param {Object} admin - Admin object from Firestore
 * @returns {Object} Normalized admin object
 */
function normalizeAdminPermissions(admin) {
  // Custom role - permissions already set by super admin
  if (admin.role === 'custom' && Array.isArray(admin.permissions)) {
    return admin;
  }

  // Get permissions for predefined role
  const rolePermissions = getRolePermissions(admin.role);
  if (rolePermissions.length > 0) {
    admin.permissions = rolePermissions;
  } else {
    console.warn('Unknown admin role:', admin.role, '- Defaulting to empty permissions');
    admin.permissions = [];
  }

  return admin;
}

/**
 * Login as Administrator
 */
export async function loginAdmin() {
  const email = document.getElementById('admin-email')?.value.trim().toLowerCase();
  const pass = document.getElementById('admin-password')?.value;
  if (!email || !pass) {
    showToast('Enter email and password', 'error');
    return;
  }
  try {
    const adminRef = doc(db, 'administrators', email);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      showToast('Invalid email or password', 'error');
      return;
    }
    const admin = adminSnap.data();
    if (admin.role === 'super_admin' || admin.isSuperAdmin) {
      showToast('SuperAdmin must use SuperAdmin login', 'error');
      return;
    }
    if (admin.status !== 'active') {
      showToast('Your account has been deactivated. Contact super admin.', 'error');
      return;
    }
    if (admin.password !== pass) {
      showToast('Invalid email or password', 'error');
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
      showAdminOTPInput(email, admin.orgId || 'global', admin);
      return;
    } catch (otpErr) {
      showToast('OTP error: ' + otpErr.message, 'error');
      return;
    }
  } catch(e) {
    console.error(e);
    showToast('Login failed: ' + e.message, 'error');
  }

  function showAdminOTPInput(email, orgId, admin) {
    const loginCard = document.querySelector('.login-card') || document.body;
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
        // Proceed to admin panel
        setAdminSession(email, admin.name, admin.role, admin.permissions);
        window.currentAdmin = admin;
        showScreen('adminPanel');
        await openAdminPanel();
        document.getElementById('admin-email').value = '';
        document.getElementById('admin-password').value = '';
      } catch (otpErr) {
        showToast('OTP validation error: ' + otpErr.message, 'error');
      }
    };
  }
}

/**
 * Open admin panel and initialize dashboard
 */
export async function openAdminPanel() {
  if (!window.currentAdmin) {
    showToast("Session expired. Please login again.", "error");
    showScreen("adminLoginScreen");
    return;
  }
  
  try {
    // Update admin info display
    const adminNameEl = document.getElementById('adminName');
    const adminRoleEl = document.getElementById('adminRole');
    
    if (adminNameEl) adminNameEl.textContent = window.currentAdmin.name;
    if (adminRoleEl) adminRoleEl.textContent = window.currentAdmin.role.replace('_', ' ').toUpperCase();
    
    // Hide tabs user doesn't have permission for
    hideUnauthorizedTabs();
    
    // 🔥 PATCH 4: Force initial dashboard load
    showAdminTab('dashboard');
    
  } catch(e) { 
    console.error("Error opening admin panel:", e); 
    showToast("Failed to load admin panel", "error"); 
  }
}

/**
 * Hide navigation items for tabs the admin doesn't have permission to access
 */
function hideUnauthorizedTabs() {
  const navItems = document.querySelectorAll('[data-admin-tab][data-permission]');
  
  navItems.forEach(item => {
    const requiredPermission = item.dataset.permission;
    if (requiredPermission) {
      const hasAccess = hasPermission(window.currentAdmin, requiredPermission);
      item.style.display = hasAccess ? 'flex' : 'none';
    }
  });
}

/**
 * Show specific admin tab
 * @param {string} tabId - Tab identifier
 */
export function showAdminTab(tabId) {
  console.log('[ADMIN TAB]', tabId);
  
  // ✅ PATCH 3: reset loader lock for safety
  const el = document.getElementById(`adminContent-${tabId}`);
  if (el) delete el.dataset.loaded;
  
  // Update active nav item
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.adminTab === tabId);
  });
  
  // Update active content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const contentEl = document.getElementById(`adminContent-${tabId}`);
  if (!contentEl) {
    console.warn('Tab container not found:', tabId);
    return;
  }
  
  contentEl.classList.add('active');
  
  // Update title with icon
  const titles = {
    dashboard: { text: 'Dashboard', icon: 'fa-chart-line' },
    organizations: { text: 'Organizations', icon: 'fa-building' },
    approvals: { text: 'Election Approvals', icon: 'fa-clipboard-check' },
    administrators: { text: 'Administrators', icon: 'fa-users-cog' },
    settings: { text: 'System Settings', icon: 'fa-cog' },
    audit: { text: 'Audit Logs', icon: 'fa-history' }
  };
  
  const titleEl = document.getElementById('adminContentTitle');
  if (titleEl) {
    const titleInfo = titles[tabId] || { text: 'Dashboard', icon: 'fa-chart-line' };
    titleEl.innerHTML = `<i class="fas ${titleInfo.icon}" style="color: #9d00ff;"></i>${titleInfo.text}`;
  }
  
  // 🔥 CRITICAL: trigger loader AFTER visibility
  requestAnimationFrame(() => {
    triggerAdminTabLoader(tabId);
  });
}

/**
 * Show loading state with fail-safe timeout
 * @param {string} containerId - Container element ID
 * @param {string} label - Loading label text
 */
function showTabLoading(containerId, label = 'Loading') {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin"></i>
      ${label}…
    </div>
  `;

  // ⛑️ Fail-safe: clear loading if nothing returns
  setTimeout(() => {
    if (el.innerHTML.includes('loading-state')) {
      el.innerHTML = `
        <div class="card">
          <div class="subtext" style="text-align: center; padding: 20px;">
            No data loaded or connection delayed.
            <br><br>
            <button class="btn neon-btn-outline" onclick="location.reload()">
              <i class="fas fa-sync"></i> Reload
            </button>
          </div>
        </div>
      `;
    }
  }, 8000);
}

/**
 * 🔥 CANONICAL: Permission-aware tab loader dispatcher
 * Enforces RBAC before triggering loaders
 * @param {string} tabId - Tab identifier
 */
function triggerAdminTabLoader(tabId) {
  console.log('[ADMIN LOADER]', tabId);
  
  const contentEl = document.getElementById(`adminContent-${tabId}`);
  if (!contentEl) return;
  
  // Check if already loaded to prevent duplicate loads
  if (contentEl.dataset.loaded === 'true') {
    console.log(`✓ Tab ${tabId} already loaded`);
    return;
  }
  
  // Map tab IDs to permissions and loaders
  const tabConfig = {
    dashboard: { 
      perm: 'view_dashboard', 
      loader: window.loadAdminDashboard,
      containerId: 'adminContent-dashboard'
    },
    organizations: { 
      perm: 'view_organizations', 
      loader: window.loadAdminOrganizations,
      containerId: 'adminContent-orgs'
    },
    approvals: { 
      perm: 'view_approvals', 
      loader: window.loadAdminApprovals,
      containerId: 'adminContent-approvals-list'
    },
    administrators: { 
      perm: 'view_admins', 
      loader: window.loadAdminAdministrators,
      containerId: 'adminContent-admins'
    },
    settings: { 
      perm: 'view_settings', 
      loader: window.loadAdminSettings,
      containerId: 'adminContent-settings-content'
    },
    audit: { 
      perm: 'view_audit_logs', 
      loader: window.loadAdminAuditLogs,
      containerId: 'adminContent-audit'
    }
  };

  const config = tabConfig[tabId];
  if (!config) {
    console.warn('⚠ No tab config for:', tabId);
    return;
  }

  // ✅ PERMISSION GUARD - Enforce RBAC
  if (!adminHasPermission(config.perm)) {
    const container = document.getElementById(config.containerId);
    if (container) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px;">
          <i class="fas fa-lock" style="font-size: 48px; color: var(--accent-danger); margin-bottom: 16px;"></i>
          <h3>Access Restricted</h3>
          <p class="subtext">
            You do not have permission to access this section.
          </p>
          <p class="subtext" style="margin-top: 12px; color: var(--accent-warning);">
            Required permission: <strong>${config.perm.replace(/_/g, ' ')}</strong>
          </p>
        </div>
      `;
    }
    contentEl.dataset.loaded = 'true';
    return;
  }

  // Permission granted - trigger loader
  // ✅ PATCH 2: mark loaded ONLY after render completes
  if (typeof config.loader === 'function') {
    Promise.resolve(config.loader())
      .finally(() => {
        contentEl.dataset.loaded = 'true';
      });
  } else {
    console.warn('⚠ Loader function not found for:', tabId);
    contentEl.dataset.loaded = 'true';
  }
}

/**
 * Load content for specific admin tab
 * @param {string} tabId - Tab identifier
 */
async function loadAdminTabContent(tabId) {
  const contentEl = document.getElementById(`adminContent-${tabId}`);
  if (!contentEl) return;
  
  // Check if already loaded
  if (contentEl.dataset.loaded === 'true') return;
  
  try {
    switch(tabId) {
      case 'dashboard':
        if (!window.currentAdmin) {
          contentEl.innerHTML = '<div class="card error"><p>Session expired. Please login again.</p></div>';
          contentEl.dataset.loaded = 'true';
          return;
        }
        showTabLoading('adminContent-dashboard', 'Loading dashboard');
        if (typeof window.loadAdminDashboard === 'function') {
          await window.loadAdminDashboard();
          contentEl.dataset.loaded = 'true';
        } else {
          contentEl.innerHTML = '<div class="card error"><p>Dashboard not available.</p></div>';
          contentEl.dataset.loaded = 'true';
        }
        break;
        
      case 'organizations':
        if (hasPermission(window.currentAdmin, 'view_organizations')) {
          showTabLoading('superContent-orgs', 'Loading organizations');
          if (typeof window.loadSuperOrganizationsEnhanced === 'function') {
            await window.loadSuperOrganizationsEnhanced();
            contentEl.dataset.loaded = 'true';
          } else {
            document.getElementById('superContent-orgs').innerHTML = '<div class="card"><p>Organizations management not available.</p></div>';
            contentEl.dataset.loaded = 'true';
          }
        } else {
          document.getElementById('superContent-orgs').innerHTML = '<div class="card"><p>You do not have permission to view organizations.</p></div>';
          contentEl.dataset.loaded = 'true';
        }
        break;
        
      case 'approvals':
        if (hasPermission(window.currentAdmin, 'view_approvals')) {
          showTabLoading('superApprovalList', 'Loading approvals');
          if (typeof window.loadSuperApprovals === 'function') {
            await window.loadSuperApprovals();
            contentEl.dataset.loaded = 'true';
          } else {
            document.getElementById('superApprovalList').innerHTML = '<div class="card"><p>Election approvals not available.</p></div>';
            contentEl.dataset.loaded = 'true';
          }
        } else {
          document.getElementById('superApprovalList').innerHTML = '<div class="card"><p>You do not have permission to view approvals.</p></div>';
          contentEl.dataset.loaded = 'true';
        }
        break;
        
      case 'administrators':
        if (hasPermission(window.currentAdmin, 'view_admins')) {
          showTabLoading('superContent-admins', 'Loading administrators');
          console.log('[ADMIN TAB] loadAdministrators function exists:', typeof window.loadAdministrators);
          if (typeof window.loadAdministrators === 'function') {
            try {
              await window.loadAdministrators();
              contentEl.dataset.loaded = 'true';
              console.log('[ADMIN TAB] Administrators loaded successfully');
            } catch (err) {
              console.error('[ADMIN TAB] Error calling loadAdministrators:', err);
              document.getElementById('superContent-admins').innerHTML = '<div class="card error"><p>Error loading administrators: ' + err.message + '</p></div>';
              contentEl.dataset.loaded = 'true';
            }
          } else {
            document.getElementById('superContent-admins').innerHTML = '<div class="card"><p>Administrator management not available.</p></div>';
            contentEl.dataset.loaded = 'true';
          }
        } else {
          document.getElementById('superContent-admins').innerHTML = '<div class="card"><p>You do not have permission to view administrators.</p></div>';
          contentEl.dataset.loaded = 'true';
        }
        break;
        
      case 'settings':
        if (hasPermission(window.currentAdmin, 'view_settings')) {
          showTabLoading('superContent-settings', 'Loading settings');
          if (typeof window.loadSuperSettings === 'function') {
            await window.loadSuperSettings();
            contentEl.dataset.loaded = 'true';
          } else {
            document.getElementById('superContent-settings').innerHTML = '<div class="card"><p>System settings not available.</p></div>';
            contentEl.dataset.loaded = 'true';
          }
        } else {
          document.getElementById('superContent-settings').innerHTML = '<div class="card"><p>You do not have permission to view settings.</p></div>';
          contentEl.dataset.loaded = 'true';
        }
        break;
        
      case 'audit':
        if (hasPermission(window.currentAdmin, 'view_audit_logs')) {
          contentEl.innerHTML = '<div class="card"><p>Audit logs feature coming soon.</p></div>';
          contentEl.dataset.loaded = 'true';
        } else {
          contentEl.innerHTML = '<div class="card"><p>You do not have permission to view audit logs.</p></div>';
          contentEl.dataset.loaded = 'true';
        }
        break;
    }
  } catch(e) {
    console.error(`Error loading ${tabId} content:`, e);
    contentEl.innerHTML = `<div class="card error"><p>Failed to load content: ${e.message}</p></div>`;
    contentEl.dataset.loaded = 'true';
  }
}

/**
 * Restore admin session from localStorage
 * Called on app initialization to maintain login state across page refreshes
 * @returns {Promise<boolean>} True if session was restored, false otherwise
 */
export async function restoreAdminSession() {
  try {
    const session = getSession();
    
    // Check if admin session exists
    if (session && session.role === 'admin' && session.adminEmail) {
      console.log('Restoring Admin session for:', session.adminEmail);
      
      // Verify admin credentials still exist and are active
      const adminRef = doc(db, "administrators", session.adminEmail);
      const adminSnap = await getDoc(adminRef);
      
      if (!adminSnap.exists()) {
        console.warn('Admin account no longer exists, clearing session');
        const { clearSession } = await import('../utils/session.js');
        clearSession();
        return false;
      }
      
      const admin = adminSnap.data();
      
      if (admin.status !== 'active') {
        console.warn('Admin account is inactive, clearing session');
        const { clearSession } = await import('../utils/session.js');
        clearSession();
        showToast("Your account has been deactivated", "error");
        return false;
      }
      
      // Restore admin data with normalized permissions
      const restoredAdmin = normalizeAdminPermissions({
        email: session.adminEmail,
        name: session.adminName || admin.name,
        role: session.adminRole || admin.role,
        permissions: session.adminPermissions || admin.permissions || [],
        status: admin.status
      });
      
      window.currentAdmin = restoredAdmin;
      
      // Restore admin panel
      showScreen("adminPanel");
      await openAdminPanel();
      
      return true;
    }
    
    return false;
  } catch(e) {
    console.error('Error restoring admin session:', e);
    return false;
  }
}

// Expose functions to window for event handlers
if (typeof window !== 'undefined') {
  window.loginAdmin = loginAdmin;
  window.showAdminTab = showAdminTab;
}

// ✅ PATCH 1: Bind admin sidebar navigation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindAdminSidebarTabs);
} else {
  // DOM already loaded (common in modules) - bind immediately
  bindAdminSidebarTabs();
}

function bindAdminSidebarTabs() {
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.adminTab;
      if (tab) {
        showAdminTab(tab);
      }
    });
  });
}
