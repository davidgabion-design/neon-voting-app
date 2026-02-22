/**
 * Super Admin Module - Approvals
 * Handles election approval workflow
 */

import { db } from '../config/firebase.js';
import { collection, doc, getDocs, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showQuickLoading, renderError, getDefaultLogo } from '../utils/ui-helpers.js';
import { escapeHtml } from '../utils/validation.js';
import { loadSuperOrganizationsEnhanced } from './organizations.js';
import { logActivity, logAudit } from '../utils/activity.js';
import { applyTranslations } from '../utils/i18n.js';

/**
 * Helper: Calculate SLA badge for approval requests
 */
function _slaBadge(requestedDate) {
  if (!requestedDate) return '';
  const mins = Math.floor((Date.now() - requestedDate.getTime()) / 60000);

  // thresholds: <60m good, <240m warning, else overdue
  let label = '';
  let color = '#00ffaa';
  if (mins < 60) { label = `${mins}m`; color = '#00ffaa'; }
  else if (mins < 240) { label = `${Math.floor(mins/60)}h`; color = '#ffc107'; }
  else { label = `${Math.floor(mins/60)}h`; color = '#ff4444'; }

  return `<span class="badge" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);color:${color};margin-left:8px">
    <i class="fas fa-stopwatch"></i> SLA: ${label}
  </span>`;
}

/**
 * Load approval requests tab
 */
