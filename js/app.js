// js/app.js - Main Application Entry Point
// This file coordinates all modules and initializes the application

// Import configuration
import { db, storage } from './config/firebase.js';
import * as constants from './config/constants.js';

// Import state management
import * as appState from './state/app-state.js';

// Import utilities
import * as validation from './utils/validation.js';
import * as formatting from './utils/formatting.js';
import * as normalization from './utils/normalization.js';
import * as uiHelpers from './utils/ui-helpers.js';
import * as session from './utils/session.js';
import * as activity from './utils/activity.js';
import * as adminGuard from './utils/admin-guard.js';
import { downloadGuidancePDF } from './utils/guidance-pdf.js';
import { loadLanguage, initLanguage, setupLanguageSelector, t } from './utils/i18n.js';
import { showTip, showWalkthrough, showECWalkthrough, showVoterWalkthrough, resetWalkthroughs } from './utils/walkthrough.js';

// Import feature modules
import * as voter from './voter/index.js';
import * as superAdmin from './super-admin/index.js';
import * as admin from './admin/index.js';
import * as ec from './ec/index.js';
import * as invites from './invites/index.js';
import * as reports from './reports/index.js';
import * as shared from './shared/index.js';

// Make core modules available globally for backwards compatibility
// This allows inline onclick handlers and existing code to work
window.db = db;
window.storage = storage;
window.constants = constants;
window.appState = appState;
window.validation = validation;
window.formatting = formatting;
window.normalization = normalization;
window.uiHelpers = uiHelpers;
window.session = session.getSession();
window.adminGuard = adminGuard;
window.voter = voter;
window.superAdmin = superAdmin;
window.admin = admin;
window.ec = ec;
window.invites = invites;
window.reports = reports;
window.shared = shared;

// Export global helper functions (already done in ui-helpers.js, but reinforce here)
window.showToast = uiHelpers.showToast;
window.showScreen = uiHelpers.showScreen;
window.createModal = uiHelpers.createModal;
window.getUrlParam = uiHelpers.getUrlParam;
window.getDefaultLogo = uiHelpers.getDefaultLogo;
window.getDefaultAvatar = uiHelpers.getDefaultAvatar;
window.downloadGuidancePDF = downloadGuidancePDF;
window.loadLanguage = loadLanguage;
window.initLanguage = initLanguage;
window.setupLanguageSelector = setupLanguageSelector;
window.t = t;
window.showTip = showTip;
window.showWalkthrough = showWalkthrough;
window.showECWalkthrough = showECWalkthrough;
window.showVoterWalkthrough = showVoterWalkthrough;
window.resetWalkthroughs = resetWalkthroughs;

// Export key module functions for inline onclick handlers
window.loginAdmin = admin.loginAdmin;
window.loginEC = ec.loginEC;

// Export session restoration functions
window.restoreECSession = ec.restoreECSession;
window.restoreSuperAdminSession = superAdmin.restoreSuperAdminSession;
window.restoreAdminSession = admin.restoreAdminSession;
window.restoreVoterSession = voter.restoreVoterSession;

// Export dashboard functions
window.initializeDashboard = superAdmin.initializeDashboard;
window.refreshDashboard = superAdmin.refreshDashboard;
window.setDashboardTimeFilter = superAdmin.setDashboardTimeFilter;

// Export approval functions
window.loadSuperApprovals = superAdmin.loadSuperApprovals;
window.approveElection = superAdmin.approveElection;
window.rejectElection = superAdmin.rejectElection;
window.revokeApproval = superAdmin.revokeApproval;
window.reconsiderApproval = superAdmin.reconsiderApproval;

// Export administrator management functions
window.loadAdministrators = superAdmin.loadAdministrators;

// Export admin panel functions
window.showAdminTab = admin.showAdminTab;
window.loadAdminDashboard = admin.loadAdminDashboard;

// 🔥 PATCH 3: Expose all admin tab loaders on window
window.loadAdminOrganizations = admin.loadAdminOrganizations;
window.loadAdminApprovals = admin.loadAdminApprovals;
window.loadAdminAdministrators = admin.loadAdminAdministrators;
window.loadAdminSettings = admin.loadAdminSettings;
window.loadAdminAuditLogs = admin.loadAdminAuditLogs;

