/**
 * Super Admin Module - Dashboard Stats
 * Handles global dashboard metrics, charts, and real-time data
 */

import { db } from '../config/firebase.js';
import { 
  collection, 
  getDocs,
  query,
  onSnapshot 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showQuickLoading, renderError } from '../utils/ui-helpers.js';

/**
 * Initialize dashboard with real-time updates
 */
export async function initializeDashboard() {
  const el = document.getElementById('superContent-dashboard');
  if (!el) return;
  
  console.log('Initializing dashboard (snapshot-driven)...');
  
  // ✅ PATCH: clean up existing listener before re-init
  if (window.__dashboardUnsubscribe) {
    window.__dashboardUnsubscribe();
  }
  
  // ✅ CRITICAL FIX: Show loading state immediately
  showQuickLoading('superContent-dashboard', 'Loading Live Dashboard');
  
  try {
    // ✅ Use a single real-time stream (this also gives the initial data immediately)
    let debounceTimer = null;
    const orgsQuery = query(collection(db, "organizations"));
    const unsubscribe = onSnapshot(orgsQuery, (snapshot) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('Dashboard snapshot refresh:', snapshot.size, 'orgs');
        loadDashboardData(snapshot); // ✅ pass snapshot in
      }, 250);
    }, (err) => {
      console.error("Dashboard snapshot error:", err);
      renderError('superContent-dashboard', 'Dashboard listener failed: ' + err.message, 'window.refreshDashboard');
    });
    
    // Store unsubscribe function for cleanup
    window.__dashboardUnsubscribe = unsubscribe;
    
  } catch(e) {
    console.error('Dashboard init error:', e);
    renderError('superContent-dashboard', 'Dashboard init failed: ' + e.message, 'window.refreshDashboard');
  }
}

/**
 * Refresh dashboard data
 */
export async function refreshDashboard() {
  try {
    await loadDashboardData();
    showToast('Dashboard refreshed', 'success');
  } catch(e) {
    console.error('Dashboard refresh error:', e);
    showToast('Failed to refresh dashboard', 'error');
  }
}

/**
 * Load all dashboard data and render
 * ✅ If snapshot is provided, we NEVER call getDocs().
 */
export async function loadDashboardData(snapshot = null) {
  const el = document.getElementById('superContent-dashboard');
  if (!el) return;
  
  try {
    // Show minimal loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'position:absolute;top:10px;right:10px;color:#00eaff;font-size:12px;';
    loadingDiv.innerHTML = '<i class="fas fa-sync fa-spin"></i> Updating...';
    
    // Only show loading overlay if dashboard is completely empty
    if (!el.innerHTML || el.innerHTML.includes('Loading Live Dashboard')) {
      showQuickLoading('superContent-dashboard', 'Loading Live Dashboard');
    } else {
      el.style.position = 'relative';
      el.appendChild(loadingDiv);
    }
    
    // ✅ Build orgs from snapshot if available
    let orgs = [];
    if (snapshot) {
      snapshot.forEach(d => orgs.push({ id: d.id, ...d.data() }));
    } else {
      // fallback (should rarely happen)
      const orgsSnap = await getDocs(collection(db, 'organizations'));
      orgsSnap.forEach(d => orgs.push({ id: d.id, ...d.data() }));
    }
    
    // Calculate metrics
    const metrics = calculateDashboardMetrics(orgs);
    
    // Render dashboard
    let html = renderDashboardHeader(metrics);
    html += renderDashboardStats(metrics);
    html += renderDashboardCharts(orgs);
    html += renderDashboardTables(orgs, metrics);
    
    el.innerHTML = html;
    
    // Add interactive listeners
    setupDashboardInteractions();
    
    // Load guidance analytics asynchronously
    loadGuidanceAnalytics();
    
    console.log('Dashboard loaded:', orgs.length, 'organizations');
    
  } catch(e) {
    console.error('Error loading dashboard:', e);
    renderError('superContent-dashboard', 'Error loading dashboard: ' + e.message, 'window.refreshDashboard');
  }
}

/**
 * Calculate dashboard metrics from org data
 */
