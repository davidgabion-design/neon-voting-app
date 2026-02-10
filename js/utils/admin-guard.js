/**
 * Admin Permission Guard (CANONICAL)
 * Single source of truth for permission enforcement
 */

/**
 * Check if current admin has a specific permission
 * @param {string} perm - Permission to check
 * @returns {boolean} True if admin has permission
 */
export function adminHasPermission(perm) {
  const admin = window.currentAdmin;
  if (!admin) return false;

  // Super admin shortcut - full access
  if (admin.role === 'super_admin' || admin.permissions?.includes('*')) {
    return true;
  }

  // Check explicit permission
  return admin.permissions?.includes(perm);
}

/**
 * Check if admin has any of the specified permissions
 * @param {string[]} perms - Array of permissions to check
 * @returns {boolean} True if admin has at least one permission
 */
export function adminHasAnyPermission(perms) {
  return perms.some(p => adminHasPermission(p));
}

/**
 * Check if admin has all of the specified permissions
 * @param {string[]} perms - Array of permissions to check
 * @returns {boolean} True if admin has all permissions
 */
export function adminHasAllPermissions(perms) {
  return perms.every(p => adminHasPermission(p));
}

/**
 * Require permission or show access denied
 * @param {string} containerId - Container to show error in
 * @param {string} perm - Required permission
 * @returns {boolean} True if access granted
 */
export function requirePermission(containerId, perm) {
  if (adminHasPermission(perm)) {
    return true;
  }
  
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px;">
        <i class="fas fa-lock" style="font-size: 48px; color: var(--accent-danger); margin-bottom: 16px;"></i>
        <h3>Access Restricted</h3>
        <p class="subtext">
          You do not have permission to access this section.
        </p>
      </div>
    `;
  }
  
  return false;
}

// Export for global access
if (typeof window !== 'undefined') {
  window.adminHasPermission = adminHasPermission;
  window.adminHasAnyPermission = adminHasAnyPermission;
  window.adminHasAllPermissions = adminHasAllPermissions;
  window.requirePermission = requirePermission;
}
