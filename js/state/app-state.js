// js/state/app-state.js - Global Application State Management

// Organization State
export let currentOrgId = null;
export let currentOrgData = null;
export let currentOrgUnsub = null;

// Voter Session State
export let voterSession = null;

// Voting State
export let selectedCandidates = {};
export let votingChoices = {};

// UI State
export let activeTab = 'voters';

// Interval State (for cleanup)
export let countdownInterval = null;
export let voterCountdownInterval = null;
export let refreshIntervals = {};
export let alertSchedulerInterval = null;

// Signature State (EC + Super Admin)
if (!window.signatureState) {
  window.signatureState = { ec: null, superAdmin: null };
}

// State Setters
export function setCurrentOrgId(orgId) {
  currentOrgId = orgId;
}

export function setCurrentOrgData(data) {
  currentOrgData = data;
}

export function setCurrentOrgUnsub(unsub) {
  currentOrgUnsub = unsub;
}

export function setVoterSession(session) {
  voterSession = session;
}

export function setSelectedCandidates(candidates) {
  selectedCandidates = candidates;
}

export function setVotingChoices(choices) {
  votingChoices = choices;
}

export function setActiveTab(tab) {
  activeTab = tab;
}

export function setCountdownInterval(interval) {
  countdownInterval = interval;
}

export function setVoterCountdownInterval(interval) {
  voterCountdownInterval = interval;
}

export function setRefreshInterval(key, interval) {
  refreshIntervals[key] = interval;
}

export function clearRefreshInterval(key) {
  if (refreshIntervals[key]) {
    clearInterval(refreshIntervals[key]);
    delete refreshIntervals[key];
  }
}

export function setAlertSchedulerInterval(interval) {
  alertSchedulerInterval = interval;
}

export function setSignatureState(type, data) {
  if (type === 'ec' || type === 'superAdmin') {
    window.signatureState[type] = data;
  }
}

// State Getters (for convenience)
export function getCurrentOrgId() {
  return currentOrgId;
}

export function getCurrentOrgData() {
  return currentOrgData;
}

export function getCurrentOrgUnsub() {
  return currentOrgUnsub;
}

export function getVoterSession() {
  return voterSession;
}

export function getSelectedCandidates() {
  return selectedCandidates;
}

export function getVotingChoices() {
  return votingChoices;
}

export function getActiveTab() {
  return activeTab;
}

export function getCountdownInterval() {
  return countdownInterval;
}

export function getVoterCountdownInterval() {
  return voterCountdownInterval;
}

export function getRefreshIntervals() {
  return refreshIntervals;
}

export function getAlertSchedulerInterval() {
  return alertSchedulerInterval;
}

export function getSignatureState(type) {
  return window.signatureState[type] || null;
}

// Reset State (for logout/cleanup)
export function resetOrgState() {
  if (currentOrgUnsub) {
    currentOrgUnsub();
  }
  currentOrgId = null;
  currentOrgData = null;
  currentOrgUnsub = null;
  selectedCandidates = {};
  votingChoices = {};
  activeTab = 'voters';
}

export function resetVoterState() {
  voterSession = null;
  selectedCandidates = {};
  votingChoices = {};
}

export function clearAllIntervals() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (voterCountdownInterval) {
    clearInterval(voterCountdownInterval);
    voterCountdownInterval = null;
  }
  if (alertSchedulerInterval) {
    clearInterval(alertSchedulerInterval);
    alertSchedulerInterval = null;
  }
  Object.keys(refreshIntervals).forEach(key => {
    clearInterval(refreshIntervals[key]);
  });
  refreshIntervals = {};
}

export function resetAllState() {
  resetOrgState();
  resetVoterState();
  clearAllIntervals();
  window.signatureState = { ec: null, superAdmin: null };
}

// Export state object for backwards compatibility
export default {
  // State
  get currentOrgId() { return currentOrgId; },
  set currentOrgId(val) { currentOrgId = val; },
  get currentOrgData() { return currentOrgData; },
  set currentOrgData(val) { currentOrgData = val; },
  get currentOrgUnsub() { return currentOrgUnsub; },
  set currentOrgUnsub(val) { currentOrgUnsub = val; },
  get voterSession() { return voterSession; },
  set voterSession(val) { voterSession = val; },
  get selectedCandidates() { return selectedCandidates; },
  set selectedCandidates(val) { selectedCandidates = val; },
  get votingChoices() { return votingChoices; },
  set votingChoices(val) { votingChoices = val; },
  get activeTab() { return activeTab; },
  set activeTab(val) { activeTab = val; },
  get countdownInterval() { return countdownInterval; },
  set countdownInterval(val) { countdownInterval = val; },
  get voterCountdownInterval() { return voterCountdownInterval; },
  set voterCountdownInterval(val) { voterCountdownInterval = val; },
  get refreshIntervals() { return refreshIntervals; },
  get alertSchedulerInterval() { return alertSchedulerInterval; },
  set alertSchedulerInterval(val) { alertSchedulerInterval = val; },
  
  // Methods
  setCurrentOrgId,
  setCurrentOrgData,
  setCurrentOrgUnsub,
  setVoterSession,
  setSelectedCandidates,
  setVotingChoices,
  setActiveTab,
  setCountdownInterval,
  setVoterCountdownInterval,
  setRefreshInterval,
  clearRefreshInterval,
  setAlertSchedulerInterval,
  setSignatureState,
  getCurrentOrgId,
  getCurrentOrgData,
  getCurrentOrgUnsub,
  getVoterSession,
  getSelectedCandidates,
  getVotingChoices,
  getActiveTab,
  getCountdownInterval,
  getVoterCountdownInterval,
  getRefreshIntervals,
  getAlertSchedulerInterval,
  getSignatureState,
  resetOrgState,
  resetVoterState,
  clearAllIntervals,
  resetAllState
};