// Export helper functions
window.openOrgAsEC = superAdmin.openOrgAsEC;
window.showECInviteModal = superAdmin.showECInviteModal;
window.sendECInvite = superAdmin.sendECInvite;
window.sendECInviteSMS = superAdmin.sendECInviteSMS;
window.sendECInviteWhatsApp = superAdmin.sendECInviteWhatsApp;
window.showECWhatsAppModal = superAdmin.showECWhatsAppModal;
window.sendECWhatsAppInvite = superAdmin.sendECWhatsAppInvite;
window.closeModal = superAdmin.closeModal;
window.showPasswordModal = superAdmin.showPasswordModal;
window.viewOrgDetails = superAdmin.viewOrgDetails;

// Export organization management functions
window.showCreateOrgModal = superAdmin.showCreateOrgModal;
window.previewOrgLogo = superAdmin.previewOrgLogo;
window.createNewOrganization = superAdmin.createNewOrganization;
window.editOrganizationModal = superAdmin.editOrganizationModal;
window.previewEditOrgLogo = superAdmin.previewEditOrgLogo;
window.saveOrganizationEdits = superAdmin.saveOrganizationEdits;
window.deleteOrganizationConfirm = superAdmin.deleteOrganizationConfirm;
window.deleteOrganization = superAdmin.deleteOrganizationEnhanced;
window.bulkDeleteEmptyOrganizations = superAdmin.bulkDeleteEmptyOrganizations;
window.changeSuperPassword = superAdmin.changeSuperPassword;
window.checkFirebaseStatus = superAdmin.checkFirebaseStatus;
window.saveSyncSettings = superAdmin.saveSyncSettings;
window.resetAppData = superAdmin.resetAppData;
window.loadSuperSettings = superAdmin.loadSuperSettings;
window.loadSuperOrganizationsEnhanced = superAdmin.loadSuperOrganizationsEnhanced;
window.showAllOrganizations = superAdmin.showAllOrganizations;

// Export reports/export functions
window.exportResultsCSV = reports.exportResultsCSV;
window.exportResultsPDF = reports.exportResultsPDF;
window.exportAuditCSV = reports.exportAuditCSV;
window.refreshOutcomes = reports.refreshOutcomes;
window.loadECOutcomes = reports.loadECOutcomes;
window.cleanupOutcomesListener = reports.cleanupOutcomesListener;
window.loadECApproval = reports.loadECApproval;
window.submitForApprovalFinal = reports.submitForApprovalFinal;
window.resubmitForApproval = reports.resubmitForApproval;

// Export EC functions
window.showECTab = ec.showECTab;
window.loadECVoters = ec.loadECVoters;
window.loadECPositions = ec.loadECPositions;
window.loadECCandidates = ec.loadECCandidates;
window.loadECSettings = ec.loadECSettings;
window.switchSettingsTab = ec.switchSettingsTab;
window.showAddVoterModal = ec.showAddVoterModal;
window.addVoterWithEmailOrPhone = ec.addVoterWithEmailOrPhone;
window.editVoterModal = ec.editVoterModal;
window.removeVoter = ec.removeVoter;
window.updateVoter = ec.updateVoter;
window.searchVoters = ec.searchVoters;
window.refreshVoters = ec.refreshVoters;
window.showBulkVoterModal = ec.showBulkVoterModal;
window.processBulkVoters = ec.processBulkVoters;
window.exportVotersCSV = ec.exportVotersCSV;
window.showAddPositionModal = ec.showAddPositionModal;
window.savePosition = ec.savePosition;
window.editPositionModal = ec.editPositionModal;
window.updatePosition = ec.updatePosition;
window.deletePositionConfirm = ec.deletePositionConfirm;
window.refreshPositions = ec.refreshPositions;
window.showAddCandidateModal = ec.showAddCandidateModal;
window.addCandidate = ec.addCandidate;
window.editCandidateModal = ec.editCandidateModal;
window.updateCandidate = ec.updateCandidate;
window.deleteCandidateConfirm = ec.deleteCandidateConfirm;
window.refreshCandidates = ec.refreshCandidates;
window.showAddCandidateForPositionModal = ec.showAddCandidateForPositionModal;
window.addCandidateForPosition = ec.addCandidateForPosition;

