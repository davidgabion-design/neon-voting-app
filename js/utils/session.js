// js/utils/session.js - Session Management Functions

import { SESSION_KEY } from '../config/constants.js';

let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");

/**
 * Save current session to localStorage
 */
export function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  
  // Make session available globally
  try {
    window.session = session;
  } catch (e) {
    console.warn('Could not set window.session:', e);
  }
}

/**
 * Get current session object
 * @returns {object} Session data
 */
export function getSession() {
  return session;
}

/**
 * Set session data
 * @param {object} data - Session data to set
 */
export function setSession(data) {
  session = data || {};
  saveSession();
}

/**
 * Update session with partial data
 * @param {object} updates - Data to merge into session
 */
export function updateSession(updates) {
  session = { ...session, ...updates };
  saveSession();
}

/**
 * Clear all session data
 */
export function clearSession() {
  session = {};
  localStorage.removeItem(SESSION_KEY);
  try {
    delete window.session;
  } catch (e) {
    console.warn('Could not delete window.session:', e);
  }
}

/**
 * Check if user is logged in as EC
 * @returns {boolean} True if EC session exists
 */
export function isECLoggedIn() {
  return !!(session && session.role === 'ec' && session.orgId);
}

/**
 * Check if user is logged in as Super Admin
 * @returns {boolean} True if Super Admin session exists
 */
export function isSuperAdminLoggedIn() {
  return !!(session && session.role === 'superAdmin');
}

/**
 * Check if user is logged in as Voter
 * @returns {boolean} True if Voter session exists
 */
export function isVoterLoggedIn() {
  return !!(session && session.role === 'voter' && session.orgId);
}

/**
 * Check if user is logged in as Administrator
 * @returns {boolean} True if Admin session exists
 */
export function isAdminLoggedIn() {
  return !!(session && session.role === 'admin' && session.adminEmail);
}

/**
 * Get current user role from session
 * @returns {string|null} User role: 'ec', 'superAdmin', 'admin', 'voter', or null
 */
export function getRole() {
  return session?.role || null;
}

/**
 * Get current organization ID from session
 * @returns {string|null} Organization ID or null
 */
export function getOrgId() {
  return session?.orgId || null;
}

/**
 * Get voter credential from session
 * @returns {string|null} Voter credential or null
 */
export function getVoterCredential() {
  return session?.credential || null;
}

/**
 * Set EC session
 * @param {string} orgId - Organization ID
 * @param {object} orgData - Organization data
 * @param {string} email - EC email
 */
export function setECSession(orgId, orgData, email) {
  session = {
    role: 'ec',
    orgId: orgId,
    orgName: orgData?.name || 'Organization',
    email: email,
    loginTime: new Date().toISOString()
  };
  saveSession();
}

/**
 * Set Super Admin session
 */
export function setSuperAdminSession() {
  session = {
    role: 'superAdmin',
    loginTime: new Date().toISOString()
  };
  saveSession();
}

/**
 * Set Voter session
 * @param {string} orgId - Organization ID
 * @param {string} credential - Voter credential
 * @param {object} voterData - Voter data
 */
export function setVoterSession(orgId, credential, voterData) {
  session = {
    role: 'voter',
    orgId: orgId,
    credential: credential,
    voterName: voterData?.name || 'Voter',
    loginTime: new Date().toISOString()
  };
  saveSession();
}

/**
 * Set Administrator session
 * @param {string} email - Admin email
 * @param {string} name - Admin name
 * @param {string} role - Admin role
 * @param {array} permissions - Admin permissions
 */
export function setAdminSession(email, name, role, permissions) {
  session = {
    role: 'admin',
    adminEmail: email,
    adminName: name,
    adminRole: role,
    adminPermissions: permissions || [],
    loginTime: new Date().toISOString()
  };
  saveSession();
}

/**
 * Logout current user (clear session)
 */
export function logout() {
  clearSession();
}

export default {
  saveSession,
  getSession,
  setSession,
  updateSession,
  clearSession,
  isECLoggedIn,
  isSuperAdminLoggedIn,
  isAdminLoggedIn,
  isVoterLoggedIn,
  getRole,
  getOrgId,
  getVoterCredential,
  setECSession,
  setSuperAdminSession,
  setAdminSession,
  setVoterSession,
  logout
};