function calculateDashboardMetrics(orgs) {
  const now = new Date();
  const timeFilter = window.dashboardTimeFilter || '24h';
  
  let startTime = new Date();
  if (timeFilter === '24h') startTime.setHours(startTime.getHours() - 24);
  else if (timeFilter === '7d') startTime.setDate(startTime.getDate() - 7);
  else if (timeFilter === '30d') startTime.setDate(startTime.getDate() - 30);
  else startTime = new Date('1970-01-01');
  
  let totalOrgs = orgs.length;
  let activeElections = 0;
  let scheduledElections = 0;
  let declaredElections = 0;
  let totalVoters = 0;
  let totalVotes = 0;
  let approvedElections = 0;
  let pendingApprovals = 0;
  let rejectedElections = 0;
  let avgParticipation = 0;
  let electionList = [];
  
  orgs.forEach(org => {
    if (!org.isDeleted) {
      const status = org.electionStatus || 'active';
      const voters = org.voterCount || 0;
      const votes = org.voteCount || 0;
      
      totalVoters += voters;
      totalVotes += votes;
      
      if (status === 'active') activeElections++;
      else if (status === 'scheduled') scheduledElections++;
      else if (status === 'declared') declaredElections++;
      
      const approval = org.approval?.status;
      if (approval === 'approved') approvedElections++;
      else if (approval === 'pending') pendingApprovals++;
      else if (approval === 'rejected') rejectedElections++;
      
      electionList.push({
        id: org.id,
        name: org.name,
        status,
        voters,
        votes,
        participation: voters ? Math.round((votes / voters) * 100) : 0,
        approval: approval || 'pending',
        createdAt: org.createdAt || new Date().toISOString()
      });
    }
  });
  
  avgParticipation = totalVoters > 0 ? Math.round((totalVotes / totalVoters) * 100) : 0;
  
  return {
    totalOrgs,
    activeElections,
    scheduledElections,
    declaredElections,
    totalVoters,
    totalVotes,
    approvedElections,
    pendingApprovals,
    rejectedElections,
    avgParticipation,
    electionList,
    lastUpdated: new Date().toLocaleTimeString()
  };
}

/**
 * Load guidance analytics from Firestore
 * Shows how many users viewed guidance before logging in
 */
async function loadGuidanceAnalytics() {
  try {
    const snap = await getDocs(collection(db, "meta", "analytics", "guidance_views"));

    let total = 0, gateway = 0, ec = 0, voter = 0;

    snap.forEach(d => {
      total++;
      const src = d.data().source;
      if (src === 'gateway') gateway++;
      if (src === 'ec-login') ec++;
      if (src === 'voter-login') voter++;
    });

    // Update UI elements
    document.getElementById('guidanceTotal').textContent = total;
    document.getElementById('guidanceGateway').textContent = gateway;
    document.getElementById('guidanceEC').textContent = ec;
    document.getElementById('guidanceVoter').textContent = voter;
  } catch (e) {
    console.error('Error loading guidance analytics:', e);
    // Show 0s on error
    document.getElementById('guidanceTotal').textContent = '0';
    document.getElementById('guidanceGateway').textContent = '0';
    document.getElementById('guidanceEC').textContent = '0';
    document.getElementById('guidanceVoter').textContent = '0';
  }
}

/**
 * Render dashboard header with time filters
 */
function renderDashboardHeader(metrics) {
  return `
    <div class="dashboard-header" style="
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:20px;
      margin-bottom:20px;
    ">
      <div>
        <h3 style="margin:0">Global Dashboard</h3>
        <p class="subtext">Live overview of elections and voting activity</p>
        <p class="subtext" style="margin-top:4px"><i class="fas fa-clock"></i> Updated: ${metrics.lastUpdated}</p>
      </div>

      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge success">
          <i class="fas fa-sync"></i> Live
        </span>
        <button class="btn neon-btn-outline" onclick="refreshDashboard()">
          <i class="fas fa-rotate"></i>
        </button>
      </div>
    </div>
    <div style="display:none">
        <div style="display:flex;gap:8px;align-items:center">
          <span class="subtext">Time Range:</span>
          <button class="btn neon-btn-outline time-filter-btn ${!window.dashboardTimeFilter || window.dashboardTimeFilter === '24h' ? 'active' : ''}" onclick="window.setDashboardTimeFilter('24h', event)">24h</button>
          <button class="btn neon-btn-outline time-filter-btn ${window.dashboardTimeFilter === '7d' ? 'active' : ''}" onclick="window.setDashboardTimeFilter('7d', event)">7d</button>
          <button class="btn neon-btn-outline time-filter-btn ${window.dashboardTimeFilter === '30d' ? 'active' : ''}" onclick="window.setDashboardTimeFilter('30d', event)">30d</button>
          <button class="btn neon-btn-outline time-filter-btn ${window.dashboardTimeFilter === 'all' ? 'active' : ''}" onclick="window.setDashboardTimeFilter('all', event)">All</button>
          <button class="btn neon-btn" onclick="window.refreshDashboard()" title="Refresh Dashboard">
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>
      <div style="margin-top:10px;text-align:right">
        <span class="subtext"><i class="fas fa-clock"></i> Last updated: ${metrics.lastUpdated}</span>
      </div>
    </div>
  `;
}

/**
 * Render dashboard statistics cards
 */
