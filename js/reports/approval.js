// approval.js - Election Approval Workflow
import { db } from '../config/firebase.js';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showQuickLoading, showToast, renderError } from '../utils/ui-helpers.js';
import { logActivity, logAudit } from '../utils/activity.js';

/**
 * ✅ Validate all election requirements
 * Returns object with validation results
 */
async function validateElectionRequirements() {
  try {
    const [votersSnap, positionsSnap, candidatesSnap] = await Promise.all([
      getDocs(collection(db, "organizations", window.currentOrgId, "voters")),
      getDocs(collection(db, "organizations", window.currentOrgId, "positions")),
      getDocs(collection(db, "organizations", window.currentOrgId, "candidates"))
    ]);
    
    const activeVoters = votersSnap.docs.filter(doc => {
      const data = doc.data();
      return !data.isReplaced && data.isActive !== false;
    });
    
    const positions = positionsSnap.docs;
    const candidates = candidatesSnap.docs;
    
    const hasVoters = activeVoters.length > 0;
    const hasPositions = positions.length > 0;
    
    let allPositionsHaveCandidates = true;
    if (hasPositions) {
      for (const position of positions) {
        const positionCandidates = candidates.filter(c => c.data().positionId === position.id);
        if (positionCandidates.length === 0) {
          allPositionsHaveCandidates = false;
          break;
        }
      }
    } else {
      allPositionsHaveCandidates = false;
    }
    
    const org = window.currentOrgData;
    const hasSchedule = org.electionSettings?.startTime ? true : false;
    
    const requirements = [
      { name: 'Voters', met: hasVoters, count: activeVoters.length },
      { name: 'Positions', met: hasPositions, count: positions.length },
      { name: 'Candidates', met: allPositionsHaveCandidates, count: candidates.length },
      { name: 'Schedule', met: hasSchedule, count: hasSchedule ? 1 : 0 }
    ];
    
    const allMet = requirements.every(r => r.met);
    const metCount = requirements.filter(r => r.met).length;
    
    return { allMet, metCount, total: requirements.length, requirements };
  } catch(e) {
    console.error('Validation error:', e);
    return { allMet: false, metCount: 0, total: 4, requirements: [] };
  }
}