export async function loadSuperApprovals() {
  // ✅ PATCH: render into the correct container to preserve tab header
  const el = document.getElementById("superApprovalList");
  if (!el) return;
  
  showQuickLoading("superApprovalList", "Loading Approval Requests");
  
  try {
    const snaps = await getDocs(collection(db, "organizations"));
    const orgs = []; 
    snaps.forEach(s => {
      const data = s.data();
      if (!data.isDeleted) {  // Exclude deleted orgs
        orgs.push({ id: s.id, ...data });
      }
    });
    
    console.log('Approvals: Loaded', orgs.length, 'organizations');
    
    // ✅ PATCH: Filter organizations by approval status
    // Helper to check if status is "pending"
    const _isPendingStatus = (s) => {
      const v = String(s || '').toLowerCase();
      return (
        v === 'pending' ||
        v === 'submitted' ||
        v === 'pending_approval' ||
        v === 'pendingapproval' ||
        v === 'awaiting_approval'
      );
    };
    
    const pendingOrgs = orgs.filter(org => {
      const status = org.approval?.status;
      const hasRequest = !!org.approval?.requestedAt;
      return hasRequest && _isPendingStatus(status);
    });
    
    const approvedOrgs = orgs.filter(org => String(org.approval?.status || '').toLowerCase() === 'approved');
    const rejectedOrgs = orgs.filter(org => String(org.approval?.status || '').toLowerCase() === 'rejected');
    
    console.log('Approvals:', {
      pending: pendingOrgs.length,
      approved: approvedOrgs.length,
      rejected: rejectedOrgs.length
    });
    
    let html = `
      <div style="margin-bottom:20px">
        <h3><i class="fas fa-clipboard-check"></i> <span data-i18n="election_approvals">Election Approvals</span></h3>
        <div style="display:flex;gap:15px;margin-top:10px">
          <div class="card" style="flex:1;text-align:center;background:rgba(255,193,7,0.05);border:1px solid rgba(255,193,7,0.2);">
            <div style="font-size:24px;color:#ffc107;font-weight:bold">${pendingOrgs.length}</div>
            <div style="font-size:12px;color:#ffc107" data-i18n="pending_label">Pending</div>
          </div>
          <div class="card" style="flex:1;text-align:center;background:rgba(0,255,170,0.05);border:1px solid rgba(0,255,170,0.2);">
            <div style="font-size:24px;color:#00ffaa;font-weight:bold">${approvedOrgs.length}</div>
            <div style="font-size:12px;color:#00ffaa" data-i18n="approved_label">Approved</div>
          </div>
          <div class="card" style="flex:1;text-align:center;background:rgba(255,68,68,0.05);border:1px solid rgba(255,68,68,0.2);">
            <div style="font-size:24px;color:#ff4444;font-weight:bold">${rejectedOrgs.length}</div>
            <div style="font-size:12px;color:#ff4444" data-i18n="rejected_label">Rejected</div>
          </div>
        </div>
      </div>
      
      <div style="display:flex;gap:8px;margin-bottom:15px">
        <button class="btn neon-btn-outline" onclick="window.loadSuperApprovals()">
          <i class="fas fa-redo"></i> <span data-i18n="refresh">Refresh</span>
        </button>
      </div>
    `;
    
    if (pendingOrgs.length === 0 && approvedOrgs.length === 0 && rejectedOrgs.length === 0) {
      html += `
        <div class="card empty-state">
          <i class="fas fa-clipboard-check"></i>
          <h4 data-i18n="no_approval_requests">No Approval Requests</h4>
          <p class="subtext" data-i18n="no_approval_requests_desc">No organizations have requested approval yet.</p>
        </div>
      `;
    } else {
      // Pending Approvals
      if (pendingOrgs.length > 0) {
        html += `
          <div class="card" style="margin-bottom:20px;border-left:4px solid #ffc107;">
            <h4 style="color:#ffc107;margin-bottom:15px">
              <i class="fas fa-hourglass-half"></i> <span data-i18n="pending_approvals_count">Pending Approvals</span> (${pendingOrgs.length})
            </h4>
        `;
        
        pendingOrgs.forEach(org => {
          const voterCount = org.voterCount || 0;
          const positionCount = org.positionCount || 0;
          const candidateCount = org.candidateCount || 0;
          const voteCount = org.voteCount || 0;
          const requestedDate = org.approval?.requestedAt 
            ? (org.approval.requestedAt.toDate ? org.approval.requestedAt.toDate() : new Date(org.approval.requestedAt))
            : (org.createdAt ? (org.createdAt.toDate ? org.createdAt.toDate() : new Date(org.createdAt)) : new Date());
          
          html += `
            <div class="list-item" style="margin-bottom:10px;align-items:center">
              <div style="flex:1">
                <div style="display:flex;gap:10px;align-items:center">
                  <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                       style="width:50px;height:50px;border-radius:10px;object-fit:cover;border:2px solid rgba(255,193,7,0.3);">
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px">
                      <strong style="color:#fff">${escapeHtml(org.name || org.id)}</strong>
                      ${org.resubmittedAfterRevocation ? `
                        <span class="badge" style="background:rgba(255,152,0,0.2);border:1px solid #ff9800;color:#ffb74d;font-size:11px;padding:2px 6px">
                          <i class="fas fa-redo"></i> RESUBMITTED
                        </span>
                      ` : ''}
                    </div>
                    <div class="subtext" style="margin-top:2px">ID: ${org.id}</div>
                    <div style="display:flex;gap:15px;margin-top:4px">
                      <span class="subtext" style="color:#00eaff"><i class="fas fa-users"></i> ${voterCount} <span data-i18n="voters">voters</span></span>
                      <span class="subtext" style="color:#9beaff"><i class="fas fa-check-circle"></i> ${voteCount} <span data-i18n="votes">votes</span></span>
                      <span class="subtext" style="color:#9beaff"><i class="fas fa-trophy"></i> ${positionCount} <span data-i18n="positions">positions</span></span>
                      <span class="subtext" style="color:#9beaff"><i class="fas fa-user-tie"></i> ${candidateCount} <span data-i18n="candidates">candidates</span></span>
                    </div>
                    <div class="subtext" style="margin-top:4px">
                      <i class="fas fa-calendar"></i> <span data-i18n="requested">Requested:</span> ${requestedDate.toLocaleDateString()} ${requestedDate.toLocaleTimeString()}
                      ${_slaBadge(requestedDate)}
                    </div>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:nowrap">
                ${(() => {
                  // ✅ PERMISSION-AWARE: Only show approve/reject for Super Admin
                  const currentUser = window.currentAdmin || window.currentSuperAdmin;
                  const canApprove = currentUser?.role === 'super_admin' || 
                                    (typeof window.adminHasPermission === 'function' && 
                                     window.adminHasPermission('approve_elections'));
                  
                  if (canApprove) {
                    return `
                      <button class="btn btn-approve" onclick="window.approveElection('${org.id}', '${escapeHtml(org.name || org.id)}')" style="white-space:nowrap">
                        <i class="fas fa-check"></i> <span data-i18n="approve">Approve</span>
                      </button>
                      <button class="btn neon-btn-outline" onclick="window.rejectElection('${org.id}', '${escapeHtml(org.name || org.id)}')" style="white-space:nowrap;border-color:#ff6666;color:#ffb3b3">
                        <i class="fas fa-times"></i> <span data-i18n="reject">Reject</span>
                      </button>
                    `;
                  } else {
                    return `
                      <span class="subtext" style="padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 4px; white-space: nowrap;">
                        <i class="fas fa-eye"></i> <span data-i18n="view_only">View Only</span>
                      </span>
                    `;
                  }
                })()}
                <button class="btn neon-btn-outline" onclick="window.viewOrgDetails('${org.id}')" title="View Details">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      }
      
      // Approved Elections
      if (approvedOrgs.length > 0) {
        html += `
          <div class="card" style="margin-bottom:20px;border-left:4px solid #00ffaa;">
            <h4 style="color:#00ffaa;margin-bottom:15px">
              <i class="fas fa-check-circle"></i> <span data-i18n="approved_elections">Approved Elections</span> (${approvedOrgs.length})
            </h4>
        `;
        
        approvedOrgs.forEach(org => {
          const approvedDate = org.approval?.approvedAt 
            ? (org.approval.approvedAt.toDate ? org.approval.approvedAt.toDate() : new Date(org.approval.approvedAt))
            : new Date();
          const voterCount = org.voterCount || 0;
          const voteCount = org.voteCount || 0;
          
          html += `
            <div class="list-item" style="margin-bottom:10px;align-items:center">
              <div style="flex:1">
                <div style="display:flex;gap:10px;align-items:center">
                  <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                       style="width:50px;height:50px;border-radius:10px;object-fit:cover;border:2px solid rgba(0,255,170,0.3);">
                  <div style="flex:1">
                    <strong style="color:#fff">${escapeHtml(org.name || org.id)}</strong>
                    <div class="subtext" style="margin-top:2px">ID: ${org.id}</div>
                    <div style="display:flex;gap:15px;margin-top:4px">
                      <span class="subtext" style="color:#00eaff"><i class="fas fa-users"></i> ${voterCount} <span data-i18n="voters">voters</span></span>
                      <span class="subtext" style="color:#0f0"><i class="fas fa-check-circle"></i> ${voteCount} <span data-i18n="votes_cast">votes cast</span></span>
                    </div>
                    <div class="subtext" style="margin-top:4px">
                      <i class="fas fa-check-circle"></i> <span data-i18n="approved_by">Approved:</span> ${approvedDate.toLocaleDateString()} by ${org.approval?.approvedBy || 'SuperAdmin'}
                    </div>
                    ${org.approval?.comments ? `
                      <div class="subtext" style="margin-top:2px;color:#00eaff">
                        <i class="fas fa-comment"></i> ${org.approval.comments}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:nowrap">
                <span class="badge success" style="white-space:nowrap">
                  <i class="fas fa-check"></i> <span data-i18n="approved_label">Approved</span>
                </span>
                <button class="btn btn-danger" onclick="window.revokeApproval('${org.id}', '${escapeHtml(org.name || org.id)}')" style="white-space:nowrap">
                  <i class="fas fa-undo"></i> <span data-i18n="revoke">Revoke</span>
                </button>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      }
      
      // Rejected Elections
      if (rejectedOrgs.length > 0) {
        html += `
          <div class="card" style="margin-bottom:20px;border-left:4px solid #ff4444;">
            <h4 style="color:#ff4444;margin-bottom:15px">
              <i class="fas fa-times-circle"></i> <span data-i18n="rejected_elections">Rejected Elections</span> (${rejectedOrgs.length})
            </h4>
        `;
        
        rejectedOrgs.forEach(org => {
          const rejectedDate = org.approval?.rejectedAt 
            ? (org.approval.rejectedAt.toDate ? org.approval.rejectedAt.toDate() : new Date(org.approval.rejectedAt))
            : new Date();
          
          html += `
            <div class="list-item" style="margin-bottom:10px;align-items:center">
              <div style="flex:1">
                <div style="display:flex;gap:10px;align-items:center">
                  <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                       style="width:50px;height:50px;border-radius:10px;object-fit:cover;border:2px solid rgba(255,68,68,0.3);">
                  <div style="flex:1">
                    <strong style="color:#fff">${escapeHtml(org.name || org.id)}</strong>
                    <div class="subtext" style="margin-top:2px">ID: ${org.id}</div>
                    <div class="subtext" style="margin-top:4px">
                      <i class="fas fa-times-circle"></i> <span data-i18n="rejected_by">Rejected:</span> ${rejectedDate.toLocaleDateString()} by ${org.approval?.rejectedBy || 'SuperAdmin'}
                    </div>
                    ${org.approval?.rejectionReason ? `
                      <div class="subtext" style="margin-top:2px;color:#ff9999">
                        <i class="fas fa-exclamation-circle"></i> ${org.approval.rejectionReason}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:nowrap">
                <span class="badge danger" style="white-space:nowrap">
                  <i class="fas fa-times"></i> Rejected
                </span>
                <button class="btn neon-btn" onclick="window.reconsiderApproval('${org.id}', '${escapeHtml(org.name || org.id)}')" style="white-space:nowrap">
                  <i class="fas fa-redo"></i> Reconsider
                </button>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      }
    }
    
    el.innerHTML = html;
    applyTranslations();
  } catch(e) { 
    console.error(e); 
    renderError("superApprovalList", "Error loading approval requests", "window.loadSuperApprovals()");
  }
}

/**
 * Approve election
 * PERMISSION REQUIRED: approve_elections (Super Admin only)
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name (optional)
 */
export async function approveElection(orgId, orgName = null) {
  if (!orgId) return;
  
  // ✅ PERMISSION GUARD: Super Admin only
  const currentUser = window.currentAdmin || window.currentSuperAdmin;
  const hasPermission = currentUser?.role === 'super_admin' || 
                        (typeof window.adminHasPermission === 'function' && 
                         window.adminHasPermission('approve_elections'));
  
  if (!hasPermission) {
    showToast('❌ You do not have permission to approve elections', 'error');
    return;
  }
  
  const orgNameText = orgName ? ` "${orgName}"` : '';
  
  // Create approval confirmation modal
  const modalHtml = `
    <div id="approvalModal" class="modal-overlay" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;align-items:center;justify-content:center">
      <div class="modal-content" style="background:#0a0e27;border-radius:12px;padding:30px;max-width:500px;width:90%;border:2px solid #00ffaa">
        <h3 style="color:#00ffaa;margin-bottom:15px">
          <i class="fas fa-check-circle"></i> Approve Election
        </h3>
        <p style="margin-bottom:10px">
          You are about to approve election for:
        </p>
        <p style="font-weight:bold;color:#00eaff;margin-bottom:10px">
          ${orgNameText.replace(/^"/, '').replace(/"$/, '')}
        </p>
        <p class="subtext" style="margin-bottom:20px">
          <i class="fas fa-info-circle"></i> This will unlock voting and allow voters to cast their ballots.
        </p>
        <div style="margin-bottom:20px">
          <label class="label">Optional Comments</label>
          <textarea id="approvalComments" class="input" rows="3" placeholder="Add any comments for the EC (optional)..." style="resize:vertical"></textarea>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn neon-btn-lg" onclick="window.confirmApproval('${orgId}')" style="flex:1">
            <i class="fas fa-check"></i> Confirm Approval
          </button>
          <button class="btn neon-btn-outline" onclick="document.getElementById('approvalModal').remove()" style="flex:1">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Confirm approval (called from modal)
 */
window.confirmApproval = async function(orgId) {
  const comments = document.getElementById('approvalComments')?.value?.trim() || '';
  document.getElementById('approvalModal')?.remove();
  
  try {
    const currentUser = window.currentAdmin || window.currentSuperAdmin;
    // Get existing approval data to preserve it
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    const orgData = orgSnap.data();
    const existingApproval = orgData?.approval || {};
    const existingHistory = existingApproval.history || [];
    
    // Append approval to history
    const approvalEntry = {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser?.email || 'superadmin'
    };
    
    // ✅ PATCH: unlock voting on approval
    await updateDoc(orgRef, {
      approval: {
        ...existingApproval,
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: 'superadmin',
        comments: comments || '',
        history: [...existingHistory, approvalEntry]
      },
      electionStatus: 'active',
      updatedAt: serverTimestamp()
    });
    
    // ✅ PATCH: activity + audit logging
    const orgName = orgSnap.data()?.name || orgId;
    await logActivity({
      type: 'approval_approved',
      message: `Election approved for "${orgName}" - voting unlocked`,
      orgId,
      actor: 'Super Admin',
      role: 'superadmin'
    });
    
    await logAudit({
      action: 'APPROVAL_APPROVED',
      orgId,
      actor: 'Super Admin',
      role: 'superadmin',
      before: { approval: 'pending', electionStatus: existingApproval.status || 'draft' },
      after: { approval: 'approved', electionStatus: 'active' }
    });
    
    showToast(`Election "${orgName}" approved successfully! ✅`, "success");
    loadSuperOrganizationsEnhanced();
    loadSuperApprovals();
  } catch (e) {
    console.error("Approval error:", e);
    showToast("Approval failed: " + (e?.message || e), "error");
  }
};

/**
 * Reject election
 * PERMISSION REQUIRED: reject_elections (Super Admin only)
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name (optional)
 */
export async function rejectElection(orgId, orgName = null) {
  if (!orgId) return;
  
  // ✅ PERMISSION GUARD: Super Admin only
  const currentUser = window.currentAdmin || window.currentSuperAdmin;
  const hasPermission = currentUser?.role === 'super_admin' || 
                        (typeof window.adminHasPermission === 'function' && 
                         window.adminHasPermission('reject_elections'));
  
  if (!hasPermission) {
    showToast('❌ You do not have permission to reject elections', 'error');
    return;
  }
  
  const orgNameText = orgName ? ` "${orgName}"` : '';
  
  // Create rejection modal with reason textarea
  const modalHtml = `
    <div id="rejectionModal" class="modal-overlay" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;align-items:center;justify-content:center">
      <div class="modal-content" style="background:#0a0e27;border-radius:12px;padding:30px;max-width:500px;width:90%;border:2px solid #ff6666">
        <h3 style="color:#ff6666;margin-bottom:15px">
          <i class="fas fa-times-circle"></i> Reject Election
        </h3>
        <p style="margin-bottom:10px">
          You are about to reject election for:
        </p>
        <p style="font-weight:bold;color:#00eaff;margin-bottom:10px">
          ${orgNameText.replace(/^"/, '').replace(/"$/, '')}
        </p>
        <p class="subtext" style="margin-bottom:20px">
          <i class="fas fa-info-circle"></i> Please provide a clear reason so the EC can fix the issues and resubmit.
        </p>
        <div style="margin-bottom:20px">
          <label class="label">Rejection Reason <span style="color:#ff6666">*</span></label>
          <textarea id="rejectionReason" class="input" rows="4" placeholder="Explain why this election is being rejected (minimum 5 characters)..." style="resize:vertical"></textarea>
          <div class="subtext" style="margin-top:5px">
            <i class="fas fa-exclamation-triangle"></i> The EC will receive this feedback
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn neon-btn-lg" onclick="window.confirmRejection('${orgId}')" style="flex:1;background:#ff4444;border-color:#ff6666">
            <i class="fas fa-times"></i> Confirm Rejection
          </button>
          <button class="btn neon-btn-outline" onclick="document.getElementById('rejectionModal').remove()" style="flex:1">
            <i class="fas fa-undo"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  // Focus on textarea
  setTimeout(() => document.getElementById('rejectionReason')?.focus(), 100);
}

/**
 * Confirm rejection (called from modal)
 */
window.confirmRejection = async function(orgId) {
  const reason = document.getElementById('rejectionReason')?.value?.trim() || '';
  
  // ✅ Validation - minimum 5 characters
  if (!reason) {
    showToast("Please provide a rejection reason", "error");
    return;
  }
  
  if (reason.length < 5) {
    showToast("Rejection reason must be at least 5 characters. Please provide meaningful feedback.", "error");
    return;
  }
  
  document.getElementById('rejectionModal')?.remove();
  
  try {
    const currentUser = window.currentAdmin || window.currentSuperAdmin;
    // Get existing approval data to preserve it
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    const existingApproval = orgSnap.data()?.approval || {};
    const existingHistory = existingApproval.history || [];
    const orgName = orgSnap.data()?.name || orgId;
    
    // Append rejection to history
    const rejectionEntry = {
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser?.email || 'superadmin',
      reason: reason
    };
    
    // ✅ PATCH: unlock election for editing after rejection
    await updateDoc(orgRef, {
      approval: {
        ...existingApproval,  // ✅ PRESERVE requestedAt, requestedBy, organizationName
        status: "rejected",
        rejectedAt: serverTimestamp(),
        rejectedBy: "superadmin",
        rejectionReason: reason,
        comment: reason, // Store in both fields for consistency
        history: [...existingHistory, rejectionEntry]
      },
      electionStatus: 'draft',
      updatedAt: serverTimestamp()
    });
    
    // ✅ PATCH: activity + audit logging
    await logActivity({
      type: 'approval_rejected',
      message: `Election rejected for "${orgName}" - reason: ${reason}`,
      orgId,
      actor: 'Super Admin',
      role: 'superadmin'
    });
    
    await logAudit({
      action: 'APPROVAL_REJECTED',
      orgId,
      actor: 'Super Admin',
      role: 'superadmin',
      before: { approval: 'pending' },
      after: { approval: 'rejected', reason: reason }
    });
    
    // ✅ Send email notification to EC
    try {
      const ecEmail = orgSnap.data()?.ecEmail;
      if (ecEmail) {
        await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationType: 'election_rejected',
            recipientEmail: ecEmail,
            recipientName: orgSnap.data()?.ecName || 'Election Commissioner',
            orgId: orgId,
            orgName: orgName,
            variables: {
              rejectionReason: reason
            },
            channels: ['email']
          })
        });
        console.log('✅ Rejection notification sent to EC:', ecEmail);
      }
    } catch (notifyErr) {
      console.warn('Failed to send rejection email to EC:', notifyErr.message);
      // Don't fail the rejection if email fails
    }
    
    showToast(`Election "${orgName}" rejected`, "success");
    loadSuperOrganizationsEnhanced();
    loadSuperApprovals();
  } catch (e) {
    console.error("Rejection error:", e);
    showToast("Rejection failed: " + e.message, "error");
  }
};

/**
 * Revoke approval
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name (optional)
 */
export async function revokeApproval(orgId, orgName = null) {
  if (!orgId) return;
  
  const orgNameText = orgName ? ` "${orgName}"` : '';
  
  if (!confirm(`Revoke approval for election${orgNameText}? This will lock voting.`)) return;
  
  try {
    // Get existing approval data to preserve it
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    const existingApproval = orgSnap.data()?.approval || {};
    
    await updateDoc(orgRef, {
      approval: {
        ...existingApproval,  // ✅ PRESERVE requestedAt, requestedBy, organizationName
        status: "pending",
        revokedAt: serverTimestamp(),
        revokedBy: "superadmin"
      }
    });
    
    showToast(`Approval revoked for election${orgNameText}`, "success");
    loadSuperOrganizationsEnhanced();
    loadSuperApprovals();
  } catch (e) {
    console.error("Revoke error:", e);
    showToast("Revoke failed: " + e.message, "error");
  }
}

/**
 * Reconsider approval (reset to pending)
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name (optional)
 */
export async function reconsiderApproval(orgId, orgName = null) {
  if (!orgId) return;
  
  const orgNameText = orgName ? ` "${orgName}"` : '';
  
  if (!confirm(`Reconsider election${orgNameText}? This will reset to pending status.`)) return;
  
  try {
    // Get existing approval data to preserve it
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    const existingApproval = orgSnap.data()?.approval || {};
    
    await updateDoc(orgRef, {
      approval: {
        ...existingApproval,  // ✅ PRESERVE requestedAt, requestedBy, organizationName
        status: "pending",
        reconsideredAt: serverTimestamp(),
        reconsideredBy: "superadmin"
      }
    });
    
    showToast(`Election${orgNameText} reset to pending`, "success");
    loadSuperOrganizationsEnhanced();
    loadSuperApprovals();
  } catch (e) {
    console.error("Reconsider error:", e);
    showToast("Reconsider failed: " + e.message, "error");
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadSuperApprovals = loadSuperApprovals;
  window.approveElection = approveElection;
  window.rejectElection = rejectElection;
  window.revokeApproval = revokeApproval;
  window.reconsiderApproval = reconsiderApproval;
}
