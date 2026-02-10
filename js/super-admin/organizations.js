/**
 * Super Admin Module - Organizations
 * Handles organization CRUD operations
 */

import { db, storage } from '../config/firebase.js';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { 
  ref as storageRef, 
  uploadString, 
  getDownloadURL, 
  deleteObject 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';
import { loadSuperApprovals } from './approvals.js';
import { logActivity, logAudit } from '../utils/activity.js';
import { sendECInviteEmail } from './helpers.js';
import { escapeHtml } from '../utils/validation.js';

/**
 * Load and display all organizations for Super Admin
 */
export async function loadSuperOrganizationsEnhanced() {
  const el = document.getElementById("superContent-orgs");
  if (!el) return;
  
  showQuickLoading("superContent-orgs", "Loading Organizations");
  
  try {
    const snaps = await getDocs(collection(db, "organizations"));
    const orgs = []; 
    snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    
    if (orgs.length === 0) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-building" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Organizations Yet</h3>
          <p class="subtext">Create your first organization in the Settings tab</p>
          <button class="btn neon-btn mt-20" onclick="window.showCreateOrgModal()">
            <i class="fas fa-plus"></i> Create First Organization
          </button>
        </div>
      `;
      return;
    }
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-building"></i> Organizations (${orgs.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="window.showCreateOrgModal()">
            <i class="fas fa-plus"></i> Create New
          </button>
          <button class="btn neon-btn-outline" onclick="window.loadSuperOrganizationsEnhanced()">
            <i class="fas fa-redo"></i> Refresh
          </button>
        </div>
      </div>
      <div class="org-list">
    `;
    
    orgs.forEach(org => {
      const voterCount = org.voterCount || 0;
      const voteCount = org.voteCount || 0;
      const status = org.electionStatus || 'active';
      const logoUrl = org.logoUrl || getDefaultLogo(org.name);
      
      // ✅ PATCH: Display election type badge
      const electionTypeLabel = {
        single_winner: 'Single Winner',
        multiple_winner: 'Multiple Winners',
        referendum: 'Referendum',
        custom: 'Custom'
      }[org.electionType] || 'Not Set';
      
      const statusConfig = {
        'active': { color: '#00ffaa', label: 'Active', icon: 'fa-play-circle' },
        'scheduled': { color: '#ffc107', label: 'Scheduled', icon: 'fa-clock' },
        'declared': { color: '#9D00FF', label: 'Results Declared', icon: 'fa-flag-checkered' },
        'ended': { color: '#888', label: 'Ended', icon: 'fa-stop-circle' }
      }[status] || { color: '#888', label: status, icon: 'fa-question-circle' };
      
      let scheduleInfo = '';
      if (org.electionSettings?.startTime) {
        const startTime = new Date(org.electionSettings.startTime);
        const now = new Date();
        if (startTime > now) {
          const timeDiff = startTime - now;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          scheduleInfo = `Starts in ${hours}h ${minutes}m`;
        } else if (org.electionSettings?.endTime && new Date(org.electionSettings.endTime) > now) {
          scheduleInfo = 'Voting in progress';
        } else if (org.electionSettings?.endTime && new Date(org.electionSettings.endTime) <= now) {
          scheduleInfo = 'Voting ended';
        }
      }
      
      // Approval badge
      const approvalStatus = org.approval?.status || 'pending';
      const approvalBadge = approvalStatus === 'approved' ? 
        '<span style="font-size:12px;padding:4px 10px;border-radius:20px;background:rgba(0,255,170,0.12);color:#00ffaa;border:1px solid rgba(0,255,170,0.25);display:inline-flex;align-items:center;gap:6px"><i class="fas fa-check-circle"></i> Approved</span>' :
        `<span style="font-size:12px;padding:4px 10px;border-radius:20px;background:rgba(255,193,7,0.12);color:#ffc107;border:1px solid rgba(255,193,7,0.25);display:inline-flex;align-items:center;gap:6px"><i class="fas fa-hourglass-half"></i> Pending</span>
         <button class="btn neon-btn" style="padding:6px 10px;font-size:12px;margin-left:8px" onclick="window.approveElection('${org.id}')"><i class="fas fa-stamp"></i> Approve</button>`;
      
      html += `
        <div class="org-card card">
          <!-- HEADER -->
          <div class="org-card-header" style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
            <img src="${logoUrl}" 
                 style="width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid rgba(0,255,255,0.2);background:#08102a;">
            <div class="org-title" style="flex:1">
              <strong style="font-size:16px;color:#fff;display:block;margin-bottom:4px">${org.name || org.id}</strong>
              <div class="subtext" style="font-size:11px">ID: ${org.id}</div>
            </div>

            <div class="org-badges" style="display:flex;gap:8px">
              ${approvalBadge}
              <span class="badge ${statusConfig.label.toLowerCase()}" style="white-space:nowrap">
                <i class="fas ${statusConfig.icon}"></i> ${statusConfig.label}
              </span>
            </div>
          </div>

          <!-- META -->
          <div class="org-meta" style="display:flex;gap:16px;font-size:13px;opacity:.85;margin-bottom:14px">
            <span><i class="fas fa-users"></i> ${voterCount} voters</span>
            <span><i class="fas fa-check-circle"></i> ${voteCount} votes</span>
            <span><i class="fas fa-vote-yea"></i> ${electionTypeLabel}</span>
            ${scheduleInfo ? `<span><i class="fas fa-clock"></i> ${scheduleInfo}</span>` : ''}
          </div>

          <!-- ACTIONS -->
          <div class="org-actions" style="display:flex;gap:8px">
            <button class="btn neon-btn" onclick="window.openOrgAsEC('${org.id}')" style="flex:1">
              <i class="fas fa-user-tie"></i> Enter EC Panel
            </button>
            <button class="btn neon-btn-outline" onclick="window.editOrganizationModal('${org.id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn neon-btn-outline" onclick="window.showECInviteModal('${org.id}', '${escapeHtml(org.name || org.id)}', '${org.ecPassword || ''}')" title="Invite">
              <i class="fas fa-envelope"></i>
            </button>
            <button class="btn neon-btn-outline" onclick="window.showPasswordModal('${org.id}', '${org.ecPassword || ''}')" title="Password"> 
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-danger" onclick="window.deleteOrganizationConfirm('${org.id}', '${escapeHtml(org.name || org.id)}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
    el.innerHTML = html;
  } catch(e) { 
    console.error(e); 
    renderError("superContent-orgs", "Error loading organizations", "window.loadSuperOrganizationsEnhanced()");
  }
}

/**
 * Load delete tab with organization list
 */
export async function loadSuperDeleteEnhanced() {
  const el = document.getElementById("superContent-delete");
  if (!el) return;
  
  showQuickLoading("superContent-delete", "Loading Organizations for Deletion");
  
  try {
    const snaps = await getDocs(collection(db, "organizations"));
    const orgs = []; 
    snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    
    if (orgs.length === 0) {
      el.innerHTML = `
        <div class="card">
          <p class="subtext">No organizations to delete.</p>
        </div>
      `;
      return;
    }
    
    let html = `
      <div class="danger-zone" style="padding:20px;border-radius:16px;margin-bottom:20px;background:rgba(255,68,68,0.05);border:2px solid rgba(255,68,68,0.2);">
        <h3 style="color:#ff4444;margin-bottom:10px">
          <i class="fas fa-exclamation-triangle"></i> Organization Deletion Zone
        </h3>
        <p class="subtext" style="color:#ff9999;margin-bottom:15px">
          <strong>WARNING:</strong> Deleting an organization will permanently remove ALL data including:
        </p>
        <ul style="color:#ff9999;margin-left:20px;margin-bottom:15px">
          <li>All voter records and their voting history</li>
          <li>All positions and candidate information</li>
          <li>All votes cast and election results</li>
          <li>Organization settings, logos, and configurations</li>
          <li>All related Firebase Storage files (candidate photos, logos)</li>
        </ul>
        <p class="subtext" style="color:#ffcc80">
          <i class="fas fa-info-circle"></i> This action cannot be undone. Make sure you have backups if needed.
        </p>
      </div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
        <h3 style="margin:0"><i class="fas fa-trash"></i> Organizations (${orgs.length})</h3>
        <button class="btn neon-btn-outline" onclick="window.loadSuperDeleteEnhanced()">
          <i class="fas fa-redo"></i> Refresh
        </button>
      </div>
    `;
    
    orgs.forEach(org => {
      const voterCount = org.voterCount || 0;
      const voteCount = org.voteCount || 0;
      const date = org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'Unknown';
      const status = org.electionStatus || 'active';
      const statusColor = status === 'active' ? '#00ffaa' : 
                         status === 'scheduled' ? '#ffc107' : 
                         status === 'declared' ? '#9D00FF' : '#888';
      
      html += `
        <div class="list-item" style="border-left:4px solid #ff4444;align-items:center;margin-bottom:12px;background:rgba(255,68,68,0.03);">
          <div style="flex:1">
            <div style="display:flex;gap:10px;align-items:center">
              <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                   style="width:50px;height:50px;border-radius:10px;object-fit:cover;background:#08102a;border:2px solid rgba(255,68,68,0.3);">
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <strong style="color:#fff">${org.name || org.id}</strong>
                    <div class="subtext" style="margin-top:2px">
                      ID: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px">${org.id}</code>
                    </div>
                    <div style="display:flex;gap:15px;margin-top:4px">
                      <span class="subtext" style="color:#00eaff">${voterCount} voters</span>
                      <span class="subtext" style="color:#9beaff">${voteCount} votes</span>
                      <span class="subtext" style="color:${statusColor}">${status}</span>
                      <span class="subtext">Created: ${date}</span>
                    </div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:12px;color:#ff9999;margin-bottom:5px">
                      <i class="fas fa-database"></i> Will delete ${voterCount + voteCount} records
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-danger" onclick="window.deleteOrganizationSecure('${org.id}', '${escapeHtml(org.name || org.id)}', ${voterCount}, ${voteCount})" style="min-width:100px">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
    });
    
    // Add bulk delete option for empty/old organizations
    const oldOrgs = orgs.filter(org => {
      const created = org.createdAt ? new Date(org.createdAt) : new Date(0);
      const daysOld = (new Date() - created) / (1000 * 60 * 60 * 24);
      return (org.voterCount === 0 && org.voteCount === 0) || daysOld > 30;
    });
    
    if (oldOrgs.length > 0) {
      html += `
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid rgba(255,68,68,0.2);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
            <h4 style="color:#ff9800;margin:0">
              <i class="fas fa-clock"></i> Cleanup: ${oldOrgs.length} Inactive/Empty Organizations
            </h4>
            <button class="btn btn-warning" onclick="window.bulkDeleteEmptyOrganizations()">
              <i class="fas fa-broom"></i> Bulk Cleanup
            </button>
          </div>
          <p class="subtext" style="color:#ffcc80">
            These organizations have no voters/votes or are older than 30 days. Safe to delete.
          </p>
        </div>
      `;
    }
    
    el.innerHTML = html;
  } catch(e) { 
    console.error(e); 
    renderError("superContent-delete", "Error loading delete list", "window.loadSuperDeleteEnhanced()");
  }
}

/**
 * Show create organization modal
 */
export function showCreateOrgModal() {
  // Auto-generate EC password (similar to org ID generation)
  const autoPassword = 'EC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const modal = createModal(
    '<i class="fas fa-plus"></i> Create New Organization',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Organization Logo (Optional)</label>
          <div style="margin-bottom: 10px;">
            <div id="orgLogoPreview" style="width: 100px; height: 100px; border-radius: 8px; border: 2px dashed rgba(0,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px;">
              <i class="fas fa-building" style="font-size: 32px; color: #00eaff"></i>
            </div>
            <input type="file" id="orgLogoFile" accept="image/*" class="input" onchange="window.previewOrgLogo()">
          </div>
        </div>
        <div>
          <label class="label">Organization Name *</label>
          <input id="newOrgName" class="input" placeholder="Enter organization name" required>
        </div>
        
        <!-- ✅ PATCH: Election Type Selection -->
        <div>
          <label class="label">Election Type *</label>
          <select id="newOrgElectionType" class="input" required>
            <option value="">Select election type</option>
            <option value="single_winner">🏆 Single Winner (e.g. President)</option>
            <option value="multiple_winner">👥 Multiple Winners (e.g. Executives)</option>
            <option value="referendum">✓ Referendum / Yes–No Vote</option>
            <option value="custom">⚙️ Custom / Mixed</option>
          </select>
          <div class="subtext" style="margin-top:4px">
            <i class="fas fa-info-circle"></i> This determines how votes are counted and results declared.
          </div>
        </div>
        
        <!-- ✅ NEW: Credential Type Selection -->
        <div>
          <label class="label">Voter Credential Type *</label>
          <select id="newOrgCredentialType" class="input" required onchange="window.updateCredentialTypeHelp()">
            <option value="email_phone">📧 Email & Phone (Default)</option>
            <option value="student_id">🎓 Student ID (Schools/Universities)</option>
            <option value="staff_id">💼 Staff ID (Companies/Organizations)</option>
            <option value="member_id">👥 Member ID (Associations/Clubs)</option>
            <option value="national_id">🪪 National ID (Government Elections)</option>
            <option value="custom_pin">🔑 Custom PIN/Code</option>
          </select>
          <div id="credentialTypeHelp" class="subtext" style="margin-top:8px; padding:10px; background:rgba(0,255,255,0.05); border-left:3px solid var(--neon-cyan); border-radius:4px;">
            <i class="fas fa-info-circle"></i> <span id="credentialTypeHelpText">Voters will log in using email address or phone number</span>
          </div>
        </div>
        
        <div>
          <label class="label">Description (Optional)</label>
          <textarea id="newOrgDesc" class="input" placeholder="Organization description" rows="2"></textarea>
        </div>
        
        <div style="background:rgba(157,0,255,0.05);padding:15px;border-radius:8px;border:1px solid rgba(157,0,255,0.2)">
          <h4 style="margin:0 0 12px 0;color:var(--neon-purple)">
            <i class="fas fa-user-tie"></i> Election Commissioner Setup
          </h4>
          
          <div style="display:flex;flex-direction:column;gap:12px">
            <div>
              <label class="label">EC Name</label>
              <input id="newOrgECName" class="input" placeholder="Commissioner name" type="text">
            </div>
            
            <div>
              <label class="label">EC Password (Auto-Generated)</label>
              <div style="display:flex;gap:8px">
                <input id="newOrgECPass" class="input" value="${autoPassword}" readonly style="flex:1;background:rgba(0,234,255,0.05);font-family:monospace;font-weight:600">
                <button type="button" class="btn neon-btn-outline" onclick="navigator.clipboard.writeText(document.getElementById('newOrgECPass').value).then(() => window.showToast('Password copied!', 'success'))" style="padding:0 15px">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
              <div class="subtext" style="margin-top:4px">
                <i class="fas fa-magic"></i> Auto-generated secure password • Will be sent to EC
              </div>
            </div>
            
            <div>
              <label class="label">EC Email</label>
              <input id="newOrgECEmail" class="input" placeholder="ec@example.com" type="email">
            </div>
            
            <div>
              <label class="label">EC Phone</label>
              <input id="newOrgECPhone" class="input" placeholder="+233XXXXXXXXX" type="tel">
            </div>
            
            <div style="background:rgba(0,234,255,0.1);padding:10px;border-radius:6px;border-left:3px solid var(--neon-cyan)">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
                <input type="checkbox" id="sendECInviteOnCreate" style="width:auto;margin:0">
                <span style="font-weight:500">
                  <i class="fas fa-paper-plane"></i> Send credentials to EC immediately
                </span>
              </label>
              <div class="subtext" style="margin:8px 0 0 28px">
                Email will be sent automatically with login credentials
              </div>
            </div>
          </div>
        </div>
        
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> Note:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • Organization will be created in <strong>draft</strong> status<br>
            • EC can start setting up positions and candidates immediately<br>
            • You can send credentials manually later if not sent now
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="window.createNewOrganization()">
        <i class="fas fa-plus-circle"></i> Create Organization
      </button>
    `
  );
}

/**
 * Preview organization logo
 */
export function previewOrgLogo() {
  const fileInput = document.getElementById('orgLogoFile');
  const preview = document.getElementById('orgLogoPreview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
}

/**
 * Create new organization
 */
export async function createNewOrganization() {
  const name = document.getElementById('newOrgName')?.value.trim();
  const electionType = document.getElementById('newOrgElectionType')?.value;
  const description = document.getElementById('newOrgDesc')?.value.trim();
  const ecName = document.getElementById('newOrgECName')?.value.trim();
  const ecPassword = document.getElementById('newOrgECPass')?.value;
  const ecEmail = document.getElementById('newOrgECEmail')?.value.trim();
  const ecPhone = document.getElementById('newOrgECPhone')?.value.trim();
  const sendInvite = document.getElementById('sendECInviteOnCreate')?.checked;
  const logoFile = document.getElementById('orgLogoFile')?.files[0];
  const credentialType = document.getElementById('newOrgCredentialType')?.value || 'email_phone';
  
  if (!name) {
    showToast('Organization name is required', 'error');
    return;
  }
  
  // ✅ PATCH: Validate election type
  if (!electionType) {
    showToast('Please select an election type', 'error');
    return;
  }
  
  // Password is auto-generated, no need to validate
  if (!ecPassword) {
    showToast('EC password is missing', 'error');
    return;
  }
  
  // Require either EC email or EC phone for OTP system
  if (!ecEmail && !ecPhone) {
    showToast('Either EC email or EC phone is required for OTP authentication', 'error');
    return;
  }
  // Validate email if invite should be sent
  if (sendInvite && (!ecEmail || !ecEmail.includes('@'))) {
    showToast('Valid EC email is required to send invite', 'error');
    return;
  }
  
  try {
    showToast('Creating organization...', 'info');
    
    const orgId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 8);
    
    let logoUrl = '';
    
    if (logoFile) {
      try {
        const storageReference = storageRef(storage, `organizations/${orgId}/logo`);
        const reader = new FileReader();
        
        logoUrl = await new Promise((resolve, reject) => {
          reader.onload = async function(e) {
            try {
              await uploadString(storageReference, e.target.result.split(',')[1], 'base64', {
                contentType: logoFile.type
              });
              const url = await getDownloadURL(storageReference);
              resolve(url);
            } catch(error) {
              reject(error);
            }
          };
          reader.readAsDataURL(logoFile);
        });
      } catch(photoError) {
        console.error('Error uploading logo:', photoError);
        logoUrl = getDefaultLogo(name);
      }
    } else {
      logoUrl = getDefaultLogo(name);
    }
    
    const orgRef = doc(db, "organizations", orgId);
    
    // ✅ PATCH: Save election type to Firestore (authoritative)
    await setDoc(orgRef, {
      id: orgId,
      name: name,
      description: description || '',
      logoUrl: logoUrl,
      
      // ✅ PATCH: election type (single source of truth)
      electionType: electionType,
      
      // ✅ NEW: credential type for voters
      credentialType: credentialType,
      
      ecName: ecName || 'Election Commissioner',
      ecPassword: ecPassword,
      ecEmail: ecEmail || '',
      ecPhone: ecPhone || '',
      voterCount: 0,
      voteCount: 0,
      electionStatus: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      approval: {
        status: 'pending',
        requestedAt: serverTimestamp(),
        requestedBy: 'superadmin'
      }
    });
    
    // ✅ PATCH: activity + audit logging (org creation with election type)
    await logActivity({
      type: 'org_created',
      message: `Organization "${name}" created with election type: ${electionType}`,
      orgId,
      actor: 'Super Admin',
      role: 'superadmin'
    });
    
    await logAudit({
      action: 'ORG_CREATED',
      orgId,
      actor: 'Super Admin',
      role: 'superadmin',
      after: { name, electionType, ecEmail, ecPhone, ecName }
    });
    
    showToast(`✅ Organization "${name}" created successfully!`, 'success');
    document.querySelector('.modal-overlay')?.remove();
    
    // Auto-send EC invite if checkbox was checked
    if (sendInvite && ecEmail) {
      setTimeout(() => {
        sendECInviteEmail(orgId, name, ecPassword, ecEmail, ecName || 'Election Commissioner');
      }, 800);
    }
    
    loadSuperOrganizationsEnhanced();
  } catch(e) {
    console.error('Error creating organization:', e);
    showToast('Error creating organization: ' + e.message, 'error');
  }
}

/**
 * Show edit organization modal
 * @param {string} orgId - Organization ID
 */
export async function editOrganizationModal(orgId) {
  try {
    const orgDoc = await getDoc(doc(db, "organizations", orgId));
    if (!orgDoc.exists()) {
      showToast("Organization not found", "error");
      return;
    }

    const org = orgDoc.data();
    
    const modal = createModal(
      '<i class="fas fa-edit"></i> Edit Organization',
      `
        <div style="display:flex;flex-direction:column;gap:15px">
          <div>
            <label class="label">Organization Logo</label>
            <div style="margin-bottom:15px">
              <div id="editOrgLogoPreview" style="width:100px;height:100px;border-radius:12px;border:2px solid rgba(0,255,255,0.3);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);margin-bottom:10px;overflow:hidden">
                ${org.logoUrl ? `<img src="${org.logoUrl}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fas fa-building" style="font-size:32px;color:#00eaff"></i>'}
              </div>
              <input type="file" id="editOrgLogoFile" accept="image/*" class="input" onchange="window.previewEditOrgLogo()">
              <div class="subtext" style="margin-top:5px">Leave empty to keep current logo</div>
            </div>
          </div>
          
          <div>
            <label class="label">Organization Name *</label>
            <input id="editOrgName" class="input" value="${escapeHtml(org.name || '')}" required>
          </div>
          
          <div>
            <label class="label">Election Type *</label>
            <select id="editOrgElectionType" class="input" required>
              <option value="">Select election type</option>
              <option value="single_winner" ${org.electionType === 'single_winner' ? 'selected' : ''}>🏆 Single Winner (e.g. President)</option>
              <option value="multiple_winner" ${org.electionType === 'multiple_winner' ? 'selected' : ''}>👥 Multiple Winners (e.g. Executives)</option>
              <option value="referendum" ${org.electionType === 'referendum' ? 'selected' : ''}>✓ Referendum / Yes–No Vote</option>
              <option value="custom" ${org.electionType === 'custom' ? 'selected' : ''}>⚙️ Custom / Mixed</option>
            </select>
            <div class="subtext" style="margin-top:4px">
              <i class="fas fa-info-circle"></i> This determines how votes are counted and results declared.
            </div>
          </div>
          
          <div>
            <label class="label">Description</label>
            <textarea id="editOrgDesc" class="input" rows="2">${escapeHtml(org.description || '')}</textarea>
          </div>
          
          <div>
            <label class="label">EC Email (optional)</label>
            <input id="editOrgECEmail" class="input" type="email" value="${escapeHtml(org.ecEmail || '')}" placeholder="ec@example.com">
          </div>
          
          <div>
            <label class="label">EC Phone (optional)</label>
            <input id="editOrgECPhone" class="input" value="${escapeHtml(org.ecPhone || '')}" placeholder="+233XXXXXXXXX">
          </div>
          
          <div style="background:rgba(255,200,50,0.1);border:1px solid rgba(255,200,50,0.3);border-radius:12px;padding:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <i class="fas fa-key" style="color:#ffc107"></i>
              <strong style="color:#ffc107">EC Password Management</strong>
            </div>
            
            <div style="margin-bottom:12px">
              <label class="label">Current Password</label>
              <div style="display:flex;gap:8px">
                <input id="currentECPass" class="input" value="${escapeHtml(org.ecPassword || '')}" readonly style="flex:1;background:rgba(0,0,0,0.2);font-family:monospace" type="password">
                <button type="button" class="btn neon-btn-outline" onclick="const inp = document.getElementById('currentECPass'); inp.type = inp.type === 'password' ? 'text' : 'password'" style="padding:0 15px" title="Toggle visibility">
                  <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="btn neon-btn-outline" onclick="navigator.clipboard.writeText('${escapeHtml(org.ecPassword || '')}').then(() => window.showToast('Password copied!', 'success'))" style="padding:0 15px" title="Copy password">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            
            <label class="label">New EC Password (leave empty to keep current)</label>
            <div style="display:flex;gap:8px">
              <input id="editOrgECPass" class="input" type="text" placeholder="Enter new password or auto-generate" style="flex:1">
              <button type="button" class="btn neon-btn-outline" onclick="document.getElementById('editOrgECPass').value = 'EC-' + Math.random().toString(36).substring(2, 10).toUpperCase(); window.showToast('Password generated!', 'success')" style="padding:0 15px" title="Auto-generate">
                <i class="fas fa-magic"></i>
              </button>
            </div>
            <div class="subtext" style="margin-top:5px;color:#ffc832">
              Current password will remain unchanged if left empty
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="window.saveOrganizationEdits('${orgId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
  } catch (e) {
    console.error("Error loading organization:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Preview edited organization logo
 */
export function previewEditOrgLogo() {
  const fileInput = document.getElementById('editOrgLogoFile');
  const preview = document.getElementById('editOrgLogoPreview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
}

/**
 * Save organization edits
 * @param {string} orgId - Organization ID
 */
export async function saveOrganizationEdits(orgId) {
  try {
    const name = document.getElementById('editOrgName')?.value.trim();
    const electionType = document.getElementById('editOrgElectionType')?.value;
    const description = document.getElementById('editOrgDesc')?.value.trim();
    const ecEmail = document.getElementById('editOrgECEmail')?.value.trim();
    const ecPhone = document.getElementById('editOrgECPhone')?.value.trim();
    const newECPass = document.getElementById('editOrgECPass')?.value;
    const logoFile = document.getElementById('editOrgLogoFile')?.files[0];
    
    if (!name) {
      showToast('Organization name is required', 'error');
      return;
    }
    
    if (!electionType) {
      showToast('Election type is required', 'error');
      return;
    }
    
    if (newECPass && newECPass.length < 6) {
      showToast('New EC password must be at least 6 characters', 'error');
      return;
    }
    
    showToast('Saving organization changes...', 'info');
    
    const updates = {
      name: name,
      electionType: electionType,
      description: description,
      ecEmail: ecEmail || null,
      ecPhone: ecPhone || null,
      updatedAt: serverTimestamp()
    };
    
    if (newECPass) {
      updates.ecPassword = newECPass;
    }
    
    if (logoFile) {
      try {
        const reader = new FileReader();
        const logoDataUrl = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(logoFile);
        });
        
        const logoStorageRef = storageRef(storage, `organizations/${orgId}/logo.${logoFile.name.split('.').pop()}`);
        await uploadString(logoStorageRef, logoDataUrl, 'data_url');
        const logoUrl = await getDownloadURL(logoStorageRef);
        
        updates.logoUrl = logoUrl;
      } catch (uploadError) {
        console.error('Error uploading logo:', uploadError);
        showToast('Warning: Logo upload failed, but other changes will be saved', 'warning');
      }
    }
    
    const orgRef = doc(db, "organizations", orgId);
    await updateDoc(orgRef, updates);
    
    showToast('✅ Organization updated successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    
    loadSuperOrganizationsEnhanced();
  } catch (e) {
    console.error('Error updating organization:', e);
    showToast('Error updating organization: ' + e.message, 'error');
  }
}

/**
 * Show delete confirmation dialog
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name
 * @param {number} voterCount - Number of voters
 * @param {number} voteCount - Number of votes
 */
export function deleteOrganizationConfirm(orgId, orgName, voterCount = 0, voteCount = 0) {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Delete Organization',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-building"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Delete "${escapeHtml(orgName)}"?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will permanently delete ALL data for this organization:
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3); margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-around; margin-bottom: 10px;">
            <div style="text-align: center;">
              <div style="font-size: 24px; color: #ff9999; font-weight: bold;">${voterCount}</div>
              <div style="font-size: 12px; color: #ff9999;">Voters</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; color: #ff9999; font-weight: bold;">${voteCount}</div>
              <div style="font-size: 12px; color: #ff9999;">Votes</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; color: #ff9999; font-weight: bold;">All</div>
              <div style="font-size: 12px; color: #ff9999;">Positions</div>
            </div>
          </div>
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> WARNING: This action cannot be undone!
          </div>
        </div>
        <div style="text-align: left; background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 8px;">
          <div style="color: #ffcc80; font-size: 12px; margin-bottom: 5px;">What will be deleted:</div>
          <ul style="color: #ff9999; margin: 0; padding-left: 20px; font-size: 12px;">
            <li>All voter records (${voterCount} voters)</li>
            <li>All votes cast (${voteCount} votes)</li>
            <li>All positions and candidates</li>
            <li>Organization settings and configuration</li>
            <li>All uploaded files (logos, candidate photos)</li>
            <li>Organization access credentials</li>
          </ul>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="window.deleteOrganizationEnhanced('${orgId}')" style="flex: 1">
        <i class="fas fa-trash"></i> Delete Organization
      </button>
    `
  );
}

/**
 * Delete organization and all associated data
 * @param {string} orgId - Organization ID
 */
export async function deleteOrganizationEnhanced(orgId) {
  if (!orgId) {
    showToast("No organization ID provided", "error");
    return;
  }
  
  try {
    showToast(`Starting deletion of organization: ${orgId}...`, "info");
    
    // 1. Delete all subcollections
    const collections = ['voters', 'positions', 'candidates', 'votes', 'emailHistory'];
    
    for (const collectionName of collections) {
      try {
        const snap = await getDocs(collection(db, "organizations", orgId, collectionName));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(`Deleted ${snap.size} documents from ${collectionName}`);
        }
      } catch(e) {
        console.warn(`Could not delete ${collectionName}:`, e.message);
      }
    }
    
    // 2. Delete candidate photos from storage
    try {
      const candidatesSnap = await getDocs(collection(db, "organizations", orgId, "candidates"));
      const deletePromises = [];
      
      candidatesSnap.forEach(doc => {
        const candidate = doc.data();
        if (candidate.photo && !candidate.photo.includes('data:image/svg+xml')) {
          try {
            const photoRef = storageRef(storage, candidate.photo);
            deletePromises.push(deleteObject(photoRef));
          } catch(photoError) {
            console.warn('Could not delete candidate photo:', photoError);
          }
        }
      });
      
      await Promise.all(deletePromises);
      console.log(`Deleted ${deletePromises.length} candidate photos`);
    } catch(e) {
      console.warn("Error deleting candidate photos:", e);
    }
    
    // 3. Delete organization logo from storage
    try {
      const orgSnap = await getDoc(doc(db, "organizations", orgId));
      if (orgSnap.exists()) {
        const org = orgSnap.data();
        if (org.logoUrl && !org.logoUrl.includes('data:image/svg+xml')) {
          const logoRef = storageRef(storage, org.logoUrl);
          await deleteObject(logoRef);
          console.log("Deleted organization logo");
        }
      }
    } catch(e) {
      console.warn("Error deleting organization logo:", e);
    }
    
    // 4. Delete the main organization document
    await deleteDoc(doc(db, "organizations", orgId));
    
    showToast(`Organization ${orgId} deleted successfully!`, "success");
    
    // Refresh all tabs
    loadSuperOrganizationsEnhanced();
    loadSuperDeleteEnhanced();
    loadSuperApprovals();
    
  } catch(e) {
    console.error("Error deleting organization:", e);
    showToast(`Failed to delete organization: ${e.message}`, "error");
  }
}