export async function loadECApproval() {
  const el = document.getElementById("ecContent-approval");
  if (!el || !window.currentOrgId || !window.currentOrgData) return;
  
  showQuickLoading("ecContent-approval", t('loading_approval_status'));
  
  try {
    // Get current organization data
    const orgRef = doc(db, "organizations", window.currentOrgId);
    const orgSnap = await getDoc(orgRef);
    const org = orgSnap.data();
    
    // Get counts for requirements
    const [votersSnap, positionsSnap, candidatesSnap] = await Promise.all([
      getDocs(collection(db, "organizations", window.currentOrgId, "voters")),
      getDocs(collection(db, "organizations", window.currentOrgId, "positions")),
      getDocs(collection(db, "organizations", window.currentOrgId, "candidates"))
    ]);
    
    const activeVoters = votersSnap.docs.filter(doc => {
      const data = doc.data();
      return !data.isReplaced && !data.isActive === false;
    });
    
    const positions = positionsSnap.docs;
    const candidates = candidatesSnap.docs;
    
    // Check requirements
    const hasVoters = activeVoters.length > 0;
    const hasPositions = positions.length > 0;
    
    // Check if all positions have at least one candidate
    let allPositionsHaveCandidates = true;
    if (hasPositions) {
      for (const position of positions) {
        const positionCandidates = candidates.filter(candidate => candidate.data().positionId === position.id);
        if (positionCandidates.length === 0) {
          allPositionsHaveCandidates = false;
          break;
        }
      }
    } else {
      allPositionsHaveCandidates = false;
    }
    
    const hasSchedule = org.electionSettings?.startTime ? true : false;
    
    // Get translation function
    const t = window.t || ((key) => key);
    
    // Get current approval status
    const approvalStatus = org.approval?.status || 'not_submitted';
    const submittedDate = org.approval?.requestedAt 
      ? (org.approval.requestedAt.toDate ? org.approval.requestedAt.toDate() : (org.approval.requestedAt.seconds ? new Date(org.approval.requestedAt.seconds * 1000) : new Date(org.approval.requestedAt)))
      : null;
    const reviewedBy = org.approval?.reviewedBy || null;
    const approvalComments = org.approval?.comments || null;
    const rejectionReason = org.approval?.rejectionReason || null;
    
    let html = `
      <div style="margin-bottom:20px">
        <h3><i class="fas fa-clipboard-check"></i> ${t('election_approval')}</h3>
        <p class="subtext">Submit your election setup for SuperAdmin approval before voters can start voting.</p>
      </div>
      
      <div class="card" style="margin-bottom:20px">
        <h4 style="color:#00eaff;margin-bottom:15px">
          <i class="fas fa-info-circle"></i> ${t('current_approval_status')}
        </h4>
        
        <div style="display:flex;align-items:center;gap:15px;margin-bottom:20px">
          <div id="approvalBadge" class="badge ${approvalStatus === 'approved' ? 'success' : 
                                           approvalStatus === 'rejected' ? 'danger' : 
                                           approvalStatus === 'pending' ? 'warning' : 'info'}">
            ${approvalStatus === 'approved' ? 'Approved' : 
              approvalStatus === 'rejected' ? 'Rejected' : 
              approvalStatus === 'pending' ? 'Pending Review' : 'Not Submitted'}
          </div>
          
          <div style="flex:1">
            <div style="display:flex;gap:20px">
              <div>
                <div class="label">Status</div>
                <div id="currentApprovalStatus" style="font-weight:bold">
                  ${approvalStatus === 'approved' ? '✅ Approved' : 
                    approvalStatus === 'rejected' ? '❌ Rejected' : 
                    approvalStatus === 'pending' ? '⏳ Under Review' : 'Not Submitted'}
                </div>
              </div>
              ${submittedDate ? `
                <div>
                  <div class="label">Submitted</div>
                  <div id="submittedDate">${submittedDate.toLocaleDateString()}</div>
                </div>
              ` : ''}
              ${reviewedBy ? `
                <div>
                  <div class="label">Reviewed By</div>
                  <div id="reviewedBy">${reviewedBy}</div>
                </div>
              ` : ''}
            </div>
            
            ${approvalComments ? `
              <div style="margin-top:10px;padding:10px;background:rgba(0,255,170,0.05);border-radius:8px;border-left:3px solid #00ffaa;">
                <div class="label">Approval Comments</div>
                <div id="approvalComments">${approvalComments}</div>
              </div>
            ` : ''}
            
            ${rejectionReason ? `
              <div style="margin-top:10px;padding:10px;background:rgba(255,68,68,0.05);border-radius:8px;border-left:3px solid #ff4444;">
                <div class="label">Rejection Reason</div>
                <div id="approvalComments">${rejectionReason}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="card" style="margin-bottom:20px">
        <h4 style="color:#00eaff;margin-bottom:15px">
          <i class="fas fa-list-check"></i> ${t('approval_requirements')}
        </h4>
        
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="requirement-item ${hasVoters ? 'requirement-met' : 'requirement-pending'}" id="reqVoters">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="requirement-checkbox ${hasVoters ? 'checked' : ''}">
                ${hasVoters ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div>
                <div style="font-weight:bold">${t('add_voters')}</div>
                <div class="subtext">${t('at_least_one')} active voter ${t('required')}</div>
                <div class="subtext">${t('current')}: ${activeVoters.length} active voters</div>
              </div>
            </div>
            <div>
              ${hasVoters ? 
                `<span class="badge success"><i class="fas fa-check"></i> ${t('complete')}</span>` : 
                `<button class="btn neon-btn-outline" onclick="showAddVoterModal()">${t('add_voters')}</button>`
              }
            </div>
          </div>
          
          <div class="requirement-item ${hasPositions ? 'requirement-met' : 'requirement-pending'}" id="reqPositions">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="requirement-checkbox ${hasPositions ? 'checked' : ''}">
                ${hasPositions ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div>
                <div style="font-weight:bold">${t('create_positions')}</div>
                <div class="subtext">${t('at_least_one')} ${t('position')} ${t('required')}</div>
                <div class="subtext">${t('current')}: ${positions.length} positions</div>
              </div>
            </div>
            <div>
              ${hasPositions ? 
                `<span class="badge success"><i class="fas fa-check"></i> ${t('complete')}</span>` : 
                `<button class="btn neon-btn-outline" onclick="showAddPositionModal()">${t('create_positions')}</button>`
              }
            </div>
          </div>
          
          <div class="requirement-item ${allPositionsHaveCandidates ? 'requirement-met' : 'requirement-pending'}" id="reqCandidates">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="requirement-checkbox ${allPositionsHaveCandidates ? 'checked' : ''}">
                ${allPositionsHaveCandidates ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div>
                <div style="font-weight:bold">${t('add_candidates')}</div>
                <div class="subtext">${t('all_positions_must_have')} ${t('candidate')}</div>
                <div class="subtext">${t('current')}: ${candidates.length} candidates</div>
              </div>
            </div>
            <div>
              ${allPositionsHaveCandidates ? 
                `<span class="badge success"><i class="fas fa-check"></i> ${t('complete')}</span>` : 
                `<button class="btn neon-btn-outline" onclick="showAddCandidateModal()">${t('add_candidates')}</button>`
              }
            </div>
          </div>
          
          <div class="requirement-item ${hasSchedule ? 'requirement-met' : 'requirement-pending'}" id="reqSchedule">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="requirement-checkbox ${hasSchedule ? 'checked' : ''}">
                ${hasSchedule ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div>
                <div style="font-weight:bold">${t('set_election_schedule')}</div>
                <div class="subtext">${t('define_start_end_times')}</div>
                <div class="subtext">${hasSchedule ? t('schedule_set') : t('no_schedule_set')}</div>
              </div>
            </div>
            <div>
              ${hasSchedule ? 
                `<span class="badge success"><i class="fas fa-check"></i> ${t('complete')}</span>` : 
                `<button class="btn neon-btn-outline" onclick="showScreen('ecPanel'); showECTab('settings')">${t('set_schedule')}</button>`
              }
            </div>
          </div>
        </div>
        
        <div style="margin-top:20px;padding:15px;background:rgba(0,255,255,0.05);border-radius:8px;border:1px solid rgba(0,255,255,0.1);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="color:#00eaff;font-size:14px">
              <i class="fas fa-lightbulb"></i> ${t('all_requirements_must_be_met')}
            </div>
            <button class="btn neon-btn-outline" onclick="loadECApproval()" style="padding:6px 12px;font-size:12px">
              <i class="fas fa-sync"></i> ${t('refresh_check')}
            </button>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="flex:1;background:rgba(255,255,255,0.05);height:8px;border-radius:4px;overflow:hidden">
              <div style="width:${(hasVoters + hasPositions + allPositionsHaveCandidates + hasSchedule) * 25}%;background:linear-gradient(90deg,#00eaff,#00ffaa);height:100%;transition:width 0.3s ease"></div>
            </div>
            <div style="color:#00eaff;font-weight:bold;font-size:14px">
              ${hasVoters + hasPositions + allPositionsHaveCandidates + hasSchedule}/4
            </div>
          </div>
          <div class="subtext">
            ${t('once_submitted_superadmin')}
          </div>
        </div>
      </div>
    `;
    
    // Check if all requirements are met
    const allRequirementsMet = hasVoters && hasPositions && allPositionsHaveCandidates && hasSchedule;
    
    // Add submission button
    if (approvalStatus === 'not_submitted') {
      const remainingCount = 4 - (hasVoters + hasPositions + allPositionsHaveCandidates + hasSchedule);
      html += `
        <div class="card" style="text-align:center;">
          <button id="finalSubmitBtn" class="btn neon-btn-lg" 
                  onclick="submitForApprovalFinal()" 
                  ${allRequirementsMet ? '' : 'disabled'}
                  style="width:100%;padding:15px;font-size:16px;cursor:${allRequirementsMet ? 'pointer' : 'not-allowed'};opacity:${allRequirementsMet ? '1' : '0.5'}">
            <i class="fas fa-paper-plane"></i> ${t('submit_for_superadmin_approval')}
          </button>
          ${!allRequirementsMet ? `
            <div style="margin-top:15px;padding:12px;background:rgba(255,193,7,0.1);border-radius:8px;border:1px solid rgba(255,193,7,0.3)">
              <div style="color:#ffc107;font-weight:bold;margin-bottom:5px">
                <i class="fas fa-exclamation-triangle"></i> ${t('requirements_not_met')}
              </div>
              <div class="subtext">
                ${t('complete_remaining_requirements').replace('{count}', remainingCount)}
              </div>
            </div>
          ` : `
            <div style="margin-top:15px;padding:12px;background:rgba(0,255,170,0.1);border-radius:8px;border:1px solid rgba(0,255,170,0.3)">
              <div style="color:#00ffaa;font-weight:bold;margin-bottom:5px">
                <i class="fas fa-check-circle"></i> ${t('all_requirements_complete')}
              </div>
              <div class="subtext">
                ${t('election_ready_for_submission')}
              </div>
            </div>
          `}
        </div>
      `;
    } else if (approvalStatus === 'pending') {
      html += `
        <div class="card" style="text-align:center;border:2px solid rgba(255,193,7,0.3);background:rgba(255,193,7,0.05);">
          <h4 style="color:#ffc107;margin-bottom:10px">
            <i class="fas fa-hourglass-half"></i> ${t('under_review')}
          </h4>
          <p class="subtext">
            ${t('election_under_review')}
          </p>
          <button class="btn neon-btn-outline" onclick="loadECApproval()" style="margin-top:10px">
            <i class="fas fa-redo"></i> ${t('refresh_status')}
          </button>
        </div>
      `;
    } else if (approvalStatus === 'approved') {
      html += `
        <div class="card" style="text-align:center;border:2px solid rgba(0,255,170,0.3);background:rgba(0,255,170,0.05);">
          <h4 style="color:#00ffaa;margin-bottom:10px">
            <i class="fas fa-check-circle"></i> ${t('approval_granted')}
          </h4>
          <p class="subtext">
            ${t('election_approved_voters_can_vote')}
          </p>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:15px">
            <button class="btn neon-btn" onclick="showScreen('voterLoginScreen')">
              <i class="fas fa-vote-yea"></i> ${t('test_voter_login')}
            </button>
            <button class="btn neon-btn-outline" onclick="showECTab('settings')">
              <i class="fas fa-cog"></i> ${t('election_settings')}
            </button>
          </div>
        </div>
      `;
    } else if (approvalStatus === 'rejected') {
      html += `
        <div class="card" style="text-align:center;border:2px solid rgba(255,68,68,0.3);background:rgba(255,68,68,0.05);">
          <h4 style="color:#ff4444;margin-bottom:10px">
            <i class="fas fa-times-circle"></i> Approval Rejected
          </h4>
          <p class="subtext">
            Your election submission was rejected. Please review the feedback and resubmit.
          </p>
          ${rejectionReason ? `
            <div style="margin:15px 0;padding:10px;background:rgba(255,68,68,0.1);border-radius:8px;">
              <div class="label" style="color:#ff4444">Rejection Reason:</div>
              <div>${rejectionReason}</div>
            </div>
          ` : ''}
          <button class="btn neon-btn" onclick="resubmitForApproval()" style="margin-top:10px">
            <i class="fas fa-redo"></i> Resubmit for Approval
          </button>
        </div>
      `;
    }
    
    el.innerHTML = html;
    
  } catch(e) {
    console.error("Error loading approval:", e);
    renderError("ecContent-approval", "Error loading approval status: " + e.message, "loadECApproval()");
  }
}

export async function submitForApprovalFinal() {
  if (!window.currentOrgId || !window.currentOrgData) {
    showToast("No organization loaded", "error");
    return;
  }
  
  // ✅ GUARD: Prevent submission if already pending or approved
  const currentStatus = window.currentOrgData.approval?.status;
  if (currentStatus === 'pending') {
    showToast("Election is already under review.", "warning");
    return;
  }
  if (currentStatus === 'approved') {
    showToast("Election is already approved.", "warning");
    return;
  }
  
  // ✅ PATCH: Validate all requirements before submission
  const validation = await validateElectionRequirements();
  if (!validation.allMet) {
    const missing = validation.requirements.filter(r => !r.met).map(r => r.name).join(', ');
    showToast(`Cannot submit: Missing requirements - ${missing}`, "error");
    return;
  }
  
  try {
    // ✅ PATCH 1: Set status to 'locked' to prevent editing during review
    await updateDoc(doc(db, "organizations", window.currentOrgId), {
      electionStatus: 'locked',
      approval: {
        status: "pending",
        requestedAt: serverTimestamp(),
        requestedBy: "ec",
        submittedBy: "EC",
        submittedAt: serverTimestamp(),
        organizationName: window.currentOrgData.name || window.currentOrgId,
        comment: ""
      },
      updatedAt: serverTimestamp()
    });
    
    // ✅ PATCH 7: Activity + audit logging (EC submit)
    await logActivity({
      type: 'approval_submit',
      message: `Election submitted for approval: "${window.currentOrgData.name || window.currentOrgId}"`,
      orgId: window.currentOrgId,
      actor: 'EC',
      role: 'ec'
    });
    
    await logAudit({
      action: 'EC_SUBMIT_APPROVAL',
      orgId: window.currentOrgId,
      actor: 'EC',
      role: 'ec',
      before: { approval: currentStatus || 'draft', electionStatus: window.currentOrgData.electionStatus },
      after: { approval: 'pending', electionStatus: 'locked' }
    });
    
    showToast("Election submitted for approval! Editing is now locked. ✅", "success");
    loadECApproval();
  } catch (e) {
    console.error("Submit for approval error:", e);
    showToast("Submission failed: " + e.message, "error");
  }
}

export async function resubmitForApproval() {
  if (!window.currentOrgId || !window.currentOrgData) {
    showToast("No organization loaded", "error");
    return;
  }
  
  // ✅ PATCH 5: Guard - only allow resubmit if rejected or draft
  const currentStatus = window.currentOrgData.approval?.status;
  if (currentStatus !== 'rejected' && currentStatus !== 'draft' && !currentStatus) {
    showToast("Election cannot be resubmitted at this stage.", "error");
    return;
  }
  
  if (!confirm("Resubmit this election for SuperAdmin approval?")) return;
  
  try {
    await updateDoc(doc(db, "organizations", window.currentOrgId), {
      electionStatus: 'locked',
      approval: {
        status: "pending",
        requestedAt: serverTimestamp(),
        requestedBy: "ec",
        submittedBy: "EC",
        submittedAt: serverTimestamp(),
        organizationName: window.currentOrgData.name || window.currentOrgId,
        resubmitted: true,
        previousStatus: currentStatus,
        comment: ""
      },
      updatedAt: serverTimestamp()
    });
    
    // ✅ PATCH 7: Audit logging for resubmit
    await logActivity({
      type: 'approval_resubmit',
      message: `Election resubmitted for approval: "${window.currentOrgData.name || window.currentOrgId}"`,
      orgId: window.currentOrgId,
      actor: 'EC',
      role: 'ec'
    });
    
    await logAudit({
      action: 'EC_RESUBMIT_APPROVAL',
      orgId: window.currentOrgId,
      actor: 'EC',
      role: 'ec',
      before: { approval: currentStatus, electionStatus: window.currentOrgData.electionStatus },
      after: { approval: 'pending', electionStatus: 'locked', resubmitted: true }
    });
    
    showToast("Election resubmitted for approval! Editing is now locked. ✅", "success");
    loadECApproval();
  } catch (e) {
    console.error("Resubmit error:", e);
    showToast("Resubmit failed: " + e.message, "error");
  }
}
