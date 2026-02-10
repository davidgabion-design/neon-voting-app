/**
 * Voter Module
 * Main exports for voter functionality
 */

// Login functionality
export {
  updateVoterLoginScreen,
  updateCredentialFieldsForOrg,
  loginVoterWithCredential,
  setCredentialType,
  loginVoterOrgCredential,
  findVoterByEmailOrPhone,
  showVoterHelpModal,
  debugVoterStatus,
  restoreVoterSession,
  logoutVoter
} from './login.js';

// Voting functionality
export {
  loadVotingBallot,
  updateSelectedCandidates,
  updateVoteSummary,
  clearSelections,
  cancelVoting,
  getSelectedCandidates,
  clearSelectedCandidates
} from './voting.js';

// Results functionality
export {
  submitVote,
  showVoteSuccess,
  showAlreadyVotedScreen,
  startVoterCountdown,
  showVoterLiveDashboard
} from './results.js';
