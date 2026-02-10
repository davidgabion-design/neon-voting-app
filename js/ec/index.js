/**
 * EC Module
 * Main exports for Election Commissioner functionality
 */

// Login & Authentication
export { loginEC, openECPanel, updateECUI, restoreECSession } from './login.js';

// Dashboard & Navigation
export { showECTab } from './dashboard.js';

// Voters Management
export {
  loadECVoters,
  showAddVoterModal,
  addVoterWithEmailOrPhone,
  editVoterModal,
  updateVoter,
  removeVoter,
  searchVoters,
  refreshVoters,
  showBulkVoterModal,
  processBulkVoters,
  exportVotersCSV
} from './voters.js';

// Positions Management
export {
  loadECPositions,
  showAddPositionModal,
  savePosition,
  editPositionModal,
  updatePosition,
  deletePositionConfirm,
  refreshPositions
} from './positions.js';

// Candidates Management
export {
  loadECCandidates,
  showAddCandidateModal,
  addCandidate,
  editCandidateModal,
  updateCandidate,
  deleteCandidateConfirm,
  refreshCandidates,
  showAddCandidateForPositionModal,
  addCandidateForPosition
} from './candidates.js';

// Settings & Configuration
export {
  loadECSettings,
  switchSettingsTab,
  saveElectionSchedule,
  clearElectionSchedule,
  generatePublicLink,
  copyPublicLink
} from './settings.js';
