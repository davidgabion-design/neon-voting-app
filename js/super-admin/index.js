/**
 * Super Admin Module
 * Main exports for SuperAdmin functionality
 */

// Login
export { loginSuperAdmin, restoreSuperAdminSession } from './login.js';

// Dashboard & Navigation
export { showSuperTab, showAllOrganizations } from './dashboard.js';

// Organizations Management
export {
  loadSuperOrganizationsEnhanced,
  loadSuperDeleteEnhanced,
  showCreateOrgModal,
  previewOrgLogo,
  createNewOrganization,
  editOrganizationModal,
  previewEditOrgLogo,
  saveOrganizationEdits,
  deleteOrganizationConfirm,
  deleteOrganizationEnhanced,
  bulkDeleteEmptyOrganizations
} from './organizations.js';

// Helper Functions
export {
  openOrgAsEC,
  showECInviteModal,
  sendECInvite,
  sendECInviteSMS,
  sendECInviteWhatsApp,
  sendECInviteEmail,
  showECWhatsAppModal,
  sendECWhatsAppInvite,
  closeModal,
  showPasswordModal,
  viewOrgDetails
} from './helpers.js';

// Approvals Workflow
export {
  loadSuperApprovals,
  approveElection,
  rejectElection,
  revokeApproval,
  reconsiderApproval
} from './approvals.js';

// Administrators Management
export {
  loadAdministrators
} from './administrators.js';

// Settings & Configuration
export {
  loadSuperSettings,
  changeSuperPassword,
  saveSystemSettings,
  checkFirebaseStatus,
  saveSyncSettings,
  resetAppData
} from './settings.js';

// Dashboard Stats & Analytics
export {
  initializeDashboard,
  refreshDashboard,
  loadDashboardData,
  setDashboardTimeFilter
} from './stats.js';
