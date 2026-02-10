/**
 * EC Utilities - Shared helper functions for EC modules
 */

import { showToast } from '../utils/ui-helpers.js';

/**
 * Check if election editing is locked due to approval status
 * Returns true if status is 'pending' or 'approved'
 * 
 * ✅ PATCH 2: Hard edit lock enforced at function level
 * 
 * @param {Object} org - Organization data
 * @returns {boolean} - True if editing is locked
 */
export function isEditingLocked(org) {
  if (!org) return false;
  
  const approvalStatus = org.approval?.status;
  
  // Lock editing if pending approval or already approved
  return approvalStatus === 'pending' || approvalStatus === 'approved';
}

/**
 * Show appropriate error message when editing is locked
 * 
 * @param {Object} org - Organization data
 * @returns {boolean} - True if locked (and toast shown)
 */
export function checkEditLock(org) {
  if (!isEditingLocked(org)) return false;
  
  const approvalStatus = org.approval?.status;
  
  if (approvalStatus === 'pending') {
    showToast("Election is under review. Editing is locked until approval decision.", "warning");
  } else if (approvalStatus === 'approved') {
    showToast("Election is approved and active. Contact SuperAdmin to make changes.", "warning");
  }
  
  return true;
}

/**
 * Get human-readable approval status
 * 
 * @param {Object} org - Organization data
 * @returns {string} - Status label
 */
export function getApprovalStatusLabel(org) {
  if (!org || !org.approval) return 'Draft';
  
  const status = org.approval.status;
  const statusLabels = {
    'draft': 'Draft',
    'pending': 'Under Review',
    'approved': 'Approved',
    'rejected': 'Needs Correction'
  };
  
  return statusLabels[status] || 'Unknown';
}

/**
 * Check if election can be submitted for approval
 * 
 * @param {Object} org - Organization data
 * @returns {boolean}
 */
export function canSubmitForApproval(org) {
  if (!org) return false;
  
  const status = org.approval?.status;
  return !status || status === 'draft' || status === 'rejected';
}