// Export invite functions  
window.sendVoterInvite = invites.sendVoterInvite;
window.sendVoterInviteSMS = invites.sendVoterInviteSMS;
window.sendVoterInviteWhatsApp = invites.sendVoterInviteWhatsApp;
window.sendECInviteFunc = invites.sendECInvite;
window.switchToBulkInvite = invites.switchToBulkInvite;
window.loadInvitesTracking = invites.loadInvitesTracking;
window.resendInvite = invites.resendInvite;
window.deleteInvite = invites.deleteInvite;
window.filterInvites = invites.filterInvites;
window.loadInviteTemplates = invites.loadInviteTemplates;
window.saveInviteTemplates = invites.saveInviteTemplates;
window.resetInviteTemplates = invites.resetInviteTemplates;
window.sendBulkVoterInvites = invites.sendBulkVoterInvites;
window.showBulkTab = invites.showBulkTab;
window.selectAllBulkVoters = invites.selectAllBulkVoters;
window.deselectAllBulkVoters = invites.deselectAllBulkVoters;
window.updateBulkVoterCount = invites.updateBulkVoterCount;

// Export voter functions
window.updateVoterLoginScreen = voter.updateVoterLoginScreen;
window.updateCredentialFieldsForOrg = voter.updateCredentialFieldsForOrg;
window.loginVoterWithCredential = voter.loginVoterWithCredential;
window.loginVoterOrgCredential = voter.loginVoterOrgCredential;
window.setCredentialType = voter.setCredentialType;
window.showVoterHelpModal = voter.showVoterHelpModal;
window.debugVoterStatus = voter.debugVoterStatus;
window.restoreVoterSession = voter.restoreVoterSession;
window.logoutVoter = voter.logoutVoter;
window.cancelVoting = voter.cancelVoting;
window.updateSelectedCandidates = voter.updateSelectedCandidates;
window.updateVoteSummary = voter.updateVoteSummary;
window.clearSelections = voter.clearSelections;
window.loadVotingBallot = voter.loadVotingBallot;
window.submitVote = voter.submitVote;
window.showVoteSuccess = voter.showVoteSuccess;
window.showAlreadyVotedScreen = voter.showAlreadyVotedScreen;

// Export settings/actions from EC module (primary source)
window.saveElectionSchedule = ec.saveElectionSchedule;
window.clearElectionSchedule = ec.clearElectionSchedule;
window.generatePublicLink = ec.generatePublicLink;
window.copyPublicLink = ec.copyPublicLink;

// Export results/actions from reports module
window.declareResults = reports.declareResults;
window.declareResultsConfirm = reports.declareResultsConfirm;
window.resetAllVotes = reports.resetAllVotes;
window.resetVotesConfirm = reports.resetVotesConfirm;
window.clearAllData = reports.clearAllData;
window.clearAllDataConfirm = reports.clearAllDataConfirm;
window.syncVoterCounts = reports.syncVoterCounts;

// Export shared/alerts
window.send30MinAlerts = shared.send30MinAlerts;
window.sendVoteStartAlerts = shared.sendVoteStartAlerts;
window.startAlertScheduler = shared.startAlertScheduler;
window.stopAlertScheduler = shared.stopAlertScheduler;

// Export activity/audit logging
window.logActivity = activity.logActivity;
window.logAudit = activity.logAudit;
window.loadActivityFeed = activity.loadActivityFeed;
window.exportAuditCSV = activity.exportAuditCSV;

// Initialize application modules
console.log('✅ Voter Module:', Object.keys(voter).length, 'exports');
console.log('✅ Super Admin Module:', Object.keys(superAdmin).length, 'exports');
console.log('✅ Admin Module:', Object.keys(admin).length, 'exports');
console.log('✅ EC Module:', Object.keys(ec).length, 'exports');
console.log('✅ Invites Module:', Object.keys(invites).length, 'exports');
console.log('✅ Reports Module:', Object.keys(reports).length, 'exports');
console.log('✅ Shared Module:', Object.keys(shared).length, 'exports');
console.log('🎉 All 7 modules loaded successfully - 100% complete!');

export default {
  // Core modules
  db,
  storage,
  constants,
  appState,
  
  // Utilities
  validation,
  formatting,
  normalization,
  uiHelpers,
  session,
  
  // Feature modules
  voter
};
