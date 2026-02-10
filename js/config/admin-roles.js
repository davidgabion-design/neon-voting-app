/**
 * Admin Roles and Permissions Configuration
 * Defines available roles and their associated permissions
 */

/**
 * Available permission types
 */
export const PERMISSIONS = {
  // Dashboard & Monitoring
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_REPORTS: 'export_reports',
  
  // Organization Management
  VIEW_ORGANIZATIONS: 'view_organizations',
  CREATE_ORGANIZATIONS: 'create_organizations',
  EDIT_ORGANIZATIONS: 'edit_organizations',
  DELETE_ORGANIZATIONS: 'delete_organizations',
  VIEW_ORG_DETAILS: 'view_org_details',
  
  // Election Approvals
  VIEW_APPROVALS: 'view_approvals',
  APPROVE_ELECTIONS: 'approve_elections',
  REJECT_ELECTIONS: 'reject_elections',
  REVOKE_APPROVALS: 'revoke_approvals',
  
  // Administrator Management
  VIEW_ADMINS: 'view_admins',
  CREATE_ADMINS: 'create_admins',
  EDIT_ADMINS: 'edit_admins',
  DELETE_ADMINS: 'delete_admins',
  ASSIGN_ROLES: 'assign_roles',
  
  // System Settings
  VIEW_SETTINGS: 'view_settings',
  EDIT_SETTINGS: 'edit_settings',
  MANAGE_DANGER_ZONE: 'manage_danger_zone',
  
  // EC Management
  INVITE_EC: 'invite_ec',
  VIEW_AS_EC: 'view_as_ec',
  
  // Voter Management
  VIEW_VOTERS: 'view_voters',
  VIEW_VOTES: 'view_votes',
  
  // Audit & Logs
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  EXPORT_AUDIT_LOGS: 'export_audit_logs'
};

/**
 * Permission categories for UI organization
 */
export const PERMISSION_CATEGORIES = {
  dashboard: {
    label: 'Dashboard & Monitoring',
    icon: 'fa-chart-line',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.EXPORT_REPORTS
    ]
  },
  organizations: {
    label: 'Organizations',
    icon: 'fa-building',
    permissions: [
      PERMISSIONS.VIEW_ORGANIZATIONS,
      PERMISSIONS.CREATE_ORGANIZATIONS,
      PERMISSIONS.EDIT_ORGANIZATIONS,
      PERMISSIONS.DELETE_ORGANIZATIONS,
      PERMISSIONS.VIEW_ORG_DETAILS
    ]
  },
  approvals: {
    label: 'Election Approvals',
    icon: 'fa-clipboard-check',
    permissions: [
      PERMISSIONS.VIEW_APPROVALS,
      PERMISSIONS.APPROVE_ELECTIONS,
      PERMISSIONS.REJECT_ELECTIONS,
      PERMISSIONS.REVOKE_APPROVALS
    ]
  },
  administrators: {
    label: 'Administrator Management',
    icon: 'fa-user-shield',
    permissions: [
      PERMISSIONS.VIEW_ADMINS,
      PERMISSIONS.CREATE_ADMINS,
      PERMISSIONS.EDIT_ADMINS,
      PERMISSIONS.DELETE_ADMINS,
      PERMISSIONS.ASSIGN_ROLES
    ]
  },
  settings: {
    label: 'System Settings',
    icon: 'fa-gear',
    permissions: [
      PERMISSIONS.VIEW_SETTINGS,
      PERMISSIONS.EDIT_SETTINGS,
      PERMISSIONS.MANAGE_DANGER_ZONE
    ]
  },
  ec: {
    label: 'EC Management',
    icon: 'fa-user-tie',
    permissions: [
      PERMISSIONS.INVITE_EC,
      PERMISSIONS.VIEW_AS_EC
    ]
  },
  voters: {
    label: 'Voter Access',
    icon: 'fa-users',
    permissions: [
      PERMISSIONS.VIEW_VOTERS,
      PERMISSIONS.VIEW_VOTES
    ]
  },
  audit: {
    label: 'Audit & Logs',
    icon: 'fa-clipboard-list',
    permissions: [
      PERMISSIONS.VIEW_AUDIT_LOGS,
      PERMISSIONS.EXPORT_AUDIT_LOGS
    ]
  }
};

/**
 * Permission labels for UI display
 */
export const PERMISSION_LABELS = {
  [PERMISSIONS.VIEW_DASHBOARD]: 'View Dashboard',
  [PERMISSIONS.VIEW_ANALYTICS]: 'View Analytics',
  [PERMISSIONS.EXPORT_REPORTS]: 'Export Reports',
  
  [PERMISSIONS.VIEW_ORGANIZATIONS]: 'View Organizations',
  [PERMISSIONS.CREATE_ORGANIZATIONS]: 'Create Organizations',
  [PERMISSIONS.EDIT_ORGANIZATIONS]: 'Edit Organizations',
  [PERMISSIONS.DELETE_ORGANIZATIONS]: 'Delete Organizations',
  [PERMISSIONS.VIEW_ORG_DETAILS]: 'View Organization Details',
  
  [PERMISSIONS.VIEW_APPROVALS]: 'View Approval Requests',
  [PERMISSIONS.APPROVE_ELECTIONS]: 'Approve Elections',
  [PERMISSIONS.REJECT_ELECTIONS]: 'Reject Elections',
  [PERMISSIONS.REVOKE_APPROVALS]: 'Revoke Approvals',
  
  [PERMISSIONS.VIEW_ADMINS]: 'View Administrators',
  [PERMISSIONS.CREATE_ADMINS]: 'Create Administrators',
  [PERMISSIONS.EDIT_ADMINS]: 'Edit Administrators',
  [PERMISSIONS.DELETE_ADMINS]: 'Delete Administrators',
  [PERMISSIONS.ASSIGN_ROLES]: 'Assign Roles',
  
  [PERMISSIONS.VIEW_SETTINGS]: 'View Settings',
  [PERMISSIONS.EDIT_SETTINGS]: 'Edit Settings',
  [PERMISSIONS.MANAGE_DANGER_ZONE]: 'Access Danger Zone',
  
  [PERMISSIONS.INVITE_EC]: 'Invite Election Commissioners',
  [PERMISSIONS.VIEW_AS_EC]: 'View as EC',
  
  [PERMISSIONS.VIEW_VOTERS]: 'View Voters',
  [PERMISSIONS.VIEW_VOTES]: 'View Votes',
  
  [PERMISSIONS.VIEW_AUDIT_LOGS]: 'View Audit Logs',
  [PERMISSIONS.EXPORT_AUDIT_LOGS]: 'Export Audit Logs'
};