/**
 * Bulk delete empty organizations
 */
export async function bulkDeleteEmptyOrganizations() {
  try {
    const snaps = await getDocs(collection(db, "organizations"));
    const orgs = []; 
    snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    
    const emptyOrgs = orgs.filter(org => {
      const voterCount = org.voterCount || 0;
      const voteCount = org.voteCount || 0;
      const created = org.createdAt ? new Date(org.createdAt) : new Date(0);
      const daysOld = (new Date() - created) / (1000 * 60 * 60 * 24);
      
      return (voterCount === 0 && voteCount === 0) || daysOld > 30;
    });
    
    if (emptyOrgs.length === 0) {
      showToast("No empty or old organizations found", "info");
      return;
    }
    
    const confirmMsg = `Delete ${emptyOrgs.length} inactive/empty organizations?\n\nThis will remove:\n• ${emptyOrgs.length} organizations\n• All associated data\n• All storage files`;
    
    if (!confirm(confirmMsg)) return;
    
    showToast(`Deleting ${emptyOrgs.length} organizations...`, "info");
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const org of emptyOrgs) {
      try {
        await deleteOrganizationEnhanced(org.id);
        deletedCount++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between deletions
      } catch(e) {
        console.error(`Failed to delete ${org.id}:`, e);
        errorCount++;
      }
    }
    
    showToast(`Cleanup complete: ${deletedCount} deleted, ${errorCount} errors`, deletedCount > 0 ? "success" : "warning");
    
    // Refresh views
    loadSuperOrganizationsEnhanced();
    loadSuperDeleteEnhanced();
    loadSuperApprovals();
    
  } catch(e) {
    console.error("Error in bulk delete:", e);
    showToast("Bulk deletion failed: " + e.message, "error");
  }
}

