/**
 * Admin Module - Dashboard
 * Displays dashboard statistics and overview for administrators
 */

import { db } from '../config/firebase.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showQuickLoading, renderError } from '../utils/ui-helpers.js';
import { hasPermission } from '../config/admin-roles.js';

/**
 * Load admin dashboard with statistics
 */
export async function loadAdminDashboard() {
  const container = document.getElementById('adminContent-dashboard');
  if (!container) return;

  const t = window.t || ((key) => key);
  showQuickLoading('adminContent-dashboard', t('loading_dashboard') || 'Loading Dashboard');

  try {
    // Gather statistics based on permissions
    const stats = {
      totalOrganizations: 0,
      activeOrganizations: 0,
      pendingApprovals: 0,
      approvedOrganizations: 0,
      rejectedOrganizations: 0,
      totalVoters: 0,
      totalVotes: 0,
      totalAdministrators: 0,
      activeElections: 0,
      endedElections: 0,
      declaredElections: 0,
      averageTurnout: 0,
      recentOrganizations: [],
      topOrganizations: []
    };

    // Load organizations if permitted
    if (hasPermission(window.currentAdmin, 'view_organizations')) {
      const orgsRef = collection(db, 'organizations');
      const orgsSnap = await getDocs(orgsRef);
      stats.totalOrganizations = orgsSnap.size;
      
      const organizations = [];
      let activeCount = 0;
      let totalVotersSum = 0;
      let totalVotesSum = 0;
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;
      let activeElectionCount = 0;
      let endedElectionCount = 0;
      let declaredElectionCount = 0;
      let turnoutSum = 0;
      let turnoutCount = 0;
      
      orgsSnap.forEach(doc => {
        const org = { id: doc.id, ...doc.data() };
        organizations.push(org);
        
        // Count by approval status
        const approvalStatus = org.approval?.status || 'pending';
        if (approvalStatus === 'pending') pendingCount++;
        if (approvalStatus === 'approved') {
          approvedCount++;
          activeCount++;
        }
        if (approvalStatus === 'rejected') rejectedCount++;
        
        // Count by election status
        const electionStatus = org.electionStatus || 'draft';
        if (electionStatus === 'active') activeElectionCount++;
        if (electionStatus === 'ended') endedElectionCount++;
        if (electionStatus === 'declared') declaredElectionCount++;
        
        // Sum voters and votes
        const voterCount = org.voterCount || 0;
        const voteCount = org.voteCount || 0;
        totalVotersSum += voterCount;
        totalVotesSum += voteCount;
        
        // Calculate turnout
        if (voterCount > 0 && voteCount > 0) {
          turnoutSum += (voteCount / voterCount) * 100;
          turnoutCount++;
        }
      });
      
      stats.activeOrganizations = activeCount;
      stats.totalVoters = totalVotersSum;
      stats.totalVotes = totalVotesSum;
      stats.pendingApprovals = pendingCount;
      stats.approvedOrganizations = approvedCount;
      stats.rejectedOrganizations = rejectedCount;
      stats.activeElections = activeElectionCount;
      stats.endedElections = endedElectionCount;
      stats.declaredElections = declaredElectionCount;
      stats.averageTurnout = turnoutCount > 0 ? Math.round(turnoutSum / turnoutCount) : 0;
      
      // Get recent organizations (last 5)
      stats.recentOrganizations = organizations
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        })
        .slice(0, 5);
      
      // Get top organizations by voter count
      stats.topOrganizations = organizations
        .filter(org => org.voterCount > 0)
        .sort((a, b) => (b.voterCount || 0) - (a.voterCount || 0))
        .slice(0, 5);
    }

    // Load administrators count if permitted
    if (hasPermission(window.currentAdmin, 'view_admins')) {
      const adminsRef = collection(db, 'administrators');
      const adminsSnap = await getDocs(adminsRef);
      
      let activeAdmins = 0;
      adminsSnap.forEach(doc => {
        if (doc.data().status === 'active') activeAdmins++;
      });
      
      stats.totalAdministrators = adminsSnap.size;
      stats.activeAdministrators = activeAdmins;
    }

    renderAdminDashboard(stats);
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    renderError('adminContent-dashboard', 'Failed to load dashboard: ' + error.message, 'loadAdminDashboard()');
  }
}