/**
 * Predefined admin roles with default permissions
 */
export const ADMIN_ROLES = {
  SUPER_ADMIN: {
    id: 'super_admin',
    label: 'Super Administrator',
    description: 'Full system access with all permissions',
    permissions: Object.values(PERMISSIONS), // All permissions
    isSystemRole: true, // Cannot be deleted or modified
    color: '#ff4444'
  },
  ADMIN: {
    id: 'admin',
    label: 'Administrator',
    description: 'Most permissions except system-critical operations',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.EXPORT_REPORTS,
      PERMISSIONS.VIEW_ORGANIZATIONS,
      PERMISSIONS.CREATE_ORGANIZATIONS,
      PERMISSIONS.EDIT_ORGANIZATIONS,
      PERMISSIONS.VIEW_ORG_DETAILS,
      PERMISSIONS.VIEW_APPROVALS,
      PERMISSIONS.APPROVE_ELECTIONS,
      PERMISSIONS.REJECT_ELECTIONS,
      PERMISSIONS.VIEW_ADMINS,
      PERMISSIONS.VIEW_SETTINGS,
      PERMISSIONS.INVITE_EC,
      PERMISSIONS.VIEW_AS_EC,
      PERMISSIONS.VIEW_VOTERS,
      PERMISSIONS.VIEW_VOTES,
      PERMISSIONS.VIEW_AUDIT_LOGS
    ],
    isSystemRole: true,
    color: '#ffa500'
  },
  APPROVAL_MANAGER: {
    id: 'approval_manager',
    label: 'Approval Manager',
    description: 'Manages election approvals and reviews',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_ORGANIZATIONS,
      PERMISSIONS.VIEW_ORG_DETAILS,
      PERMISSIONS.VIEW_APPROVALS,
      // NOTE: Can view and comment, but CANNOT approve/reject
      // Only Super Admin can approve/reject elections
      PERMISSIONS.VIEW_VOTERS,
      PERMISSIONS.VIEW_AUDIT_LOGS
    ],
    isSystemRole: true,
    color: '#00eaff'
  },
  VIEWER: {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to dashboard and organizations',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_ORGANIZATIONS,
      PERMISSIONS.VIEW_ORG_DETAILS,
      PERMISSIONS.VIEW_APPROVALS,
      PERMISSIONS.VIEW_ADMINS,
      PERMISSIONS.VIEW_SETTINGS,
      PERMISSIONS.VIEW_VOTERS,
      PERMISSIONS.VIEW_AUDIT_LOGS
    ],
    isSystemRole: true,
    color: '#888'
  },
  CUSTOM: {
    id: 'custom',
    label: 'Custom Role',
    description: 'Custom permission set defined by admin',
    permissions: [],
    isSystemRole: false,
    color: '#00ffaa'
  }
};

/**
 * Check if admin has a specific permission
 * @param {Object} admin - Admin object with permissions array
 * @param {string} permission - Permission to check
 * @returns {boolean} True if admin has permission
 */
export function hasPermission(admin, permission) {
  if (!admin || !admin.permissions) return false;
  
  // Super admin has all permissions
  if (admin.role === 'super_admin' || admin.isSuperAdmin) {
    return true;
  }
  
  return admin.permissions.includes(permission);
}

/**
 * Check if admin has any of the specified permissions
 * @param {Object} admin - Admin object
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} True if admin has at least one permission
 */
export function hasAnyPermission(admin, permissions) {
  return permissions.some(p => hasPermission(admin, p));
}

/**
 * Check if admin has all of the specified permissions
 * @param {Object} admin - Admin object
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} True if admin has all permissions
 */
export function hasAllPermissions(admin, permissions) {
  return permissions.every(p => hasPermission(admin, p));
}

/**
 * Get role object by role ID
 * @param {string} roleId - Role identifier
 * @returns {Object|null} Role object or null if not found
 */
export function getRoleById(roleId) {
  return Object.values(ADMIN_ROLES).find(role => role.id === roleId) || null;
}

/**
 * Get permissions for a role
 * @param {string} roleId - Role identifier
 * @returns {string[]} Array of permission strings
 */
export function getRolePermissions(roleId) {
  const role = getRoleById(roleId);
  return role ? role.permissions : [];
}

/**
 * Validate admin data structure
 * @param {Object} admin - Admin object to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validateAdminData(admin) {
  const errors = [];
  
  if (!admin.email || !admin.email.includes('@')) {
    errors.push('Valid email is required');
  }
  
  if (!admin.name || admin.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  if (!admin.role) {
    errors.push('Role is required');
  }
  
  if (!admin.permissions || !Array.isArray(admin.permissions)) {
    errors.push('Permissions array is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