/**
 * Update credential type help text
 */
export function updateCredentialTypeHelp() {
  const select = document.getElementById('newOrgCredentialType');
  const helpText = document.getElementById('credentialTypeHelpText');
  
  const helpMessages = {
    email_phone: 'Voters will log in using email address or phone number',
    student_id: 'Students will log in using their Student ID number (e.g., STU-2024-001)',
    staff_id: 'Staff members will log in using their Employee/Staff ID (e.g., EMP-456)',
    member_id: 'Members will log in using their Membership ID (e.g., GMA-789 for Ghana Medical Association)',
    national_id: 'Voters will log in using their National ID / Ghana Card number',
    custom_pin: 'Voters will log in using a custom-assigned PIN or code'
  };
  
  if (helpText && select) {
    helpText.textContent = helpMessages[select.value] || helpMessages.email_phone;
  }
}

/**
 * ENHANCED DANGER ZONE FEATURES
 */

/**
 * Archive organization (soft delete with 30-day recovery)
 */
export async function archiveOrganization(orgId, orgName) {
  const { createModal } = await import('../utils/modal-helpers.js');
  
  createModal(
    '<i class="fas fa-archive"></i> Archive Organization',
    `
      <div style="padding: 20px 0;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 64px; color: #ffc107; margin-bottom: 15px;">
            <i class="fas fa-box-archive"></i>
          </div>
          <h3 style="color: #fff; margin-bottom: 10px;">Archive "${escapeHtml(orgName)}"?</h3>
        </div>
        
        <div style="background: rgba(255, 193, 7, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 15px;">
          <div style="color: #ffc107; margin-bottom: 8px; font-weight: 600;">
            <i class="fas fa-info-circle"></i> What is Archive?
          </div>
          <ul style="color: #ffecb3; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
            <li>Organization will be hidden from active lists</li>
            <li>All voting and login will be disabled</li>
            <li>Data remains intact and can be restored</li>
            <li>Automatically deleted after 30 days if not restored</li>
            <li>Can be recovered from "Archived" tab anytime</li>
          </ul>
        </div>
        
        <div style="background: rgba(0, 234, 255, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
          <label class="label" style="margin-bottom: 8px;">Reason for Archiving (Optional)</label>
          <textarea id="archiveReason" class="input" rows="2" placeholder="E.g., Election completed, inactive, testing org..."></textarea>
        </div>
        
        <div style="color: #64b5f6; font-size: 12px; text-align: center;">
          <i class="fas fa-shield-alt"></i> This is a safe, reversible action
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn" style="flex: 1; background: rgba(255, 193, 7, 0.2); border-color: #ffc107; color: #ffc107;" onclick="window.executeArchive('${orgId}')">
        <i class="fas fa-archive"></i> Archive Organization
      </button>
    `
  );
}