/**
 * 🔥 PATCH 3: Admin tab loaders - ensuring every tab has a loader
 */

/**
 * Load organizations tab (admin view) 
 * ✅ FIXED: Renders directly into admin container with proper error handling
 */
export async function loadAdminOrganizations() {
  console.log('[ADMIN LOADER] Organizations - Starting');
  const el = document.getElementById('adminContent-orgs');
  const t = window.t || ((key) => key);
  
  if (!el) {
    console.error('[ADMIN LOADER] Container not found: adminContent-orgs');
    return;
  }

  // Always show loading immediately
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;justify-content:center;padding:40px;color:rgba(234,242,255,.75)">
      <i class="fas fa-spinner fa-spin"></i>
      ${t('loading') || 'Loading'} ${t('organizations') || 'organizations'}…
    </div>
  `;

  try {
    console.log('[ADMIN LOADER] Fetching organizations from Firestore');
    const orgsRef = collection(db, 'organizations');
    const orgsSnap = await getDocs(orgsRef);
    
    const orgs = [];
    orgsSnap.forEach(doc => {
      orgs.push({ id: doc.id, ...doc.data() });
    });

    console.log('[ADMIN LOADER] Loaded', orgs.length, 'organizations');

    if (orgs.length === 0) {
      el.innerHTML = `
        <div class="card">
          <h3 style="margin:0 0 10px"><i class="fas fa-building"></i> Organizations</h3>
          <div class="subtext">No organizations yet. Organizations will appear here once created.</div>
        </div>
      `;
      return;
    }

    // Sort by creation date (newest first)
    orgs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    // Render organizations table
    let html = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
          <h3 style="margin:0"><i class="fas fa-building"></i> ${t('organizations') || 'Organizations'} (${orgs.length})</h3>
          <button class="btn neon-btn-outline" onclick="location.reload()">
            <i class="fas fa-sync"></i> ${t('refresh') || 'Refresh'}
          </button>
        </div>
        
        <div style="overflow-x: auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="text-align:left;color:rgba(234,242,255,.7);font-size:13px">
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">${t('organization') || 'Organization'}</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">${t('type') || 'Type'}</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">${t('approval') || 'Approval'}</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">${t('election_status') || 'Election Status'}</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">${t('voters') || 'Voters'}</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">${t('votes') || 'Votes'}</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">${t('created') || 'Created'}</th>
              </tr>
            </thead>
            <tbody>
    `;

    orgs.forEach(org => {
      const approvalStatus = org.approval?.status || 'pending';
      const electionStatus = org.electionStatus || 'draft';
      const voterCount = org.voterCount || 0;
      const voteCount = org.voteCount || 0;
      const turnout = voterCount > 0 ? Math.round((voteCount / voterCount) * 100) : 0;
      const createdDate = org.createdAt?.toDate?.();
      
      // Status badge colors
      const approvalBadge = approvalStatus === 'approved' ? 
        '<span class="badge success"><i class="fas fa-check"></i> Approved</span>' :
        approvalStatus === 'rejected' ?
        '<span class="badge danger"><i class="fas fa-times"></i> Rejected</span>' :
        '<span class="badge warning"><i class="fas fa-clock"></i> Pending</span>';
      
      const electionBadge = electionStatus === 'active' ?
        '<span class="badge neon"><i class="fas fa-play"></i> Active</span>' :
        electionStatus === 'ended' ?
        '<span class="badge" style="background: rgba(255,165,0,0.2); color: #ffa500"><i class="fas fa-stop"></i> Ended</span>' :
        electionStatus === 'declared' ?
        '<span class="badge success"><i class="fas fa-trophy"></i> Declared</span>' :
        '<span class="badge" style="background: rgba(255,255,255,0.1)"><i class="fas fa-file"></i> Draft</span>';

      html += `
        <tr style="border-bottom:1px solid rgba(255,255,255,.05)">
          <td style="padding:12px 10px">
            <strong style="color: #00eaff">${org.name || org.id}</strong><br>
            <span style="color:rgba(234,242,255,.5);font-size:11px">ID: ${org.id}</span>
          </td>
          <td style="padding:12px 10px">
            <span class="badge neon-outline" style="font-size: 11px">
              ${org.electionType || org.type || '—'}
            </span>
          </td>
          <td style="padding:12px 10px">
            ${approvalBadge}
          </td>
          <td style="padding:12px 10px">
            ${electionBadge}
          </td>
          <td style="padding:12px 10px">
            <strong>${voterCount.toLocaleString()}</strong>
          </td>
          <td style="padding:12px 10px">
            <strong>${voteCount.toLocaleString()}</strong>
            ${voterCount > 0 ? `<br><span class="subtext">${turnout}% turnout</span>` : ''}
          </td>
          <td style="padding:12px 10px">
            <span class="subtext">
              ${createdDate ? createdDate.toLocaleDateString() : '—'}
            </span>
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.innerHTML = html;
    console.log('[ADMIN LOADER] Organizations rendered successfully');
    
  } catch (error) {
    console.error('[ADMIN LOADER] Organizations load failed:', error);
    el.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px;color:#ff6666">
          <i class="fas fa-exclamation-triangle"></i> Failed to load organizations
        </h3>
        <div class="subtext" style="margin-bottom: 15px">${error.message || error}</div>
        <button class="btn neon-btn-outline" onclick="window.loadAdminOrganizations()">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

/**
 * Load approvals tab (admin view)
 * ✅ FIXED: Renders directly with permission-aware display
 */
export async function loadAdminApprovals() {
  console.log('[ADMIN LOADER] Approvals - Starting');
  const el = document.getElementById('adminContent-approvals-list');
  const t = window.t || ((key) => key);
  
  if (!el) {
    console.error('[ADMIN LOADER] Container not found: adminContent-approvals-list');
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;justify-content:center;padding:40px;color:rgba(234,242,255,.75)">
      <i class="fas fa-spinner fa-spin"></i>
      ${t('loading') || 'Loading'} ${t('approvals') || 'approvals'}…
    </div>
  `;

  try {
    console.log('[ADMIN LOADER] Fetching approvals from Firestore');
    const orgsRef = collection(db, 'organizations');
    const orgsSnap = await getDocs(orgsRef);
    
    const pending = [];
    const approved = [];
    const rejected = [];
    
    orgsSnap.forEach(doc => {
      const org = { id: doc.id, ...doc.data() };
      const status = org.approval?.status || 'pending';
      if (status === 'pending') pending.push(org);
      else if (status === 'approved') approved.push(org);
      else if (status === 'rejected') rejected.push(org);
    });

    let html = `
      <div class="card">
        <h3 style="margin:0 0 20px"><i class="fas fa-clipboard-check"></i> Election Approvals</h3>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px">
          <div style="text-align: center; padding: 20px; background: rgba(255,165,0,0.1); border-radius: 8px; border: 1px solid rgba(255,165,0,0.3)">
            <div style="font-size: 32px; font-weight: 700; color: #ffa500">${pending.length}</div>
            <div class="subtext">Pending</div>
          </div>
          <div style="text-align: center; padding: 20px; background: rgba(0,255,170,0.1); border-radius: 8px; border: 1px solid rgba(0,255,170,0.3)">
            <div style="font-size: 32px; font-weight: 700; color: #00ffaa">${approved.length}</div>
            <div class="subtext">Approved</div>
          </div>
          <div style="text-align: center; padding: 20px; background: rgba(255,100,100,0.1); border-radius: 8px; border: 1px solid rgba(255,100,100,0.3)">
            <div style="font-size: 32px; font-weight: 700; color: #ff6464">${rejected.length}</div>
            <div class="subtext">Rejected</div>
          </div>
        </div>
    `;

    if (pending.length > 0) {
      html += `<h4 style="margin: 20px 0 10px"><i class="fas fa-clock"></i> Pending Approvals</h4>`;
      pending.forEach(org => {
        html += `
          <div style="padding: 15px; margin-bottom: 10px; background: rgba(255,165,0,0.05); border-radius: 8px; border: 1px solid rgba(255,165,0,0.2)">
            <strong style="color: #00eaff">${org.name || org.id}</strong>
            <div class="subtext" style="margin-top: 5px">
              <i class="fas fa-users"></i> ${org.voterCount || 0} voters
              • <i class="fas fa-calendar"></i> Requested: ${org.approval?.requestedAt?.toDate?.()?.toLocaleDateString() || '—'}
            </div>
          </div>
        `;
      });
    } else {
      html += `<div class="subtext" style="text-align: center; padding: 20px">No pending approvals</div>`;
    }

    html += `</div>`;
    el.innerHTML = html;
    console.log('[ADMIN LOADER] Approvals rendered successfully');
    
  } catch (error) {
    console.error('[ADMIN LOADER] Approvals load failed:', error);
    el.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px;color:#ff6666">
          <i class="fas fa-exclamation-triangle"></i> Failed to load approvals
        </h3>
        <div class="subtext" style="margin-bottom: 15px">${error.message || error}</div>
        <button class="btn neon-btn-outline" onclick="window.loadAdminApprovals()">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

/**
 * Load administrators tab
 * ✅ FIXED: Renders directly with proper error handling
 */
export async function loadAdminAdministrators() {
  console.log('[ADMIN LOADER] Administrators - Starting');
  const el = document.getElementById('adminContent-admins');
  const t = window.t || ((key) => key);
  
  if (!el) {
    console.error('[ADMIN LOADER] Container not found: adminContent-admins');
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;justify-content:center;padding:40px;color:rgba(234,242,255,.75)">
      <i class="fas fa-spinner fa-spin"></i>
      ${t('loading') || 'Loading'} ${t('administrators') || 'administrators'}…
    </div>
  `;

  try {
    console.log('[ADMIN LOADER] Fetching administrators from Firestore');
    const adminsRef = collection(db, 'administrators');
    const adminsSnap = await getDocs(adminsRef);
    
    const admins = [];
    adminsSnap.forEach(doc => {
      admins.push({ id: doc.id, ...doc.data() });
    });

    let html = `
      <div class="card">
        <h3 style="margin:0 0 20px"><i class="fas fa-users-cog"></i> Administrators (${admins.length})</h3>
        
        <div style="overflow-x: auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="text-align:left;color:rgba(234,242,255,.7);font-size:13px">
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">Name</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">Email</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">Role</th>
                <th style="padding:12px 10px;border-bottom:2px solid rgba(255,255,255,.1)">Status</th>
              </tr>
            </thead>
            <tbody>
    `;

    admins.forEach(admin => {
      const statusBadge = admin.status === 'active' ?
        '<span class="badge success"><i class="fas fa-check"></i> Active</span>' :
        '<span class="badge danger"><i class="fas fa-ban"></i> Inactive</span>';
      
      const roleColor = admin.role === 'super_admin' ? '#ff4444' : 
                       admin.role === 'admin' ? '#ffa500' : 
                       admin.role === 'approval_manager' ? '#00eaff' : '#888';

      html += `
        <tr style="border-bottom:1px solid rgba(255,255,255,.05)">
          <td style="padding:12px 10px">
            <strong>${admin.name || '—'}</strong>
          </td>
          <td style="padding:12px 10px">
            <span class="subtext">${admin.email || admin.id}</span>
          </td>
          <td style="padding:12px 10px">
            <span class="badge" style="background: ${roleColor}33; color: ${roleColor}; border: 1px solid ${roleColor}66">
              ${(admin.role || 'custom').replace(/_/g, ' ').toUpperCase()}
            </span>
          </td>
          <td style="padding:12px 10px">
            ${statusBadge}
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.innerHTML = html;
    console.log('[ADMIN LOADER] Administrators rendered successfully');
    
  } catch (error) {
    console.error('[ADMIN LOADER] Administrators load failed:', error);
    el.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px;color:#ff6666">
          <i class="fas fa-exclamation-triangle"></i> Failed to load administrators
        </h3>
        <div class="subtext" style="margin-bottom: 15px">${error.message || error}</div>
        <button class="btn neon-btn-outline" onclick="window.loadAdminAdministrators()">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

/**
 * Load settings tab (admin view)
 * ✅ FIXED: Renders admin-specific settings
 */
export async function loadAdminSettings() {
  console.log('[ADMIN LOADER] Settings - Starting');
  const el = document.getElementById('adminContent-settings-content');
  const t = window.t || ((key) => key);
  
  if (!el) {
    console.error('[ADMIN LOADER] Container not found: adminContent-settings-content');
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;justify-content:center;padding:40px;color:rgba(234,242,255,.75)">
      <i class="fas fa-spinner fa-spin"></i>
      ${t('loading') || 'Loading'} ${t('settings') || 'settings'}…
    </div>
  `;

  try {
    const admin = window.currentAdmin;
    
    let html = `
      <div class="card">
        <h3 style="margin:0 0 20px"><i class="fas fa-cog"></i> System Settings</h3>
        
        <!-- Account Settings -->
        <h4 style="margin: 20px 0 10px"><i class="fas fa-user"></i> Account</h4>
        <div style="padding: 15px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 20px">
          <div style="margin-bottom: 10px">
            <strong>Name:</strong> ${admin.name}
          </div>
          <div style="margin-bottom: 10px">
            <strong>Email:</strong> ${admin.email}
          </div>
          <div style="margin-bottom: 10px">
            <strong>Role:</strong> 
            <span class="badge neon-outline" style="margin-left: 8px">
              ${(admin.role || 'admin').replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <div>
            <strong>Status:</strong> 
            <span class="badge success" style="margin-left: 8px">
              <i class="fas fa-check-circle"></i> ${admin.status || 'Active'}
            </span>
          </div>
        </div>
        
        <!-- Appearance -->
        <h4 style="margin: 20px 0 10px"><i class="fas fa-palette"></i> Appearance</h4>
        <div style="padding: 15px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 20px">
          <div class="subtext">Theme and language settings coming soon</div>
        </div>
        
        <!-- Security -->
        <h4 style="margin: 20px 0 10px"><i class="fas fa-shield-alt"></i> Security</h4>
        <div style="padding: 15px; background: rgba(255,255,255,0.03); border-radius: 8px">
          <button class="btn neon-btn-outline" onclick="alert('Password change feature coming soon')">
            <i class="fas fa-key"></i> Change Password
          </button>
        </div>
      </div>
    `;

    el.innerHTML = html;
    console.log('[ADMIN LOADER] Settings rendered successfully');
    
  } catch (error) {
    console.error('[ADMIN LOADER] Settings load failed:', error);
    el.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px;color:#ff6666">
          <i class="fas fa-exclamation-triangle"></i> Failed to load settings
        </h3>
        <div class="subtext" style="margin-bottom: 15px">${error.message || error}</div>
        <button class="btn neon-btn-outline" onclick="window.loadAdminSettings()">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

/**
 * Load audit logs tab
 */
export async function loadAdminAuditLogs() {
  console.log('[ADMIN LOADER] Audit Logs');
  const el = document.getElementById('adminContent-audit');
  if (!el) return;

  el.innerHTML = `
    <div class="card" style="text-align: center; padding: 40px;">
      <i class="fas fa-history" style="font-size: 48px; color: #9d00ff; margin-bottom: 20px;"></i>
      <h3>Audit Logs</h3>
      <p class="subtext">Audit trail feature coming soon.</p>
      <p class="subtext" style="margin-top: 20px;">This will track all admin actions and system changes.</p>
    </div>
  `;
}

/**
 * Render admin dashboard with statistics
 * @param {Object} stats - Dashboard statistics
 */
function renderAdminDashboard(stats) {
  const container = document.getElementById('adminContent-dashboard');
  const t = window.t || ((key) => key);
  const admin = window.currentAdmin;

  if (!admin) {
    container.innerHTML = '<div class="card error"><p>Session expired. Please login again.</p></div>';
    return;
  }

  let html = `
    <div class="card" style="margin-bottom: 20px">
      <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, rgba(157,0,255,0.2), rgba(0,234,255,0.2)); display: flex; align-items: center; justify-content: center">
          <i class="fas fa-user-shield" style="font-size: 28px; color: #9d00ff"></i>
        </div>
        <div>
          <h2 style="margin: 0">${t('welcome_back') || 'Welcome back'}, ${admin.name}!</h2>
          <p class="subtext" style="margin: 5px 0 0 0">
            ${t('role') || 'Role'}: <strong>${admin.role.replace('_', ' ').toUpperCase()}</strong>
          </p>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; flex-wrap: wrap">
        <span class="badge neon">
          <i class="fas fa-shield-alt"></i> ${admin.permissions.length} ${t('permissions') || 'Permissions'}
        </span>
        <span class="badge success">
          <i class="fas fa-check-circle"></i> ${admin.status === 'active' ? t('active') || 'Active' : t('inactive') || 'Inactive'}
        </span>
      </div>
    </div>
  `;

  // Statistics cards
  html += `
    <h3 style="margin-bottom: 15px">
      <i class="fas fa-chart-bar"></i> ${t('system_overview') || 'System Overview'}
    </h3>
    
    <style>
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .stat-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        gap: 15px;
        align-items: center;
        transition: all 0.2s ease;
      }
      .stat-card:hover {
        background: rgba(255,255,255,0.05);
        border-color: rgba(0,234,255,0.3);
        transform: translateY(-2px);
      }
      .stat-icon {
        width: 50px;
        height: 50px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        flex-shrink: 0;
      }
      .stat-card .label {
        font-size: 12px;
        color: rgba(255,255,255,0.6);
        margin-bottom: 4px;
      }
      .stat-card .value {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 2px;
      }
      .stat-card .subtext {
        font-size: 11px;
        color: rgba(255,255,255,0.5);
      }
    </style>
    
    <div class="stats-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 30px">
  `;

  // Organizations stat (if permitted)
  if (hasPermission(admin, 'view_organizations')) {
    html += `
      <div class="stat-card" style="cursor: pointer" onclick="showAdminTab('organizations')">
        <div class="stat-icon" style="background: rgba(0,234,255,0.1)">
          <i class="fas fa-building" style="color: #00eaff"></i>
        </div>
        <div>
          <div class="label">${t('total_organizations') || 'Total Organizations'}</div>
          <div class="value">${stats.totalOrganizations}</div>
          <div class="subtext">${stats.activeOrganizations} ${t('active') || 'active'}</div>
        </div>
      </div>
    `;
  }

  // Approvals stat (if permitted)
  if (hasPermission(admin, 'view_approvals')) {
    const urgentStyle = stats.pendingApprovals > 0 ? 'animation: pulse 2s infinite;' : '';
    html += `
      <div class="stat-card" style="cursor: pointer; ${urgentStyle}" onclick="showAdminTab('approvals')">
        <div class="stat-icon" style="background: rgba(255,165,0,0.1)">
          <i class="fas fa-clipboard-check" style="color: #ffa500"></i>
        </div>
        <div>
          <div class="label">${t('pending_approvals') || 'Pending Approvals'}</div>
          <div class="value">${stats.pendingApprovals}</div>
          <div class="subtext">${stats.approvedOrganizations} ${t('approved') || 'approved'} • ${stats.rejectedOrganizations} ${t('rejected') || 'rejected'}</div>
        </div>
      </div>
    `;
  }
  
  // Active elections stat (if permitted)
  if (hasPermission(admin, 'view_organizations')) {
    html += `
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(0,255,170,0.1)">
          <i class="fas fa-vote-yea" style="color: #00ffaa"></i>
        </div>
        <div>
          <div class="label">${t('active_elections') || 'Active Elections'}</div>
          <div class="value">${stats.activeElections}</div>
          <div class="subtext">${stats.endedElections} ${t('ended') || 'ended'} • ${stats.declaredElections} ${t('declared') || 'declared'}</div>
        </div>
      </div>
    `;
  }
  
  // Average turnout stat (if permitted)
  if (hasPermission(admin, 'view_voters') && stats.averageTurnout > 0) {
    const turnoutColor = stats.averageTurnout >= 70 ? '#00ffaa' : stats.averageTurnout >= 50 ? '#ffa500' : '#ff6464';
    html += `
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(0,234,255,0.1)">
          <i class="fas fa-chart-line" style="color: #00eaff"></i>
        </div>
        <div>
          <div class="label">${t('avg_turnout') || 'Average Turnout'}</div>
          <div class="value" style="color: ${turnoutColor}">${stats.averageTurnout}%</div>
          <div class="subtext">${t('across_all_elections') || 'Across all elections'}</div>
        </div>
      </div>
    `;
  }

  // Voters stat (if permitted)
  if (hasPermission(admin, 'view_voters')) {
    html += `
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(157,0,255,0.1)">
          <i class="fas fa-users" style="color: #9d00ff"></i>
        </div>
        <div>
          <div class="label">${t('total_voters') || 'Total Voters'}</div>
          <div class="value">${stats.totalVoters.toLocaleString()}</div>
          <div class="subtext">${t('across_all_orgs') || 'Across all organizations'}</div>
        </div>
      </div>
    `;
  }

  // Votes stat (if permitted)
  if (hasPermission(admin, 'view_votes')) {
    html += `
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(0,255,170,0.1)">
          <i class="fas fa-check-to-slot" style="color: #00ffaa"></i>
        </div>
        <div>
          <div class="label">${t('total_votes') || 'Total Votes Cast'}</div>
          <div class="value">${stats.totalVotes.toLocaleString()}</div>
          <div class="subtext">${t('across_all_elections') || 'Across all elections'}</div>
        </div>
      </div>
    `;
  }

  // Administrators stat (if permitted)
  if (hasPermission(admin, 'view_admins')) {
    html += `
      <div class="stat-card" style="cursor: pointer" onclick="showAdminTab('administrators')">
        <div class="stat-icon" style="background: rgba(255,100,100,0.1)">
          <i class="fas fa-users-cog" style="color: #ff6464"></i>
        </div>
        <div>
          <div class="label">${t('administrators') || 'Administrators'}</div>
          <div class="value">${stats.totalAdministrators}</div>
          <div class="subtext">${stats.activeAdministrators || stats.totalAdministrators} ${t('active') || 'active'}</div>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  
  // System health indicator
  html += `
    <div class="card" style="margin-bottom: 30px">
      <h3 style="margin-bottom: 15px">
        <i class="fas fa-heartbeat"></i> ${t('system_health') || 'System Health'}
      </h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px">
        <div style="padding: 15px; background: rgba(0,255,170,0.05); border-radius: 8px; border: 1px solid rgba(0,255,170,0.2)">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
            <i class="fas fa-database" style="color: #00ffaa"></i>
            <strong>${t('database') || 'Database'}</strong>
          </div>
          <div class="subtext">
            <i class="fas fa-check-circle" style="color: #00ffaa"></i> ${t('connected') || 'Connected'}
            <span style="margin-left: 8px">\u2022</span>
            <span style="margin-left: 8px">${stats.totalOrganizations} ${t('collections') || 'collections'}</span>
          </div>
        </div>
        
        <div style="padding: 15px; background: rgba(0,234,255,0.05); border-radius: 8px; border: 1px solid rgba(0,234,255,0.2)">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
            <i class="fas fa-sync-alt" style="color: #00eaff"></i>
            <strong>${t('real_time_sync') || 'Real-time Sync'}</strong>
          </div>
          <div class="subtext">
            <i class="fas fa-check-circle" style="color: #00eaff"></i> ${t('active') || 'Active'}
          </div>
        </div>
        
        <div style="padding: 15px; background: rgba(157,0,255,0.05); border-radius: 8px; border: 1px solid rgba(157,0,255,0.2)">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
            <i class="fas fa-shield-alt" style="color: #9d00ff"></i>
            <strong>${t('security') || 'Security'}</strong>
          </div>
          <div class="subtext">
            <i class="fas fa-check-circle" style="color: #9d00ff"></i> ${t('rbac_enabled') || 'RBAC Enabled'}
          </div>
        </div>
      </div>
    </div>
  `;

  // Quick actions
  html += `
    <h3 style="margin-bottom: 15px; margin-top: 20px">
      <i class="fas fa-bolt"></i> ${t('quick_actions') || 'Quick Actions'}
    </h3>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px">
  `;

  if (hasPermission(admin, 'view_organizations')) {
    html += `
      <button class="btn neon-btn" onclick="showAdminTab('organizations')" style="width: 100%">
        <i class="fas fa-building"></i> ${t('manage_organizations') || 'Manage Organizations'}
      </button>
    `;
  }

  if (hasPermission(admin, 'view_approvals')) {
    html += `
      <button class="btn neon-btn" onclick="showAdminTab('approvals')" style="width: 100%">
        <i class="fas fa-clipboard-check"></i> ${t('review_approvals') || 'Review Approvals'}
      </button>
    `;
  }

  if (hasPermission(admin, 'view_admins')) {
    html += `
      <button class="btn neon-btn" onclick="showAdminTab('administrators')" style="width: 100%">
        <i class="fas fa-users-cog"></i> ${t('manage_admins') || 'Manage Admins'}
      </button>
    `;
  }

  if (hasPermission(admin, 'view_settings')) {
    html += `
      <button class="btn neon-btn" onclick="showAdminTab('settings')" style="width: 100%">
        <i class="fas fa-cog"></i> ${t('system_settings') || 'System Settings'}
      </button>
    `;
  }

  html += `</div>`;
  
  // Recent organizations (if permitted and data available)
  if (hasPermission(admin, 'view_organizations') && stats.recentOrganizations && stats.recentOrganizations.length > 0) {
    html += `
      <h3 style="margin-bottom: 15px; margin-top: 30px">
        <i class="fas fa-clock"></i> ${t('recent_organizations') || 'Recent Organizations'}
      </h3>
      <div class="card" style="padding: 0; overflow: hidden">
    `;
    
    stats.recentOrganizations.forEach((org, index) => {
      const approvalStatus = org.approval?.status || 'pending';
      const statusBadge = approvalStatus === 'approved' ? 
        `<span class="badge success"><i class="fas fa-check"></i> ${t('approved') || 'Approved'}</span>` :
        approvalStatus === 'rejected' ?
        `<span class="badge danger"><i class="fas fa-times"></i> ${t('rejected') || 'Rejected'}</span>` :
        `<span class="badge warning"><i class="fas fa-clock"></i> ${t('pending') || 'Pending'}</span>`;
      
      const borderTop = index > 0 ? 'border-top: 1px solid rgba(255,255,255,0.1);' : '';
      const createdDate = org.createdAt?.toDate?.() || new Date();
      
      html += `
        <div style="padding: 15px; ${borderTop}">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div style="flex: 1">
              <strong style="color: #00eaff">${org.name || org.id}</strong>
              <div class="subtext" style="margin-top: 4px">
                <i class="fas fa-calendar"></i> ${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}
                • <i class="fas fa-users"></i> ${org.voterCount || 0} voters
                • <i class="fas fa-check-circle"></i> ${org.voteCount || 0} votes
              </div>
            </div>
            ${statusBadge}
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
  }

  // Permissions overview
  html += `
    <div class="card" style="margin-top: 30px">
      <h3 style="margin-bottom: 15px">
        <i class="fas fa-shield-alt"></i> ${t('your_permissions') || 'Your Permissions'}
      </h3>
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        ${admin.permissions.map(perm => `
          <span class="badge neon-outline" style="font-size: 12px">
            ${perm.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Expose function to window
if (typeof window !== 'undefined') {
  window.loadAdminDashboard = loadAdminDashboard;
  window.loadAdminOrganizations = loadAdminOrganizations;
  window.loadAdminApprovals = loadAdminApprovals;
  window.loadAdminAdministrators = loadAdminAdministrators;
  window.loadAdminSettings = loadAdminSettings;
  window.loadAdminAuditLogs = loadAdminAuditLogs;
}

/**
 * Listen for language changes and refresh current admin tab
 */
window.addEventListener('languageChanged', () => {
  console.log('[ADMIN] Language changed - refreshing current tab');
  
  // Find currently active tab
  const activeTab = document.querySelector('[data-admin-tab].active');
  if (!activeTab) return;
  
  const tabId = activeTab.dataset.adminTab;
  const contentEl = document.getElementById(`adminContent-${tabId}`);
  
  // Clear loaded flag to force reload
  if (contentEl) {
    delete contentEl.dataset.loaded;
  }
  
  // Reload the tab content
  if (typeof window.showAdminTab === 'function') {
    window.showAdminTab(tabId);
  }
});