function renderDashboardStats(metrics) {
  return `
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px">
      <!-- Total Organizations -->
      <div class="card" style="padding:20px;text-align:center">
        <div class="stat-icon" style="font-size:32px;color:#00eaff;margin-bottom:12px">
          <i class="fas fa-building"></i>
        </div>
        <div class="stat-value" style="font-size:36px;font-weight:bold;color:#fff;margin-bottom:4px">${metrics.totalOrgs}</div>
        <div class="stat-label subtext">Total Organizations</div>
      </div>
      
      <!-- Active Elections -->
      <div class="card" style="padding:20px;text-align:center">
        <div class="stat-icon" style="font-size:32px;color:#0f0;margin-bottom:12px">
          <i class="fas fa-vote-yea"></i>
        </div>
        <div class="stat-value" style="font-size:36px;font-weight:bold;color:#fff;margin-bottom:4px">${metrics.activeElections}</div>
        <div class="stat-label subtext">Active Elections</div>
      </div>
      
      <!-- Scheduled Elections -->
      <div class="card" style="padding:20px;text-align:center">
        <div class="stat-icon" style="font-size:32px;color:#ffa500;margin-bottom:12px">
          <i class="fas fa-calendar-alt"></i>
        </div>
        <div class="stat-value" style="font-size:36px;font-weight:bold;color:#fff;margin-bottom:4px">${metrics.scheduledElections}</div>
        <div class="stat-label subtext">Scheduled Elections</div>
      </div>
      
      <!-- Declared Results -->
      <div class="card" style="padding:20px;text-align:center">
        <div class="stat-icon" style="font-size:32px;color:#ff00ff;margin-bottom:12px">
          <i class="fas fa-trophy"></i>
        </div>
        <div class="stat-value" style="font-size:36px;font-weight:bold;color:#fff;margin-bottom:4px">${metrics.declaredElections}</div>
        <div class="stat-label subtext">Declared Results</div>
      </div>
      
      <!-- Total Voters -->
      <div class="card" style="padding:20px;text-align:center">
        <div class="stat-icon" style="font-size:32px;color:#00eaff;margin-bottom:12px">
          <i class="fas fa-users"></i>
        </div>
        <div class="stat-value" style="font-size:36px;font-weight:bold;color:#fff;margin-bottom:4px">${metrics.totalVoters.toLocaleString()}</div>
        <div class="stat-label subtext">Total Voters</div>
      </div>
      
      <!-- Total Votes -->
      <div class="card" style="padding:20px;text-align:center">
        <div class="stat-icon" style="font-size:32px;color:#0f0;margin-bottom:12px">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-value" style="font-size:36px;font-weight:bold;color:#fff;margin-bottom:4px">${metrics.totalVotes.toLocaleString()}</div>
        <div class="stat-label subtext">Total Votes Cast</div>
      </div>
      
      <!-- Approved Elections -->
      <div class="card" style="padding:20px;text-align:center">
        <div class="stat-icon" style="font-size:32px;color:#0f0;margin-bottom:12px">
          <i class="fas fa-check-double"></i>
        </div>
        <div class="stat-value" style="font-size:36px;font-weight:bold;color:#fff;margin-bottom:4px">${metrics.approvedElections}</div>
        <div class="stat-label subtext">Approved Elections</div>
      </div>
      
      <!-- Average Participation -->
      <div class="card" style="padding:20px;text-align:center">
        <div class="stat-icon" style="font-size:32px;color:#ff00ff;margin-bottom:12px">
          <i class="fas fa-chart-line"></i>
        </div>
        <div class="stat-value" style="font-size:36px;font-weight:bold;color:#fff;margin-bottom:4px">${metrics.avgParticipation}%</div>
        <div class="stat-label subtext">Avg Participation</div>
      </div>
    </div>

    <!-- Guidance Analytics Widget -->
    <div class="card" style="margin-bottom:20px;padding:20px">
      <h4 style="margin:0 0 8px;color:#00eaff">
        <i class="fas fa-circle-info"></i>
        Guidance Views
      </h4>

      <div class="subtext" style="margin-bottom:16px">How many users viewed guidance before login</div>

      <div id="guidanceStatsContainer" style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="text-align:center;padding:12px;background:rgba(0,234,255,0.05);border-radius:8px;flex:1;min-width:120px">
          <div style="font-size:32px;font-weight:bold;color:#fff" id="guidanceTotal">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
          <div class="subtext">Total Views</div>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(0,234,255,0.05);border-radius:8px;flex:1;min-width:120px">
          <div style="font-size:24px;font-weight:bold;color:#00eaff" id="guidanceGateway">0</div>
          <div class="subtext">From Gateway</div>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(0,234,255,0.05);border-radius:8px;flex:1;min-width:120px">
          <div style="font-size:24px;font-weight:bold;color:#ffa500" id="guidanceEC">0</div>
          <div class="subtext">From EC Login</div>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(0,234,255,0.05);border-radius:8px;flex:1;min-width:120px">
          <div style="font-size:24px;font-weight:bold;color:#0f0" id="guidanceVoter">0</div>
          <div class="subtext">From Voter Login</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render dashboard charts
 */
function renderDashboardCharts(orgs) {
  // Simplified - no async needed, charts are future enhancement
  return `
    <div class="card" style="margin-bottom:20px;padding:20px">
      <h4 style="margin:0 0 16px;color:#00eaff"><i class="fas fa-chart-pie"></i> Election Analytics</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;text-align:center">
        <div>
          <div style="font-size:32px;color:#0f0;margin-bottom:8px"><i class="fas fa-check-circle"></i></div>
          <div style="font-size:24px;font-weight:bold;color:#fff">${orgs.filter(o => !o.isDeleted && o.electionStatus === 'active').length}</div>
          <div class="subtext">Active Elections</div>
        </div>
        <div>
          <div style="font-size:32px;color:#ffa500;margin-bottom:8px"><i class="fas fa-clock"></i></div>
          <div style="font-size:24px;font-weight:bold;color:#fff">${orgs.filter(o => !o.isDeleted && o.electionStatus === 'scheduled').length}</div>
          <div class="subtext">Scheduled</div>
        </div>
        <div>
          <div style="font-size:32px;color:#ff00ff;margin-bottom:8px"><i class="fas fa-trophy"></i></div>
          <div style="font-size:24px;font-weight:bold;color:#fff">${orgs.filter(o => !o.isDeleted && o.electionStatus === 'declared').length}</div>
          <div class="subtext">Declared Results</div>
        </div>
        <div>
          <div style="font-size:32px;color:#0f0;margin-bottom:8px"><i class="fas fa-thumbs-up"></i></div>
          <div style="font-size:24px;font-weight:bold;color:#fff">${orgs.filter(o => !o.isDeleted && o.approval?.status === 'approved').length}</div>
          <div class="subtext">Approved</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render dashboard tables
 */
function renderDashboardTables(orgs, metrics) {
  // Sort elections by participation rate (descending)
  const sortedElections = [...metrics.electionList].sort((a, b) => b.participation - a.participation);
  
  let html = `
    <div class="card" style="padding:20px">
      <h4 style="margin:0 0 16px;color:#00eaff"><i class="fas fa-list"></i> Elections Overview</h4>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Status</th>
              <th>Approval</th>
              <th>Voters</th>
              <th>Votes</th>
              <th>Participation</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  if (sortedElections.length === 0) {
    html += `
      <tr>
        <td colspan="7" style="text-align:center;padding:40px;color:#999">
          <i class="fas fa-inbox" style="font-size:48px;opacity:0.3;margin-bottom:16px;display:block"></i>
          No elections found
        </td>
      </tr>
    `;
  } else {
    sortedElections.forEach(election => {
      const statusColors = {
        active: 'color:#0f0',
        scheduled: 'color:#ffa500',
        declared: 'color:#ff00ff',
        ended: 'color:#999'
      };
      
      const approvalColors = {
        approved: 'color:#0f0',
        pending: 'color:#ffa500',
        rejected: 'color:#f00'
      };
      
      html += `
        <tr>
          <td><strong>${election.name || election.id}</strong></td>
          <td style="${statusColors[election.status] || ''}">${election.status.toUpperCase()}</td>
          <td style="${approvalColors[election.approval] || ''}">${election.approval.toUpperCase()}</td>
          <td>${election.voters.toLocaleString()}</td>
          <td>${election.votes.toLocaleString()}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;background:#1a1a2e;border-radius:4px;height:20px;overflow:hidden">
                <div style="background:linear-gradient(90deg,#00eaff,#ff00ff);height:100%;width:${election.participation}%;transition:width 0.3s"></div>
              </div>
              <span style="min-width:40px;text-align:right">${election.participation}%</span>
            </div>
          </td>
          <td>
            <button class="btn neon-btn-outline" onclick="window.viewOrgDetails('${election.id}')" style="padding:4px 12px;font-size:12px">
              <i class="fas fa-eye"></i> View
            </button>
          </td>
        </tr>
      `;
    });
  }
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Setup dashboard interaction listeners
 */
function setupDashboardInteractions() {
  // Add any specific event listeners here
  console.log('Dashboard interactions setup complete');
}

/**
 * Set dashboard time filter
 */
export function setDashboardTimeFilter(filter, event) {
  window.dashboardTimeFilter = filter;
  document.querySelectorAll('.time-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  }
  refreshDashboard();
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.initializeDashboard = initializeDashboard;
  window.refreshDashboard = refreshDashboard;
  window.setDashboardTimeFilter = setDashboardTimeFilter;
}