/**
 * Execute archive operation
 */
export async function executeArchive(orgId) {
  const { showToast } = await import('../utils/ui-helpers.js');
  const { closeModal } = await import('../utils/modal-helpers.js');
  const reason = document.getElementById('archiveReason')?.value || 'No reason provided';
  
  try {
    closeModal();
    showToast('Archiving organization...', 'info');
    
    const orgRef = doc(db, 'organizations', orgId);
    await updateDoc(orgRef, {
      archived: true,
      archivedAt: serverTimestamp(),
      archivedBy: 'SuperAdmin',
      archiveReason: reason,
      archiveExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    
    await logAudit({
      action: 'ORG_ARCHIVED',
      orgId,
      actor: 'Super Admin',
      role: 'superadmin',
      metadata: { reason, expiryDays: 30 }
    });
    
    showToast('Organization archived successfully! Can be restored within 30 days.', 'success');
    loadSuperOrganizationsEnhanced();
    
  } catch(e) {
    console.error('Error archiving organization:', e);
    showToast('Failed to archive: ' + e.message, 'error');
  }
}

/**
 * Restore archived organization
 */
export async function restoreOrganization(orgId, orgName) {
  const { showToast } = await import('../utils/ui-helpers.js');
  const confirmed = confirm(`Restore "${orgName}" from archive?\n\nThis will make the organization active again.`);
  if (!confirmed) return;
  
  try {
    showToast('Restoring organization...', 'info');
    
    const orgRef = doc(db, 'organizations', orgId);
    await updateDoc(orgRef, {
      archived: false,
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
      archiveExpiry: null,
      restoredAt: serverTimestamp(),
      restoredBy: 'SuperAdmin'
    });
    
    await logAudit({
      action: 'ORG_RESTORED',
      orgId,
      actor: 'Super Admin',
      role: 'superadmin'
    });
    
    showToast('Organization restored successfully!', 'success');
    loadSuperOrganizationsEnhanced();
    loadArchivedOrganizations();
    
  } catch(e) {
    console.error('Error restoring organization:', e);
    showToast('Failed to restore: ' + e.message, 'error');
  }
}

/**
 * Suspend organization temporarily
 */
export async function suspendOrganization(orgId, orgName) {
  const { createModal } = await import('../utils/modal-helpers.js');
  
  createModal(
    '<i class="fas fa-pause-circle"></i> Suspend Organization',
    `
      <div style="padding: 20px 0;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 64px; color: #ff9800; margin-bottom: 15px;">
            <i class="fas fa-hand"></i>
          </div>
          <h3 style="color: #fff; margin-bottom: 10px;">Suspend "${escapeHtml(orgName)}"?</h3>
        </div>
        
        <div style="background: rgba(255, 152, 0, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800; margin-bottom: 15px;">
          <div style="color: #ff9800; margin-bottom: 8px; font-weight: 600;">
            <i class="fas fa-info-circle"></i> What is Suspend?
          </div>
          <ul style="color: #ffe0b2; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
            <li>Temporarily disables all voting and login access</li>
            <li>Organization remains visible in lists (marked as suspended)</li>
            <li>All data remains intact and accessible to Super Admin</li>
            <li>Can be unsuspended instantly at any time</li>
            <li>Useful for investigations, maintenance, or disputes</li>
          </ul>
        </div>
        
        <div style="background: rgba(0, 234, 255, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
          <label class="label" style="margin-bottom: 8px;">Reason for Suspension *</label>
          <textarea id="suspendReason" class="input" rows="2" placeholder="E.g., Fraud investigation, maintenance, payment issue..." required></textarea>
        </div>
        
        <div style="background: rgba(0, 234, 255, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
          <label class="label" style="margin-bottom: 8px;">Duration (Optional)</label>
          <select id="suspendDuration" class="input">
            <option value="">Indefinite (manual unsuspend)</option>
            <option value="1">1 Hour</option>
            <option value="24">24 Hours</option>
            <option value="168">7 Days</option>
            <option value="720">30 Days</option>
          </select>
        </div>
        
        <div style="color: #ff9800; font-size: 12px; text-align: center;">
          <i class="fas fa-clock"></i> Can be unsuspended at any time
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn" style="flex: 1; background: rgba(255, 152, 0, 0.2); border-color: #ff9800; color: #ff9800;" onclick="window.executeSuspend('${orgId}')">
        <i class="fas fa-pause-circle"></i> Suspend Organization
      </button>
    `
  );
}

/**
 * Execute suspend operation
 */
export async function executeSuspend(orgId) {
  const { showToast } = await import('../utils/ui-helpers.js');
  const { closeModal } = await import('../utils/modal-helpers.js');
  const reason = document.getElementById('suspendReason')?.value;
  const durationHours = document.getElementById('suspendDuration')?.value;
  
  if (!reason || reason.trim().length < 5) {
    showToast('Please provide a valid reason (min 5 characters)', 'error');
    return;
  }
  
  try {
    closeModal();
    showToast('Suspending organization...', 'info');
    
    const suspendData = {
      suspended: true,
      suspendedAt: serverTimestamp(),
      suspendedBy: 'SuperAdmin',
      suspendReason: reason.trim()
    };
    
    if (durationHours) {
      const unsuspendTime = new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000);
      suspendData.suspendUntil = unsuspendTime.toISOString();
    }
    
    const orgRef = doc(db, 'organizations', orgId);
    await updateDoc(orgRef, suspendData);
    
    await logAudit({
      action: 'ORG_SUSPENDED',
      orgId,
      actor: 'Super Admin',
      role: 'superadmin',
      metadata: {
        reason,
        duration: durationHours ? `${durationHours} hours` : 'Indefinite'
      }
    });
    
    showToast('Organization suspended successfully!', 'success');
    loadSuperOrganizationsEnhanced();
    
  } catch(e) {
    console.error('Error suspending organization:', e);
    showToast('Failed to suspend: ' + e.message, 'error');
  }
}

/**
 * Unsuspend organization
 */
export async function unsuspendOrganization(orgId, orgName) {
  const { showToast } = await import('../utils/ui-helpers.js');
  const confirmed = confirm(`Unsuspend "${orgName}"?\n\nThis will restore normal access immediately.`);
  if (!confirmed) return;
  
  try {
    showToast('Unsuspending organization...', 'info');
    
    const orgRef = doc(db, 'organizations', orgId);
    await updateDoc(orgRef, {
      suspended: false,
      suspendedAt: null,
      suspendedBy: null,
      suspendReason: null,
      suspendUntil: null,
      unsuspendedAt: serverTimestamp(),
      unsuspendedBy: 'SuperAdmin'
    });
    
    await logAudit({
      action: 'ORG_UNSUSPENDED',
      orgId,
      actor: 'Super Admin',
      role: 'superadmin'
    });
    
    showToast('Organization unsuspended successfully!', 'success');
    loadSuperOrganizationsEnhanced();
    loadSuspendedOrganizations();
    
  } catch(e) {
    console.error('Error unsuspending organization:', e);
    showToast('Failed to unsuspend: ' + e.message, 'error');
  }
}

/**
 * Enhanced secure delete with backup and confirmation
 */
export async function deleteOrganizationSecure(orgId, orgName, voterCount = 0, voteCount = 0) {
  const { createModal } = await import('../utils/modal-helpers.js');
  
  createModal(
    '<i class="fas fa-shield-exclamation"></i> Secure Delete',
    `
      <div style="padding: 20px 0;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 64px; color: #ff4444; margin-bottom: 15px;">
            <i class="fas fa-skull-crossbones"></i>
          </div>
          <h3 style="color: #fff; margin-bottom: 10px;">PERMANENT DELETION</h3>
          <div style="color: #ff9999; font-size: 14px;">"${escapeHtml(orgName)}"</div>
        </div>
        
        <div style="background: rgba(255, 68, 68, 0.15); padding: 15px; border-radius: 8px; border: 2px solid #ff4444; margin-bottom: 15px;">
          <div style="color: #ff4444; margin-bottom: 12px; font-weight: 700; text-transform: uppercase; font-size: 14px;">
            <i class="fas fa-triangle-exclamation"></i> DANGER: THIS CANNOT BE UNDONE!
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px;">
            <div style="text-align: center; background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 8px;">
              <div style="font-size: 28px; color: #ff9999; font-weight: bold;">${voterCount}</div>
              <div style="font-size: 11px; color: #ff9999; text-transform: uppercase;">Voters</div>
            </div>
            <div style="text-align: center; background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 8px;">
              <div style="font-size: 28px; color: #ff9999; font-weight: bold;">${voteCount}</div>
              <div style="font-size: 11px; color: #ff9999; text-transform: uppercase;">Votes</div>
            </div>
            <div style="text-align: center; background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 8px;">
              <div style="font-size: 28px; color: #ff9999; font-weight: bold;">∞</div>
              <div style="font-size: 11px; color: #ff9999; text-transform: uppercase;">All Data</div>
            </div>
          </div>
          <ul style="color: #ff9999; margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.8;">
            <li>All ${voterCount} voter records & personal data</li>
            <li>All ${voteCount} votes & election results</li>
            <li>All positions, candidates & their photos</li>
            <li>Organization settings & configurations</li>
            <li>All files in storage (logos, uploads)</li>
            <li>Complete election history & audit logs</li>
          </ul>
        </div>
        
        <div style="background: rgba(0, 234, 255, 0.05); padding: 15px; border-radius: 8px; border-left: 4px solid #00eaff; margin-bottom: 15px;">
          <div style="color: #00eaff; margin-bottom: 10px; font-weight: 600;">
            <i class="fas fa-lightbulb"></i> Consider These Safer Options:
          </div>
          <div style="display: grid; gap: 8px;">
            <button class="btn" style="background: rgba(255, 193, 7, 0.15); border-color: #ffc107; color: #ffc107; text-align: left; padding: 10px;" onclick="document.querySelector('.modal-overlay').remove(); window.archiveOrganization('${orgId}', '${escapeHtml(orgName)}')">
              <i class="fas fa-archive"></i> Archive (30-day recovery period)
            </button>
            <button class="btn" style="background: rgba(255, 152, 0, 0.15); border-color: #ff9800; color: #ff9800; text-align: left; padding: 10px;" onclick="document.querySelector('.modal-overlay').remove(); window.suspendOrganization('${orgId}', '${escapeHtml(orgName)}')">
              <i class="fas fa-pause-circle"></i> Suspend (temporary disable)
            </button>
          </div>
        </div>
        
        <div style="background: rgba(255, 68, 68, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <label class="label" style="margin-bottom: 8px; color: #ff9999;">
            <i class="fas fa-file-export"></i> Backup Before Delete (Recommended)
          </label>
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 6px;">
            <input type="checkbox" id="exportBeforeDelete" checked style="width: auto; margin: 0;">
            <span style="color: #00eaff; font-size: 13px;">Export organization data to JSON before deleting</span>
          </label>
        </div>
        
        <div style="background: rgba(255, 68, 68, 0.1); padding: 15px; border-radius: 8px;">
          <label class="label" style="margin-bottom: 8px; color: #ff4444;">
            Type the organization name to confirm *
          </label>
          <input 
            id="deleteConfirmText" 
            class="input" 
            placeholder="Type: ${escapeHtml(orgName)}" 
            style="border-color: #ff4444; background: rgba(0, 0, 0, 0.5);"
            autocomplete="off"
          >
          <div style="color: #ff9999; font-size: 11px; margin-top: 8px;">
            <i class="fas fa-keyboard"></i> Must match exactly (case-sensitive)
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="window.executeSecureDelete('${orgId}', '${escapeHtml(orgName)}', ${voterCount}, ${voteCount})" style="flex: 1">
        <i class="fas fa-trash-alt"></i> DELETE PERMANENTLY
      </button>
    `
  );
}

/**
 * Execute secure delete with verification
 */
export async function executeSecureDelete(orgId, orgName, voterCount, voteCount) {
  const { showToast } = await import('../utils/ui-helpers.js');
  const { closeModal } = await import('../utils/modal-helpers.js');
  const confirmText = document.getElementById('deleteConfirmText')?.value;
  const exportFirst = document.getElementById('exportBeforeDelete')?.checked;
  
  if (confirmText !== orgName) {
    showToast('Organization name does not match. Deletion cancelled.', 'error');
    document.getElementById('deleteConfirmText').style.borderColor = '#ff4444';
    document.getElementById('deleteConfirmText').focus();
    return;
  }
  
  closeModal();
  
  try {
    if (exportFirst) {
      showToast('Exporting organization data...', 'info');
      await exportOrganizationData(orgId, orgName);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    for (let i = 3; i > 0; i--) {
      showToast(`Deleting in ${i}...`, 'warning');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    showToast('Deleting organization...', 'info');
    
    await logAudit({
      action: 'ORG_DELETED',
      orgId,
      actor: 'Super Admin',
      role: 'superadmin',
      metadata: {
        orgName,
        voterCount,
        voteCount,
        exportedFirst,
        timestamp: new Date().toISOString()
      }
    });
    
    await deleteOrganizationEnhanced(orgId);
    
  } catch(e) {
    console.error('Error in secure delete:', e);
    showToast('Deletion failed: ' + e.message, 'error');
  }
}

/**
 * Export organization data as JSON backup
 */
async function exportOrganizationData(orgId, orgName) {
  try {
    const { showToast } = await import('../utils/ui-helpers.js');
    const exportData = {
      exportDate: new Date().toISOString(),
      organizationId: orgId,
      organizationName: orgName,
      exportedBy: 'Super Admin'
    };
    
    const orgDoc = await getDoc(doc(db, 'organizations', orgId));
    if (orgDoc.exists()) {
      exportData.organization = orgDoc.data();
    }
    
    const collections = ['voters', 'positions', 'candidates', 'votes', 'invites', 'inviteTemplates'];
    for (const collName of collections) {
      const snap = await getDocs(collection(db, 'organizations', orgId, collName));
      exportData[collName] = [];
      snap.forEach(docSnap => {
        exportData[collName].push({ id: docSnap.id, ...docSnap.data() });
      });
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orgName.replace(/[^a-z0-9]/gi, '_')}_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('✅ Export completed!', 'success');
    
  } catch(e) {
    console.error('Export failed:', e);
    const { showToast } = await import('../utils/ui-helpers.js');
    showToast('Export failed, but deletion will continue', 'warning');
  }
}

/**
 * Load and display archived organizations
 */
export async function loadArchivedOrganizations() {
  const { showToast } = await import('../utils/ui-helpers.js');
  const container = document.getElementById('archivedOrgsList');
  if (!container) return;
  
  try {
    container.innerHTML = '<div class="subtext"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    const snaps = await getDocs(collection(db, 'organizations'));
    const archivedOrgs = [];
    snaps.forEach(s => {
      const data = s.data();
      if (data.archived === true) {
        archivedOrgs.push({ id: s.id, ...data });
      }
    });
    
    if (archivedOrgs.length === 0) {
      container.innerHTML = '<div class="subtext" style="padding:15px; background:rgba(0,0,0,0.2); border-radius:8px; text-align:center;"><i class="fas fa-inbox"></i> No archived organizations</div>';
      return;
    }
    
    let html = `<div style="margin-top:15px; display:grid; gap:10px;">`;
    
    archivedOrgs.forEach(org => {
      const archivedDate = org.archivedAt ? new Date(org.archivedAt.seconds * 1000).toLocaleDateString() : 'Unknown';
      const expiryDate = org.archiveExpiry ? new Date(org.archiveExpiry).toLocaleDateString() : 'Unknown';
      const daysLeft = org.archiveExpiry ? Math.ceil((new Date(org.archiveExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
      
      html += `
        <div style="background:rgba(255,193,7,0.05); padding:15px; border-radius:8px; border:1px solid rgba(255,193,7,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
              <strong style="color:#ffc107">${escapeHtml(org.name || org.id)}</strong>
              <div style="font-size:11px; color:#ffecb3; margin-top:2px;">
                Archived: ${archivedDate} • Expires: ${expiryDate} (${daysLeft} days)
              </div>
            </div>
          </div>
          <div style="font-size:12px; color:#ffe0b2; margin-bottom:10px;">
            <i class="fas fa-info-circle"></i> Reason: ${escapeHtml(org.archiveReason || 'No reason provided')}
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" style="flex:1; padding:8px; font-size:12px; border-color:#00eaff; color:#00eaff" onclick="window.restoreOrganization('${org.id}', '${escapeHtml(org.name || org.id)}')">
              <i class="fas fa-rotate-left"></i> Restore
            </button>
            <button class="btn" style="flex:1; padding:8px; font-size:12px; border-color:#ff4444; color:#ff4444" onclick="window.deleteOrganizationSecure('${org.id}', '${escapeHtml(org.name || org.id)}', ${org.voterCount || 0}, ${org.voteCount || 0})">
              <i class="fas fa-trash"></i> Delete Now
            </button>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
    
  } catch(e) {
    console.error('Error loading archived orgs:', e);
    container.innerHTML = '<div class="subtext" style="color:#ff4444"><i class="fas fa-exclamation-triangle"></i> Error loading archived organizations</div>';
  }
}

/**
 * Load and display suspended organizations
 */
export async function loadSuspendedOrganizations() {
  const { showToast } = await import('../utils/ui-helpers.js');
  const container = document.getElementById('suspendedOrgsList');
  if (!container) return;
  
  try {
    container.innerHTML = '<div class="subtext"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    const snaps = await getDocs(collection(db, 'organizations'));
    const suspendedOrgs = [];
    snaps.forEach(s => {
      const data = s.data();
      if (data.suspended === true) {
        suspendedOrgs.push({ id: s.id, ...data });
      }
    });
    
    if (suspendedOrgs.length === 0) {
      container.innerHTML = '<div class="subtext" style="padding:15px; background:rgba(0,0,0,0.2); border-radius:8px; text-align:center;"><i class="fas fa-inbox"></i> No suspended organizations</div>';
      return;
    }
    
    let html = `<div style="margin-top:15px; display:grid; gap:10px;">`;
    
    suspendedOrgs.forEach(org => {
      const suspendedDate = org.suspendedAt ? new Date(org.suspendedAt.seconds * 1000).toLocaleDateString() : 'Unknown';
      const unsuspendDate = org.suspendUntil ? new Date(org.suspendUntil).toLocaleDateString() : 'Indefinite';
      const isAutoUnsuspend = org.suspendUntil && new Date(org.suspendUntil) > new Date();
      
      html += `
        <div style="background:rgba(255,152,0,0.05); padding:15px; border-radius:8px; border:1px solid rgba(255,152,0,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
              <strong style="color:#ff9800">${escapeHtml(org.name || org.id)}</strong>
              <div style="font-size:11px; color:#ffe0b2; margin-top:2px;">
                Suspended: ${suspendedDate} • ${isAutoUnsuspend ? 'Auto-unsuspend: ' + unsuspendDate : 'Manual unsuspend required'}
              </div>
            </div>
          </div>
          <div style="font-size:12px; color:#ffcc80; margin-bottom:10px;">
            <i class="fas fa-info-circle"></i> Reason: ${escapeHtml(org.suspendReason || 'No reason provided')}
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" style="flex:1; padding:8px; font-size:12px; border-color:#00eaff; color:#00eaff" onclick="window.unsuspendOrganization('${org.id}', '${escapeHtml(org.name || org.id)}')">
              <i class="fas fa-play"></i> Unsuspend
            </button>
            <button class="btn" style="flex:1; padding:8px; font-size:12px; border-color:#ffc107; color:#ffc107" onclick="window.archiveOrganization('${org.id}', '${escapeHtml(org.name || org.id)}')">
              <i class="fas fa-archive"></i> Archive
            </button>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
    
  } catch(e) {
    console.error('Error loading suspended orgs:', e);
    container.innerHTML = '<div class="subtext" style="color:#ff4444"><i class="fas fa-exclamation-triangle"></i> Error loading suspended organizations</div>';
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadSuperOrganizationsEnhanced = loadSuperOrganizationsEnhanced;
  window.loadSuperDeleteEnhanced = loadSuperDeleteEnhanced;
  window.showCreateOrgModal = showCreateOrgModal;
  window.previewOrgLogo = previewOrgLogo;
  window.createNewOrganization = createNewOrganization;
  window.updateCredentialTypeHelp = updateCredentialTypeHelp;
  window.editOrganizationModal = editOrganizationModal;
  window.previewEditOrgLogo = previewEditOrgLogo;
  window.saveOrganizationEdits = saveOrganizationEdits;
  window.deleteOrganizationConfirm = deleteOrganizationConfirm;
  window.deleteOrganizationEnhanced = deleteOrganizationEnhanced;
  window.deleteOrganization = deleteOrganizationEnhanced;
  window.bulkDeleteEmptyOrganizations = bulkDeleteEmptyOrganizations;
  
  // Enhanced danger zone exports
  window.archiveOrganization = archiveOrganization;
  window.executeArchive = executeArchive;
  window.restoreOrganization = restoreOrganization;
  window.suspendOrganization = suspendOrganization;
  window.executeSuspend = executeSuspend;
  window.unsuspendOrganization = unsuspendOrganization;
  window.deleteOrganizationSecure = deleteOrganizationSecure;
  window.executeSecureDelete = executeSecureDelete;
  window.loadArchivedOrganizations = loadArchivedOrganizations;
  window.loadSuspendedOrganizations = loadSuspendedOrganizations;
}
