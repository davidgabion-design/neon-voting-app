/**
 * Admin Module - Main Entry Point
 * Exports all admin-related functions
 */

export { loginAdmin, openAdminPanel, showAdminTab, restoreAdminSession } from './login.js';
export {
  loadAdminDashboard,
  loadAdminOrganizations,
  loadAdminApprovals,
  loadAdminAdministrators,
  loadAdminSettings,
  loadAdminAuditLogs
} from './dashboard.js';
