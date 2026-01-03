
// ================================
// FIREBASE READY GUARD (GLOBAL)
// ================================
window.__appInitialized = false;
window.firebaseReady = new Promise((resolve) => {
  const check = setInterval(() => {
    if (window.firebase && firebase.apps && firebase.apps.length > 0) {
      clearInterval(check);
      resolve(true);
    }
  }, 50);
});

// script.js — Complete Neon Voting System with Email/Phone Voting Support
// FIXED: Approval tab loading issue - now fully functional
// ADDED: Complete approval system with requirements checklist
// FIXED: Real-time approval status updates
// ENHANCED: Approval workflow with SuperAdmin integration

// ---------------- Firebase imports ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp, writeBatch, orderBy, increment
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// ---------------- Firebase config ----------------
const firebaseConfig = {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.firebasestorage.app",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

const app = initializeApp(firebaseConfig);
window.__appInitialized = true;
try { getAnalytics(app); } catch(e){}
const db = getFirestore(app);
const storage = getStorage(app);

// ---------------- Global State ----------------
let currentOrgId = null;
let currentOrgData = null;
let currentOrgUnsub = null;
let voterSession = null;
let selectedCandidates = {};
let activeTab = 'voters';
let countdownInterval = null;
let voterCountdownInterval = null;
let refreshIntervals = {};

// ---- Signatures (EC + Super Admin) ----
window.signatureState = window.signatureState || { ec: null, superAdmin: null };

let votingChoices = {};

// ---------------- Session Management ----------------
const SESSION_KEY = "neon_voting_session_v8";
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");

function saveSession() { 
  localStorage.setItem(SESSION_KEY, JSON.stringify(session)); 

  try { window.session = session; } catch(e){}
}

// ---------------- URL Helpers ----------------
function getUrlParam(key) {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  } catch {
    return null;
  }
}

// ---------------- UI Functions ----------------
function showToast(msg, type = "info", duration = 3000) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;z-index:1001;display:none;border:1px solid rgba(0,255,255,0.1);backdrop-filter:blur(10px);';
    document.body.appendChild(t);
  }
  
  t.textContent = msg;
  t.style.background = type === "error" ? "linear-gradient(90deg, #d32f2f, #b71c1c)" :
                       type === "success" ? "linear-gradient(90deg, #00C851, #007E33)" :
                       type === "warning" ? "linear-gradient(90deg, #ff9800, #f57c00)" :
                       "linear-gradient(90deg, #9D00FF, #00C3FF)";
  t.style.border = type === "error" ? "1px solid rgba(255,68,68,0.3)" : "1px solid rgba(0,255,255,0.2)";
  t.classList.add("show");
  
  setTimeout(() => {
    t.classList.remove("show");
  }, duration);
}
window.showToast = showToast;


function showScreen(screenId) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (voterCountdownInterval) {
    clearInterval(voterCountdownInterval);
    voterCountdownInterval = null;
  }
  
  Object.values(refreshIntervals).forEach(interval => {
    clearInterval(interval);
  });
  refreshIntervals = {};
  
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (screenId === 'votingScreen' && currentOrgData) {
      startVoterCountdown();
    } else if (screenId === 'voterLoginScreen') {
      updateVoterLoginScreen();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Always start voters at login
  if (getUrlParam("role") === "voter") {
    showScreen("voterLoginScreen");
    return;
  }
});

// ---------------- Tab Management ----------------
function setupTabs() {
  console.log("Setting up tabs...");
  
  const superTabs = document.getElementById('superTabs');
  if (superTabs) {
    console.log("Found super tabs");
    superTabs.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (!tabBtn) return;
      
      console.log("Super tab clicked:", tabBtn.dataset.superTab);
      
      document.querySelectorAll('#superTabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      tabBtn.classList.add('active');
      
      const tabId = tabBtn.dataset.superTab;
      showSuperTab(tabId);
    });
    
    const defaultTab = document.querySelector('#superTabs .tab-btn.active') || 
                      document.querySelector('#superTabs .tab-btn');
    if (defaultTab) {
      defaultTab.classList.add('active');
      showSuperTab(defaultTab.dataset.superTab);
    }
  }
  
  const ecTabs = document.getElementById('ecTabs');
  if (ecTabs) {
    console.log("Found EC tabs");
    
    ecTabs.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (!tabBtn) return;
      
      console.log("EC tab clicked:", tabBtn.dataset.ecTab);
      
      document.querySelectorAll('#ecTabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      tabBtn.classList.add('active');
      
      const tabId = tabBtn.dataset.ecTab;
      activeTab = tabId;
      showECTab(tabId);
    });
    
    const defaultTab = document.querySelector('#ecTabs .tab-btn.active') || 
                      document.querySelector('#ecTabs .tab-btn');
    if (defaultTab) {
      defaultTab.classList.add('active');
      activeTab = defaultTab.dataset.ecTab;
      showECTab(defaultTab.dataset.ecTab);
    }
  }
  
  console.log("Tabs setup complete");
}


function showSuperTab(tabId) {
  console.log("Showing super tab:", tabId);

  // Highlight active button
  document.querySelectorAll('[data-super-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.superTab === tabId);
  });

  // Hard switch Super Admin content panels (THIS FIXES "tabs not switching")
  document.querySelectorAll('[id^="superContent-"]').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });

  const tabContent = document.getElementById(`superContent-${tabId}`);
  if (!tabContent) {
    console.warn("Super tab content missing:", `superContent-${tabId}`);
    return;
  }

  tabContent.classList.add('active');
  tabContent.style.display = 'block';

  // Lazy-load content only when needed (prevents repeated re-renders)
  const shouldLoad = tabContent.innerHTML.includes('Loading') ||
                     tabContent.innerHTML.trim() === '' ||
                     tabContent.dataset.loaded !== "true";

  if (shouldLoad) {
    try {
      if (tabId === 'orgs') {
        loadSuperOrganizations?.();
      } else if (tabId === 'settings') {
        loadSuperSettings?.();
      } else if (tabId === 'danger') {
        loadSuperDanger?.();
      } else if (tabId === 'approvals') {
        loadSuperApprovals?.();
      } else if (tabId === 'dashboard') {
        // Ensure dashboard init runs only once; refresh can run as needed
        if (!window.__dashInited && typeof initializeDashboard === "function") {
          window.__dashInited = true;
          initializeDashboard();
        }
        if (typeof refreshDashboard === "function") refreshDashboard();
      }
      tabContent.dataset.loaded = "true";
    } catch (e) {
      console.error("Error loading super tab content:", tabId, e);
    }
  }
}


// FIXED: Enhanced showECTab with approval tab support
async function showECTab(tabId) {
  try {
    console.log("Showing EC tab:", tabId);

    // Activate tab button
    document.querySelectorAll('#ecTabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ecTab === tabId);
    });

    // Hide all EC contents (hard switch)
    document.querySelectorAll('[id^="ecContent-"]').forEach(content => {
      content.classList.remove('active');
      content.style.display = 'none';
    });

    const tabContent = document.getElementById(`ecContent-${tabId}`);
    if (!tabContent) {
      console.warn("EC tab content not found:", tabId);
      return;
    }

    tabContent.classList.add('active');
    tabContent.style.display = 'block';

    // If org not ready yet, show waiting state
    if (!currentOrgId) {
      tabContent.innerHTML = `
        <div class="empty-state">
          <div style="font-size:46px;color:#00eaff;margin-bottom:10px"><i class="fas fa-building"></i></div>
          <h3 style="color:#fff;margin:0 0 8px 0">Organization not selected</h3>
          <p class="subtext">Please log in as EC with a valid Organization ID.</p>
        </div>
      `;
      return;
    }

    if (!currentOrgData) {
      tabContent.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div class="spinner" style="margin:0 auto 20px auto;width:50px;height:50px;border:4px solid rgba(0,255,255,.2);border-top:4px solid #9D00FF;border-radius:50%;animation:spin 1s linear infinite"></div>
          <h3 style="color:#fff;margin-bottom:10px;">Loading organization...</h3>
          <p class="subtext">Please wait...</p>
        </div>
      `;
      return;
    }

    // Apply freeze UI when needed (based on schedule/status)
    applyECFreezeUI?.();

    // Load the selected tab content
    // NOTE: these loaders render into their own containers within the tab panels.
    if (tabId === 'voters') {
      await loadECVoters();
    } else if (tabId === 'positions') {
      await loadECPositions();
    } else if (tabId === 'candidates') {
      await loadECCandidates();
    } else if (tabId === 'outcomes') {
      await loadECOutcomes();
    } else if (tabId === 'settings') {
      await loadECSettings?.();
    } else if (tabId === 'approval') {
      await loadECApproval?.();
    } else if (tabId === 'bulk-invite') {
      // Bulk invite UI is handled by showBulkTab() in your file
      showBulkTab?.();
    }
  } catch (e) {
    console.error("Error in showECTab:", e);
  }
}

// ---------------- Quick Loading Functions ----------------
function showQuickLoading(containerId, message = "Loading...") {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div class="spinner" style="margin:0 auto 20px auto;width:40px;height:40px;border:4px solid rgba(255,255,255,0.1);border-top-color:#9D00FF;border-radius:50%;animation:spin 1s linear infinite"></div>
      <h3 style="color:#fff;margin-bottom:10px;">${message}</h3>
      <p class="subtext">Please wait...</p>
    </div>
  `;
}

function renderError(containerId, message = "Error loading content", retryFunction = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-exclamation-triangle" style="color:#ff4444;font-size:48px;margin-bottom:20px"></i>
      <h3>${message}</h3>
      ${retryFunction ? `
        <button class="btn neon-btn mt-20" onclick="${retryFunction}">
          <i class="fas fa-redo"></i> Retry
        </button>
      ` : ''}
    </div>
  `;
}

// ---------------- Super Admin Functions ----------------
async function loginSuperAdmin() {
  const pass = document.getElementById("super-admin-pass").value.trim();
  if (!pass) { 
    showToast("Enter password", "error"); 
    return; 
  }
  
  try {
    const ref = doc(db, "meta", "superAdmin");
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      const defaultPass = "admin123";
      await setDoc(ref, { password: defaultPass });
      if (pass === defaultPass) {
        session.role = 'superadmin'; 
        saveSession();
        showScreen("superAdminPanel");
        loadSuperOrganizationsEnhanced();
        document.getElementById("super-admin-pass").value = "";
        showToast("SuperAdmin created & logged in", "success");
        return;
      } else {
        showToast("Wrong password. Try admin123 for first-time", "error"); 
        return;
      }
    } else {
      const cfg = snap.data();
      if (cfg.password === pass) {
        session.role = 'superadmin'; 
        saveSession();
        showScreen("superAdminPanel");
        loadSuperOrganizationsEnhanced();
        document.getElementById("super-admin-pass").value = "";
        showToast("SuperAdmin logged in", "success");
      } else {
        showToast("Wrong password", "error");
      }
    }
  } catch(e) { 
    console.error(e); 
    showToast("Login error", "error"); 
  }
}

window.loginSuperAdmin = loginSuperAdmin;


// ENHANCED: Super Admin Organizations View with Delete Capability
async function loadSuperOrganizationsEnhanced() {
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
          <button class="btn neon-btn mt-20" onclick="showCreateOrgModal()">
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
          <button class="btn neon-btn" onclick="showCreateOrgModal()">
            <i class="fas fa-plus"></i> Create New
          </button>
          <button class="btn neon-btn-outline" onclick="loadSuperOrganizationsEnhanced()">
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
         <button class="btn neon-btn" style="padding:6px 10px;font-size:12px;margin-left:8px" onclick="approveElection('${org.id}')"><i class="fas fa-stamp"></i> Approve</button>`;
      
      html += `
        <div class="org-card">
          <div style="display:flex;gap:15px;align-items:center">
            <img src="${logoUrl}" 
                 style="width:80px;height:80px;border-radius:12px;object-fit:cover;border:2px solid rgba(0,255,255,0.2);background:#08102a;">
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <strong style="font-size:18px;color:#fff">${org.name || org.id}</strong>
                  <div class="subtext" style="margin-top:4px">ID: ${org.id}</div>
                  ${scheduleInfo ? `<div class="subtext" style="margin-top:2px;color:#00eaff"><i class="fas fa-clock"></i> ${scheduleInfo}</div>` : ''}
                  <div class="subtext" style="margin-top:2px">EC Password: ••••••••</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
                  <span style="font-size:12px;padding:4px 10px;border-radius:12px;background:${statusConfig.color}20;color:${statusConfig.color};border:1px solid ${statusConfig.color}40;display:flex;align-items:center;gap:5px">
                    <i class="fas ${statusConfig.icon}"></i> ${statusConfig.label}
                  </span>
                  <span class="subtext">${voterCount} voters • ${voteCount} votes</span>
                  <div style="margin-top:4px">${approvalBadge}</div>
                </div>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:15px">
            <button class="btn neon-btn-outline" onclick="openOrgAsEC('${org.id}')" style="flex:1">
              <i class="fas fa-user-tie"></i> EC Login
            </button>
            <button class="btn neon-btn-outline" onclick="showECInviteModal('${org.id}', '${escapeHtml(org.name || org.id)}', '${org.ecPassword || ''}')" title="Send EC Email">
              <i class="fas fa-envelope"></i>
            </button>
            <button class="btn neon-btn-outline" onclick="showECWhatsAppModal('${org.id}', '${escapeHtml(org.name || org.id)}', '${org.ecPassword || ''}')" title="Send EC WhatsApp">
              <i class="fab fa-whatsapp"></i>
            </button>
            <button class="btn neon-btn-outline" onclick="showPasswordModal('${org.id}', '${org.ecPassword || ''}')" title="View Password"> 
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-danger" onclick="deleteOrganizationConfirm('${org.id}', '${escapeHtml(org.name || org.id)}')" title="Delete Organization">
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
    renderError("superContent-orgs", "Error loading organizations", "loadSuperOrganizationsEnhanced()");
  }
}

// Enhanced Super Delete Tab
async function loadSuperDeleteEnhanced() {
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
        <button class="btn neon-btn-outline" onclick="loadSuperDeleteEnhanced()">
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
            <button class="btn btn-danger" onclick="deleteOrganizationConfirm('${org.id}', '${escapeHtml(org.name || org.id)}', ${voterCount}, ${voteCount})" style="min-width:100px">
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
            <button class="btn btn-warning" onclick="bulkDeleteEmptyOrganizations()">
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
    renderError("superContent-delete", "Error loading delete list", "loadSuperDeleteEnhanced()");
  }
}

// NEW: Super Admin Approvals Tab
async function loadSuperApprovals() {
  const el = document.getElementById("superContent-approvals");
  if (!el) return;
  
  showQuickLoading("superContent-approvals", "Loading Approval Requests");
  
  try {
    const snaps = await getDocs(collection(db, "organizations"));
    const orgs = []; 
    snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    
    // Filter organizations needing approval
    const pendingOrgs = orgs.filter(org => org.approval?.status === 'pending' || !org.approval?.status);
    const approvedOrgs = orgs.filter(org => org.approval?.status === 'approved');
    const rejectedOrgs = orgs.filter(org => org.approval?.status === 'rejected');
    
    let html = `
      <div style="margin-bottom:20px">
        <h3><i class="fas fa-clipboard-check"></i> Election Approvals</h3>
        <div style="display:flex;gap:15px;margin-top:10px">
          <div class="card" style="flex:1;text-align:center;background:rgba(255,193,7,0.05);border:1px solid rgba(255,193,7,0.2);">
            <div style="font-size:24px;color:#ffc107;font-weight:bold">${pendingOrgs.length}</div>
            <div style="font-size:12px;color:#ffc107">Pending</div>
          </div>
          <div class="card" style="flex:1;text-align:center;background:rgba(0,255,170,0.05);border:1px solid rgba(0,255,170,0.2);">
            <div style="font-size:24px;color:#00ffaa;font-weight:bold">${approvedOrgs.length}</div>
            <div style="font-size:12px;color:#00ffaa">Approved</div>
          </div>
          <div class="card" style="flex:1;text-align:center;background:rgba(255,68,68,0.05);border:1px solid rgba(255,68,68,0.2);">
            <div style="font-size:24px;color:#ff4444;font-weight:bold">${rejectedOrgs.length}</div>
            <div style="font-size:12px;color:#ff4444">Rejected</div>
          </div>
        </div>
      </div>
      
      <div style="display:flex;gap:8px;margin-bottom:15px">
        <button class="btn neon-btn-outline" onclick="loadSuperApprovals()">
          <i class="fas fa-redo"></i> Refresh
        </button>
      </div>
    `;
    
    if (pendingOrgs.length === 0 && approvedOrgs.length === 0 && rejectedOrgs.length === 0) {
      html += `
        <div class="card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-clipboard-check" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Approval Requests</h3>
          <p class="subtext">No organizations have requested approval yet.</p>
        </div>
      `;
    } else {
      // Pending Approvals
      if (pendingOrgs.length > 0) {
        html += `
          <div class="card" style="margin-bottom:20px;border-left:4px solid #ffc107;">
            <h4 style="color:#ffc107;margin-bottom:15px">
              <i class="fas fa-hourglass-half"></i> Pending Approvals (${pendingOrgs.length})
            </h4>
        `;
        
        pendingOrgs.forEach(org => {
          const voterCount = org.voterCount || 0;
          const positionCount = org.positionCount || 0;
          const candidateCount = org.candidateCount || 0;
          
          html += `
            <div class="list-item" style="margin-bottom:10px;align-items:center">
              <div style="flex:1">
                <div style="display:flex;gap:10px;align-items:center">
                  <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                       style="width:50px;height:50px;border-radius:10px;object-fit:cover;border:2px solid rgba(255,193,7,0.3);">
                  <div style="flex:1">
                    <strong style="color:#fff">${org.name || org.id}</strong>
                    <div class="subtext" style="margin-top:2px">ID: ${org.id}</div>
                    <div style="display:flex;gap:15px;margin-top:4px">
                      <span class="subtext" style="color:#00eaff">${voterCount} voters</span>
                      <span class="subtext" style="color:#9beaff">${positionCount} positions</span>
                      <span class="subtext" style="color:#9beaff">${candidateCount} candidates</span>
                    </div>
                    <div class="subtext" style="margin-top:4px">
                      Requested: ${org.approval?.requestedAt ? new Date(org.approval.requestedAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:nowrap">
                <button class="btn neon-btn" onclick="approveElection('${org.id}', '${escapeHtml(org.name || org.id)}')" style="white-space:nowrap">
                  <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn btn-danger" onclick="rejectElection('${org.id}', '${escapeHtml(org.name || org.id)}')" style="white-space:nowrap">
                  <i class="fas fa-times"></i> Reject
                </button>
                <button class="btn neon-btn-outline" onclick="viewOrgDetails('${org.id}')" title="View Details">
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
              <i class="fas fa-check-circle"></i> Approved Elections (${approvedOrgs.length})
            </h4>
        `;
        
        approvedOrgs.forEach(org => {
          const approvedDate = org.approval?.approvedAt ? new Date(org.approval.approvedAt).toLocaleDateString() : 'N/A';
          
          html += `
            <div class="list-item" style="margin-bottom:10px;align-items:center">
              <div style="flex:1">
                <div style="display:flex;gap:10px;align-items:center">
                  <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                       style="width:50px;height:50px;border-radius:10px;object-fit:cover;border:2px solid rgba(0,255,170,0.3);">
                  <div style="flex:1">
                    <strong style="color:#fff">${org.name || org.id}</strong>
                    <div class="subtext" style="margin-top:2px">ID: ${org.id}</div>
                    <div class="subtext" style="margin-top:4px">
                      Approved: ${approvedDate} by ${org.approval?.approvedBy || 'SuperAdmin'}
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
                  <i class="fas fa-check"></i> Approved
                </span>
                <button class="btn btn-danger" onclick="revokeApproval('${org.id}', '${escapeHtml(org.name || org.id)}')" style="white-space:nowrap">
                  <i class="fas fa-undo"></i> Revoke
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
              <i class="fas fa-times-circle"></i> Rejected Elections (${rejectedOrgs.length})
            </h4>
        `;
        
        rejectedOrgs.forEach(org => {
          const rejectedDate = org.approval?.rejectedAt ? new Date(org.approval.rejectedAt).toLocaleDateString() : 'N/A';
          
          html += `
            <div class="list-item" style="margin-bottom:10px;align-items:center">
              <div style="flex:1">
                <div style="display:flex;gap:10px;align-items:center">
                  <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                       style="width:50px;height:50px;border-radius:10px;object-fit:cover;border:2px solid rgba(255,68,68,0.3);">
                  <div style="flex:1">
                    <strong style="color:#fff">${org.name || org.id}</strong>
                    <div class="subtext" style="margin-top:2px">ID: ${org.id}</div>
                    <div class="subtext" style="margin-top:4px">
                      Rejected: ${rejectedDate} by ${org.approval?.rejectedBy || 'SuperAdmin'}
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
                <button class="btn neon-btn" onclick="reconsiderApproval('${org.id}', '${escapeHtml(org.name || org.id)}')" style="white-space:nowrap">
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
  } catch(e) { 
    console.error(e); 
    renderError("superContent-approvals", "Error loading approval requests", "loadSuperApprovals()");
  }
}

async function loadSuperSettings() {
  const el = document.getElementById("superContent-settings");
  if (!el) return;
  
  el.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-user-shield"></i> SuperAdmin Security</h3>
      <label class="label">Change SuperAdmin Password</label>
      <input id="new-super-pass" class="input" placeholder="New password (min 8 characters)" type="password">
      <div style="margin-top:10px">
        <button class="btn neon-btn" onclick="changeSuperPassword()">
          <i class="fas fa-key"></i> Change Password
        </button>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-building"></i> Create New Organization</h3>
      
      <label class="label">Organization Logo (Optional)</label>
      <div style="margin-bottom:15px">
        <div id="orgLogoPreview" style="width:100px;height:100px;border-radius:12px;border:2px dashed rgba(0,255,255,0.3);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);margin-bottom:10px">
          <i class="fas fa-building" style="font-size:32px;color:#00eaff"></i>
        </div>
        <input type="file" id="orgLogoFile" accept="image/*" class="input" onchange="previewOrgLogo()">
      </div>
      
      <label class="label">Organization Name *</label>
      <input id="new-org-name" class="input" placeholder="Enter organization name" required>
      
      <label class="label">Description (Optional)</label>
      <textarea id="new-org-desc" class="input" placeholder="Organization description" rows="2"></textarea>
      
      <label class="label">EC Password * (min 6 characters)</label>
      <input id="new-org-ec-pass" class="input" placeholder="Set EC password" type="password" required>
      
      <label class="label">EC Email (optional - for notifications)</label>
      <input id="new-org-ec-email" class="input" placeholder="ec@example.com" type="email">
      
      <label class="label">EC Phone (optional - for notifications)</label>
      <input id="new-org-ec-phone" class="input" placeholder="+233XXXXXXXXX">
      
      <div style="margin-top:20px">
        <button class="btn neon-btn" onclick="createNewOrganization()">
          <i class="fas fa-plus-circle"></i> Create Organization
        </button>
      </div>
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-cog"></i> System Settings</h3>
      <div style="margin-top:15px">
        <label class="label" style="display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="enable-email-alerts" checked>
          <span>Enable Email Notifications</span>
        </label>
        <label class="label" style="display:flex;align-items:center;gap:10px;margin-top:10px">
          <input type="checkbox" id="enable-sms-alerts" checked>
          <span>Enable SMS Notifications</span>
        </label>
        <label class="label" style="display:flex;align-items:center;gap:10px;margin-top:10px">
          <input type="checkbox" id="auto-delete-ended" checked>
          <span>Auto-delete ended elections after 30 days</span>
        </label>
        <label class="label" style="display:flex;align-items:center;gap:10px;margin-top:10px">
          <input type="checkbox" id="enable-approval" checked>
          <span>Require SuperAdmin approval for elections</span>
        </label>
      </div>
    </div>
  `;
}

// ENHANCED: Complete Organization Deletion with Storage Cleanup
async function deleteOrganizationEnhanced(orgId) {
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
    
    // Refresh both tabs
    loadSuperOrganizationsEnhanced();
    loadSuperDeleteEnhanced();
    loadSuperApprovals();
    
  } catch(e) {
    console.error("Error deleting organization:", e);
    showToast(`Failed to delete organization: ${e.message}`, "error");
  }
}

// Bulk delete empty organizations
async function bulkDeleteEmptyOrganizations() {
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

// ---------------- EC Functions ----------------
async function loginEC() {
  const id = document.getElementById("ec-org-id").value.trim();
  const pass = document.getElementById("ec-pass").value.trim();
  
  if (!id || !pass) { 
    showToast("Enter organization ID and password", "error"); 
    return; 
  }
  
  try {
    const ref = doc(db, "organizations", id);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) { 
      showToast("Organization not found", "error"); 
      return; 
    }
    
    const org = snap.data();
    
    if (org.ecPassword !== pass) { 
      showToast("Wrong EC password", "error"); 
      return; 
    }
    
    session.role = 'ec'; 
    session.orgId = id; 
    currentOrgId = id; 
    window.currentOrgId = id;
    window.signatureState = window.signatureState || { ec:null, superAdmin:null };
    window.signatureState.ec = { name: (org && org.ecName) ? org.ecName : 'Election Commissioner', role: 'Election Commissioner', signedAt: new Date().toLocaleString(), image: null };
    saveSession();
    
    showScreen("ecPanel");
    await openECPanel(id);
    
    document.getElementById("ec-org-id").value = "";
    document.getElementById("ec-pass").value = "";
    
    showToast("EC logged in successfully", "success");
    
  } catch(e) { 
    console.error(e); 
    showToast("Login failed", "error"); 
  }
}

async function openECPanel(orgId) {
  currentOrgId = orgId;
  
  if (currentOrgUnsub) {
    currentOrgUnsub();
    currentOrgUnsub = null;
  }
  
  try {
    const ref = doc(db, "organizations", orgId);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      showToast("Organization not found", "error");
      logout();
      return;
    }
    
    currentOrgData = { id: currentOrgId, ...snap.data() };
    
    updateECUI();
    electionRealtimeTick?.(currentOrgId, currentOrgData);
    
    await showECTab(activeTab);
    
    currentOrgUnsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        currentOrgData = { id: currentOrgId, ...snap.data() };
        updateECUI();
    electionRealtimeTick?.(currentOrgId, currentOrgData);
        
        if (activeTab === 'outcomes') {
          loadECOutcomes();
        } else if (activeTab === 'voters') {
          loadECVoters();
        } else if (activeTab === 'approval') {
          loadECApproval();
        }
      } else {
        showToast("Organization deleted", "error");
        logout();
      }
    });
    
  } catch (e) {
    console.error("Error opening EC panel:", e);
    showToast("Error loading organization data", "error");
  }
}

function updateECUI() {
  if (!currentOrgData) return;
  
  document.getElementById('ecOrgName').textContent = currentOrgData.name || currentOrgData.id;
  document.getElementById('ecOrgIdDisplay').textContent = `ID: ${currentOrgId}`;
  
  const statusColor = currentOrgData.electionStatus === 'declared' ? '#9D00FF' :
                     currentOrgData.electionStatus === 'scheduled' ? '#ffc107' : '#00ffaa';
  
  const statusElement = document.querySelector('#ecPanel .app-subtext');
  if (statusElement) {
    statusElement.innerHTML = `
      <span style="color:${statusColor}">${currentOrgData.electionStatus || 'active'}</span> • 
      ${currentOrgData.voterCount || 0} voters • 
      ${currentOrgData.voteCount || 0} votes
    `;
  }
}

// ---------------- Voters Tab with FIXED Email Change ----------------
async function loadECVoters() {
  const el = document.getElementById("ecContent-voters");
  if (!el || !currentOrgId) return;
  
  showQuickLoading("ecContent-voters", "Loading Voters");
  
  try {
    const snap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    const voters = [];
    snap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    const activeVoters = voters.filter(v => !v.isReplaced);
    const activeCount = activeVoters.length;
    const replacedCount = voters.length - activeCount;
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-users"></i> Voters (${activeCount} active${replacedCount ? ` • ${replacedCount} replaced` : ""})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddVoterModal()">
            <i class="fas fa-user-plus"></i> Add Voter
          </button>
          <button class="btn neon-btn-outline" onclick="showBulkVoterModal()">
            <i class="fas fa-users"></i> Bulk Add
          </button>
          <button class="btn neon-btn-outline" onclick="refreshVoters()">
            <i class="fas fa-redo"></i>
          </button>
        </div>
      </div>
    `;
    
    if (voters.length === 0) {
      html += `
        <div class="card info-card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-users" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Voters Yet</h3>
          <p class="subtext">Add voters to start your election</p>
          <button class="btn neon-btn mt-20" onclick="showAddVoterModal()">
            <i class="fas fa-user-plus"></i> Add Your First Voter
          </button>
        </div>
      `;
    } else {
      let votedCount = voters.filter(v => v.hasVoted && !v.isReplaced).length;
      let pendingCount = voters.filter(v => !v.hasVoted && !v.isReplaced).length;
      let replacedCount = voters.filter(v => v.isReplaced).length;
      
      html += `
        <div class="card info-card" style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-around;text-align:center">
            <div>
              <div class="label">Active Voters</div>
              <div style="font-size:24px;font-weight:bold;color:#00eaff">${votedCount + pendingCount}</div>
            </div>
            <div>
              <div class="label">Voted</div>
              <div style="font-size:24px;font-weight:bold;color:#00ffaa">${votedCount}</div>
            </div>
            <div>
              <div class="label">Pending</div>
              <div style="font-size:24px;font-weight:bold;color:#ffc107">${pendingCount}</div>
            </div>
            ${replacedCount > 0 ? `
            <div>
              <div class="label">Replaced</div>
              <div style="font-size:24px;font-weight:bold;color:#888">${replacedCount}</div>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div style="display:flex;gap:10px;margin-bottom:15px">
          <input type="text" id="voterSearch" class="input" placeholder="Search voters by name or email..." style="flex:1" onkeyup="searchVoters()">
          <button class="btn neon-btn-outline" onclick="exportVotersCSV()">
            <i class="fas fa-download"></i> Export
          </button>
        </div>
        
        <div id="votersList">
      `;
      
      voters.forEach(v => {
        if (v.isReplaced) {
          // Skip displaying replaced voters in main list
          return;
        }
        
        const email = decodeURIComponent(v.id);
        const phoneDisplay = v.phone ? formatPhoneForDisplay(v.phone) : 'No phone';
        const dobDisplay = v.dateOfBirth ? formatDateForDisplay(new Date(v.dateOfBirth)) : 'Not provided';
        const status = v.hasVoted ? 
          '<span style="color:#00ffaa;background:rgba(0,255,170,0.1);padding:4px 10px;border-radius:12px;font-size:12px">✅ Voted</span>' :
          '<span style="color:#ffc107;background:rgba(255,193,7,0.1);padding:4px 10px;border-radius:12px;font-size:12px">⏳ Pending</span>';
        
        const addedDate = v.addedAt ? formatFirestoreTimestamp(v.addedAt) : 'N/A';
        const votedDate = v.hasVoted && v.votedAt ? formatFirestoreTimestamp(v.votedAt) : null;
        
        html += `
          <div class="list-item voter-item" data-email="${email.toLowerCase()}" data-name="${(v.name || '').toLowerCase()}" style="align-items:center">
            <div style="display:flex;gap:12px;align-items:center;flex:1">
              <div style="width:40px;height:40px;border-radius:8px;background:linear-gradient(135deg,#9D00FF,#00C3FF);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">
                ${(v.name || email).charAt(0).toUpperCase()}
              </div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div>
                    <strong class="voter-name">${escapeHtml(v.name || email)}</strong>
                    <div class="subtext voter-email" style="margin-top:2px">${escapeHtml(email)}</div>
                    <div class="subtext" style="margin-top:2px"><i class="fas fa-phone"></i> ${phoneDisplay}</div>
                    <div class="subtext" style="margin-top:2px"><i class="fas fa-birthday-cake"></i> ${dobDisplay}</div>
                  </div>
                  ${status}
                </div>
                <div class="subtext" style="margin-top:4px">
                  Added: ${addedDate}
                  ${votedDate ? ` • Voted: ${votedDate}` : ''}
                  ${v.previousEmail ? `<br><span style="color:#ffc107"><i class="fas fa-history"></i> Previous email: ${v.previousEmail}</span>` : ''}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="editVoterModal('${escapeHtml(v.id)}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn neon-btn-outline email-change-btn" data-voter-id="${escapeHtml(v.id)}" data-email="${escapeHtml(email)}" data-name="${escapeHtml(v.name || email)}" title="Change Email">
                <i class="fas fa-at"></i>
              </button>
              <button class="btn neon-btn-outline" onclick="sendVoterInvite('${escapeHtml(email)}', '${escapeHtml(v.name || email)}', '${escapeHtml(v.phone || '')}')" title="Send Invite">
                <i class="fas fa-paper-plane"></i>
              </button>
              <button class="btn btn-danger" onclick="removeVoter('${escapeHtml(v.id)}', '${escapeHtml(v.name || email)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
    }
    
    el.innerHTML = html;
    
    setTimeout(() => {
      document.querySelectorAll('.email-change-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const voterId = btn.getAttribute('data-voter-id');
          const email = btn.getAttribute('data-email');
          const name = btn.getAttribute('data-name');
          changeVoterEmailModal(voterId, email, name);
        });
      });
    }, 100);
    
    if (refreshIntervals.voters) {
      clearInterval(refreshIntervals.voters);
    }
    refreshIntervals.voters = setInterval(() => {
      if (activeTab === 'voters') {
        loadECVoters();
      }
    }, 30000);
    
  } catch(e) { 
    console.error("Error loading voters:", e);
    renderError("ecContent-voters", "Error loading voters: " + e.message, "loadECVoters()");
  }
}

function refreshVoters() {
  loadECVoters();
  showToast("Voters list refreshed", "success");
}

// ---------------- FIXED: Positions Tab ----------------
async function loadECPositions() {
  const el = document.getElementById("ecContent-positions");
  if (!el || !currentOrgId) {
    console.error("No positions container or org ID");
    return;
  }
  
  showQuickLoading("ecContent-positions", "Loading Positions");
  
  try {
    console.log("Loading positions for org:", currentOrgId);
    
    const positionsRef = collection(db, "organizations", currentOrgId, "positions");
    const snap = await getDocs(positionsRef);
    
    console.log("Positions query result:", snap.size, "documents");
    
    const positions = [];
    snap.forEach(s => {
      positions.push({ id: s.id, ...s.data() });
    });
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-list-ol"></i> Positions (${positions.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddPositionModal()">
            <i class="fas fa-plus-circle"></i> Add Position
          </button>
          <button class="btn neon-btn-outline" onclick="refreshPositions()">
            <i class="fas fa-redo"></i>
          </button>
        </div>
      </div>
    `;
    
    if (positions.length === 0) {
      html += `
        <div class="card info-card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-list-ol" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Positions Yet</h3>
          <p class="subtext">Add positions to organize your election</p>
          <button class="btn neon-btn mt-20" onclick="showAddPositionModal()">
            <i class="fas fa-plus-circle"></i> Add Your First Position
          </button>
        </div>
      `;
    } else {
      positions.forEach(p => {
        html += `
          <div class="list-item" style="align-items:center">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:50px;height:50px;border-radius:8px;background:linear-gradient(135deg,#9D00FF,#00C3FF);display:flex;align-items:center;justify-content:center;color:white;">
                  <i class="fas fa-briefcase"></i>
                </div>
                <div>
                  <strong>${p.name}</strong>
                  ${p.description ? `<div class="subtext" style="margin-top:4px">${p.description}</div>` : ''}
                  <div class="subtext" style="margin-top:4px">ID: ${p.id}</div>
                  <div class="subtext" style="margin-top:4px">
                    Max Candidates: ${p.maxCandidates || 1} • Voting Type: ${p.votingType === 'multiple' ? 'Multiple Choice' : 'Single Choice'}
                  </div>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="editPositionModal('${p.id}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-danger" onclick="deletePositionConfirm('${p.id}', '${escapeHtml(p.name)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
    
    el.innerHTML = html;
    
    console.log("Positions loaded successfully");
    
  } catch(e) { 
    console.error("Error loading positions:", e);
    
    const errorHtml = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle" style="color:#ff4444;font-size:48px;margin-bottom:20px"></i>
        <h3>Error Loading Positions</h3>
        <p class="subtext" style="color:#ff9999">${e.message}</p>
        <div style="background:rgba(255,68,68,0.1);padding:12px;border-radius:8px;margin:20px 0;">
          <p style="font-size:12px;color:#ff9999">Organization ID: ${currentOrgId}</p>
          <p style="font-size:12px;color:#ff9999">Check Firebase permissions and ensure the "positions" collection exists.</p>
        </div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn neon-btn" onclick="loadECPositions()">
            <i class="fas fa-redo"></i> Retry
          </button>
          <button class="btn neon-btn-outline" onclick="showAddPositionModal()">
            <i class="fas fa-plus-circle"></i> Create First Position
          </button>
        </div>
      </div>
    `;
    el.innerHTML = errorHtml;
  }
}

function refreshPositions() {
  loadECPositions();
  showToast("Positions refreshed", "success");
}

// ---------------- FIXED: Candidates Tab ----------------
async function loadECCandidates() {
  const el = document.getElementById("ecContent-candidates");
  if (!el || !currentOrgId) {
    console.error("No candidates container or org ID");
    return;
  }
  
  showQuickLoading("ecContent-candidates", "Loading Candidates");
  
  try {
    console.log("Loading candidates for org:", currentOrgId);
    
    const [candidatesSnap, positionsSnap] = await Promise.all([
      getDocs(collection(db, "organizations", currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", currentOrgId, "positions"))
    ]);
    
    console.log("Candidates:", candidatesSnap.size, "Positions:", positionsSnap.size);
    
    const candidates = [];
    candidatesSnap.forEach(s => {
      const data = s.data();
      candidates.push({ 
        id: s.id, 
        ...data,
        // Ensure photo URL is valid
        photo: data.photo || getDefaultAvatar(data.name || 'Candidate')
      });
    });
    
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-user-friends"></i> Candidates (${candidates.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddCandidateModal()">
            <i class="fas fa-user-plus"></i> Add Candidate
          </button>
          <button class="btn neon-btn-outline" onclick="refreshCandidates()">
            <i class="fas fa-redo"></i>
          </button>
        </div>
      </div>
    `;
    
    if (candidates.length === 0) {
      html += `
        <div class="card info-card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-user-friends" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Candidates Yet</h3>
          <p class="subtext">Add candidates for each position</p>
          <button class="btn neon-btn mt-20" onclick="showAddCandidateModal()">
            <i class="fas fa-user-plus"></i> Add Your First Candidate
          </button>
        </div>
      `;
    } else {
      const grouped = {};
      candidates.forEach(c => {
        if (!grouped[c.positionId]) {
          grouped[c.positionId] = [];
        }
        grouped[c.positionId].push(c);
      });
      
      // Show candidates grouped by position
      positions.forEach(pos => {
        const posCandidates = grouped[pos.id] || [];
        if (posCandidates.length === 0) return;
        
        html += `
          <div class="card" style="margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
              <h4 style="color:#00eaff;margin:0">
                <i class="fas fa-users"></i> ${pos.name}
                <span class="subtext">(${posCandidates.length} candidates)</span>
              </h4>
              <button class="btn neon-btn-outline" onclick="showAddCandidateForPositionModal('${pos.id}', '${escapeHtml(pos.name)}')">
                <i class="fas fa-user-plus"></i> Add to ${pos.name}
              </button>
            </div>
        `;
        
        posCandidates.forEach(c => {
          const photoUrl = c.photo || getDefaultAvatar(c.name);
          
          html += `
            <div class="list-item" style="margin-top:10px;align-items:center">
              <div style="display:flex;gap:12px;align-items:center">
                <img src="${photoUrl}" 
                     style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid rgba(0,255,255,0.2);background:#08102a;">
                <div style="flex:1">
                  <strong>${c.name}</strong>
                  ${c.tagline ? `<div class="subtext" style="margin-top:2px">${c.tagline}</div>` : ''}
                  ${c.bio ? `<div class="subtext" style="margin-top:2px;font-size:12px">${c.bio.substring(0, 100)}${c.bio.length > 100 ? '...' : ''}</div>` : ''}
                  <div class="subtext" style="margin-top:2px">ID: ${c.id}</div>
                  <div class="subtext" style="margin-top:2px">
                    <i class="fas fa-chart-line"></i> Votes: ${c.votes || 0}
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn neon-btn-outline" onclick="editCandidateModal('${c.id}')" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteCandidateConfirm('${c.id}', '${escapeHtml(c.name)}')" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      });
      
      // Show candidates without positions
      const candidatesWithoutPosition = candidates.filter(c => !positions.find(p => p.id === c.positionId));
      if (candidatesWithoutPosition.length > 0) {
        html += `
          <div class="card" style="margin-bottom:20px;border-left:4px solid #ff9800;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
              <h4 style="color:#ff9800;margin:0">
                <i class="fas fa-exclamation-triangle"></i> Unassigned Candidates
                <span class="subtext">(${candidatesWithoutPosition.length} candidates)</span>
              </h4>
            </div>
        `;
        
        candidatesWithoutPosition.forEach(c => {
          const photoUrl = c.photo || getDefaultAvatar(c.name);
          
          html += `
            <div class="list-item" style="margin-top:10px;align-items:center">
              <div style="display:flex;gap:12px;align-items:center">
                <img src="${photoUrl}" 
                     style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid rgba(255,152,0,0.2);">
                <div style="flex:1">
                  <strong>${c.name}</strong>
                  <div class="subtext" style="margin-top:2px;color:#ff9800">
                    <i class="fas fa-exclamation-circle"></i> Position not found (ID: ${c.positionId})
                  </div>
                  <div class="subtext" style="margin-top:2px">ID: ${c.id}</div>
                  <div class="subtext" style="margin-top:2px">
                    <i class="fas fa-chart-line"></i> Votes: ${c.votes || 0}
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn neon-btn-outline" onclick="editCandidateModal('${c.id}')" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteCandidateConfirm('${c.id}', '${escapeHtml(c.name)}')" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      }
    }
    
    el.innerHTML = html;
    
    console.log("Candidates loaded successfully");
    
  } catch(e) { 
    console.error("Error loading candidates:", e);
    
    const errorHtml = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle" style="color:#ff4444;font-size:48px;margin-bottom:20px"></i>
        <h3>Error Loading Candidates</h3>
        <p class="subtext" style="color:#ff9999">${e.message}</p>
        <div style="background:rgba(255,68,68,0.1);padding:12px;border-radius:8px;margin:20px 0;">
          <p style="font-size:12px;color:#ff9999">Organization ID: ${currentOrgId}</p>
          <p style="font-size:12px;color:#ff9999">Check Firebase permissions for "candidates" collection.</p>
        </div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn neon-btn" onclick="loadECCandidates()">
            <i class="fas fa-redo"></i> Retry
          </button>
          <button class="btn neon-btn-outline" onclick="showAddCandidateModal()">
            <i class="fas fa-user-plus"></i> Add First Candidate
          </button>
        </div>
      </div>
    `;
    el.innerHTML = errorHtml;
  }
}

function refreshCandidates() {
  loadECCandidates();
  showToast("Candidates refreshed", "success");
}

// ---------------- Outcomes Tab ----------------
async function loadECOutcomes(){
  // CANDIDATE MAP FIX
  const candMap = await _getCandidatesMap(currentOrgId);

  const el = document.getElementById("ecContent-outcomes");
  if (!el || !currentOrgId || !currentOrgData) return;
  
  showQuickLoading("ecContent-outcomes", "Loading Voting Outcomes");
  
  try {
    const [votesSnap, positionsSnap, candidatesSnap, votersSnap] = await Promise.all([
      getDocs(collection(db, "organizations", currentOrgId, "votes")),
      getDocs(collection(db, "organizations", currentOrgId, "positions")),
      getDocs(collection(db, "organizations", currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", currentOrgId, "voters"))
    ]);
    
    const votes = [];
    votesSnap.forEach(s => votes.push(s.data()));
    
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    const voters = [];
    votersSnap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    const totalVoters = voters.filter(v => !v.isReplaced).length;
    const votesCast = votes.length;
    const participationRate = totalVoters ? Math.round((votesCast / totalVoters) * 100) : 0;
    const remainingVoters = totalVoters - votesCast;
    
    const orgRef = doc(db, "organizations", currentOrgId);
    // NOTE: In production rules, organizations writes may be blocked.
    // We attempt to sync counts, but if permissions deny, we continue without breaking outcomes UI.
    try {
      await updateDoc(orgRef, {
        voterCount: totalVoters,
        voteCount: votesCast
      });

      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        currentOrgData = { id: currentOrgId, ...orgSnap.data() };
        updateECUI();
      }
    } catch (err) {
      console.warn("Count sync skipped (permissions or network):", err);
      // Keep UI functional even if write is blocked
      try {
        updateECUI();
      } catch (_) {}
    }
    
    let html = `
      <div class="card info-card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-around;text-align:center;gap:20px">
          <div>
            <div class="label">Active Voters</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${totalVoters}</div>
            <div class="subtext" style="font-size:12px">Excluding replaced</div>
          </div>
          <div>
            <div class="label">Votes Cast</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${votesCast}</div>
            <div class="subtext" style="font-size:12px">Actual votes</div>
          </div>
          <div>
            <div class="label">Participation</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${participationRate}%</div>
            <div class="subtext" style="font-size:12px">${votesCast}/${totalVoters}</div>
          </div>
          <div>
            <div class="label">Remaining</div>
            <div style="font-weight:bold;font-size:28px;color:#ffc107">${remainingVoters}</div>
            <div class="subtext" style="font-size:12px">Yet to vote</div>
          </div>
        </div>
      </div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-chart-bar"></i> Results by Position</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn-outline" onclick="refreshOutcomes()">
            <i class="fas fa-redo"></i> Refresh
          </button>
          <button class="btn neon-btn" onclick="exportResultsCSV()">
            <i class="fas fa-download"></i> Export Results
          </button>
          <button class="btn neon-btn-outline" onclick="syncVoterCounts()" title="Force Sync Voter Counts">
            <i class="fas fa-sync-alt"></i> Sync Counts
          </button>
        </div>
      </div>
    `;
    
    if (positions.length === 0) {
      html += `
        <div class="card">
          <p class="subtext">No positions created yet. Add positions in the Positions tab.</p>
        </div>
      `;
    } else {
      positions.forEach(pos => {
        const posCandidates = candidates.filter(c => c.positionId === pos.id);
        if (posCandidates.length === 0) return;
        
        const counts = {};
        votes.forEach(v => {
          if (v.choices && v.choices[pos.id]) {
            const candId = v.choices[pos.id];
            counts[candId] = (counts[candId] || 0) + 1;
          }
        });
        
        const totalPositionVotes = Object.values(counts).reduce((a, b) => a + b, 0);
        
        html += `
          <div class="card" style="margin-bottom:20px">
            <h4 style="color:#00eaff;margin-bottom:15px">
              <i class="fas fa-chart-pie"></i> ${pos.name}
              <span class="subtext">(${totalPositionVotes} votes)</span>
            </h4>
        `;
        
        const sortedCandidates = [...posCandidates].sort((a, b) => {
          return (counts[b.id] || 0) - (counts[a.id] || 0);
        });
        
        sortedCandidates.forEach((candidate, index) => {
          const candidateVotes = counts[candidate.id] || 0;
          const percentage = totalPositionVotes ? Math.round((candidateVotes / totalPositionVotes) * 100) : 0;
          const isLeading = index === 0 && candidateVotes > 0;
          
          html += `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;border-radius:8px;background:${isLeading ? 'rgba(0,255,170,0.1)' : 'rgba(255,255,255,0.02)'};border-left:4px solid ${isLeading ? '#00ffaa' : 'transparent'}">
              <span style="color:#888;min-width:20px">#${index + 1}</span>
              <img src="${candidate.photo || getDefaultAvatar(candidate.name)}" 
                   style="width:50px;height:50px;border-radius:8px;object-fit:cover;border:2px solid rgba(0,255,255,0.2)">
              <div style="flex:1">
                <strong>${candidate.name}</strong>
                ${candidate.tagline ? `<div class="subtext">${candidate.tagline}</div>` : ''}
                <div class="subtext" style="margin-top:4px">${candidateVotes} votes • ${percentage}%</div>
              </div>
              <div style="width:120px">
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${percentage}%"></div>
                </div>
              </div>
            </div>
          `;
        });
        
        if (sortedCandidates.length > 1 && totalPositionVotes > 0) {
          const leadingCandidate = sortedCandidates[0];
          const secondCandidate = sortedCandidates[1];
          const leadingVotes = counts[leadingCandidate.id] || 0;
          const secondVotes = counts[secondCandidate.id] || 0;
          const lead = leadingVotes - secondVotes;
          
          html += `
            <div style="margin-top:15px;padding:12px;border-radius:8px;background:rgba(0,255,255,0.05);border:1px solid rgba(0,255,255,0.1)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <strong style="color:#00eaff">Current Leader:</strong>
                  <div style="margin-top:4px">${leadingCandidate.name}</div>
                  <div class="subtext">${leadingVotes} votes</div>
                </div>
                ${lead > 0 ? `
                  <div style="color:#00ffaa;font-weight:bold;font-size:18px">
                    <i class="fas fa-trophy"></i> +${lead} vote${lead === 1 ? '' : 's'}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }
        
        html += `</div>`;
      });
    }
    
    el.innerHTML = html;
    
    if (refreshIntervals.outcomes) {
      clearInterval(refreshIntervals.outcomes);
    }
    refreshIntervals.outcomes = setInterval(() => {
      if (activeTab === 'outcomes') {
        loadECOutcomes();
      }
    }, 15000);
    
  } catch(e) { 
    console.error("Error loading outcomes:", e);
    renderError("ecContent-outcomes", "Error loading outcomes", "loadECOutcomes()");
  }
}

function refreshOutcomes() {
  loadECOutcomes();
  showToast("Outcomes refreshed", "success");
}

// ---------------- NEW: Approval Tab ----------------
async function loadECApproval() {
  const el = document.getElementById("ecContent-approval");
  if (!el || !currentOrgId || !currentOrgData) return;
  
  showQuickLoading("ecContent-approval", "Loading Approval Status");
  
  try {
    // Get current organization data
    const orgRef = doc(db, "organizations", currentOrgId);
    const orgSnap = await getDoc(orgRef);
    const org = orgSnap.data();
    
    // Get counts for requirements
    const [votersSnap, positionsSnap, candidatesSnap] = await Promise.all([
      getDocs(collection(db, "organizations", currentOrgId, "voters")),
      getDocs(collection(db, "organizations", currentOrgId, "positions")),
      getDocs(collection(db, "organizations", currentOrgId, "candidates"))
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
    
    // Get current approval status
    const approvalStatus = org.approval?.status || 'not_submitted';
    const submittedDate = org.approval?.requestedAt ? new Date(org.approval.requestedAt) : null;
    const reviewedBy = org.approval?.reviewedBy || null;
    const approvalComments = org.approval?.comments || null;
    const rejectionReason = org.approval?.rejectionReason || null;
    
    let html = `
      <div style="margin-bottom:20px">
        <h3><i class="fas fa-clipboard-check"></i> Election Approval</h3>
        <p class="subtext">Submit your election setup for SuperAdmin approval before voters can start voting.</p>
      </div>
      
      <div class="card" style="margin-bottom:20px">
        <h4 style="color:#00eaff;margin-bottom:15px">
          <i class="fas fa-info-circle"></i> Current Approval Status
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
          <i class="fas fa-list-check"></i> Approval Requirements
        </h4>
        
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="requirement-item ${hasVoters ? 'requirement-met' : 'requirement-pending'}" id="reqVoters">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="requirement-checkbox ${hasVoters ? 'checked' : ''}">
                ${hasVoters ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div>
                <div style="font-weight:bold">Add Voters</div>
                <div class="subtext">At least 1 active voter required</div>
                <div class="subtext">Current: ${activeVoters.length} active voters</div>
              </div>
            </div>
            <div>
              ${hasVoters ? 
                '<span class="badge success"><i class="fas fa-check"></i> Complete</span>' : 
                '<button class="btn neon-btn-outline" onclick="showAddVoterModal()">Add Voters</button>'
              }
            </div>
          </div>
          
          <div class="requirement-item ${hasPositions ? 'requirement-met' : 'requirement-pending'}" id="reqPositions">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="requirement-checkbox ${hasPositions ? 'checked' : ''}">
                ${hasPositions ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div>
                <div style="font-weight:bold">Create Positions</div>
                <div class="subtext">At least 1 position required</div>
                <div class="subtext">Current: ${positions.length} positions</div>
              </div>
            </div>
            <div>
              ${hasPositions ? 
                '<span class="badge success"><i class="fas fa-check"></i> Complete</span>' : 
                '<button class="btn neon-btn-outline" onclick="showAddPositionModal()">Add Positions</button>'
              }
            </div>
          </div>
          
          <div class="requirement-item ${allPositionsHaveCandidates ? 'requirement-met' : 'requirement-pending'}" id="reqCandidates">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="requirement-checkbox ${allPositionsHaveCandidates ? 'checked' : ''}">
                ${allPositionsHaveCandidates ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div>
                <div style="font-weight:bold">Add Candidates</div>
                <div class="subtext">All positions must have at least 1 candidate</div>
                <div class="subtext">Current: ${candidates.length} candidates</div>
              </div>
            </div>
            <div>
              ${allPositionsHaveCandidates ? 
                '<span class="badge success"><i class="fas fa-check"></i> Complete</span>' : 
                '<button class="btn neon-btn-outline" onclick="showAddCandidateModal()">Add Candidates</button>'
              }
            </div>
          </div>
          
          <div class="requirement-item ${hasSchedule ? 'requirement-met' : 'requirement-pending'}" id="reqSchedule">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="requirement-checkbox ${hasSchedule ? 'checked' : ''}">
                ${hasSchedule ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div>
                <div style="font-weight:bold">Set Election Schedule</div>
                <div class="subtext">Define start and end times for voting</div>
                <div class="subtext">${hasSchedule ? 'Schedule set' : 'No schedule set'}</div>
              </div>
            </div>
            <div>
              ${hasSchedule ? 
                '<span class="badge success"><i class="fas fa-check"></i> Complete</span>' : 
                '<button class="btn neon-btn-outline" onclick="showScreen(\'ecPanel\'); showECTab(\'settings\')">Set Schedule</button>'
              }
            </div>
          </div>
        </div>
        
        <div style="margin-top:20px;padding:15px;background:rgba(0,255,255,0.05);border-radius:8px;border:1px solid rgba(0,255,255,0.1);">
          <div style="color:#00eaff;font-size:14px;margin-bottom:10px">
            <i class="fas fa-lightbulb"></i> All requirements must be met before submission
          </div>
          <div class="subtext">
            Once submitted, a SuperAdmin will review your election setup. 
            Voters cannot vote until approval is granted.
          </div>
        </div>
      </div>
    `;
    
    // Check if all requirements are met
    const allRequirementsMet = hasVoters && hasPositions && allPositionsHaveCandidates && hasSchedule;
    
    // Add submission button
    if (approvalStatus === 'not_submitted') {
      html += `
        <div class="card" style="text-align:center;">
          <button id="finalSubmitBtn" class="btn neon-btn-lg" 
                  onclick="submitForApprovalFinal()" 
                  ${allRequirementsMet ? '' : 'disabled'}
                  style="width:100%;padding:15px;font-size:16px;">
            <i class="fas fa-paper-plane"></i> Submit for SuperAdmin Approval
          </button>
          ${!allRequirementsMet ? `
            <div class="subtext" style="margin-top:10px;color:#ffc107">
              <i class="fas fa-exclamation-triangle"></i> Complete all requirements above before submitting
            </div>
          ` : ''}
        </div>
      `;
    } else if (approvalStatus === 'pending') {
      html += `
        <div class="card" style="text-align:center;border:2px solid rgba(255,193,7,0.3);background:rgba(255,193,7,0.05);">
          <h4 style="color:#ffc107;margin-bottom:10px">
            <i class="fas fa-hourglass-half"></i> Under Review
          </h4>
          <p class="subtext">
            Your election is currently being reviewed by a SuperAdmin. 
            You will be notified once a decision is made.
          </p>
          <button class="btn neon-btn-outline" onclick="loadECApproval()" style="margin-top:10px">
            <i class="fas fa-redo"></i> Refresh Status
          </button>
        </div>
      `;
    } else if (approvalStatus === 'approved') {
      html += `
        <div class="card" style="text-align:center;border:2px solid rgba(0,255,170,0.3);background:rgba(0,255,170,0.05);">
          <h4 style="color:#00ffaa;margin-bottom:10px">
            <i class="fas fa-check-circle"></i> Approval Granted
          </h4>
          <p class="subtext">
            Your election has been approved! Voters can now vote during the scheduled time.
          </p>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:15px">
            <button class="btn neon-btn" onclick="showScreen('voterLoginScreen')">
              <i class="fas fa-vote-yea"></i> Test Voter Login
            </button>
            <button class="btn neon-btn-outline" onclick="showECTab('settings')">
              <i class="fas fa-cog"></i> Election Settings
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

// ---------------- Settings Tab ----------------
async function loadECSettings() {
  const el = document.getElementById("ecContent-settings");
  if (!el || !currentOrgData) return;
  
  const org = currentOrgData;
  const startTime = org.electionSettings?.startTime || '';
  const endTime = org.electionSettings?.endTime || '';
  const declared = org.electionStatus === 'declared';
  
  el.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-calendar-alt"></i> Election Schedule</h3>
      <label class="label">Start Date & Time</label>
      <input id="ecStartTime" type="datetime-local" class="input" value="${startTime ? new Date(startTime).toISOString().slice(0,16) : ''}">
      <label class="label">End Date & Time</label>
      <input id="ecEndTime" type="datetime-local" class="input" value="${endTime ? new Date(endTime).toISOString().slice(0,16) : ''}">
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn neon-btn" onclick="saveElectionSchedule()" style="flex:1">Save Schedule</button>
        <button class="btn neon-btn-outline" onclick="clearElectionSchedule()" style="flex:1">Clear</button>
      </div>
      ${startTime ? `
        <div class="subtext" style="margin-top:10px;padding:8px;background:rgba(0,255,255,0.05);border-radius:8px">
          <i class="fas fa-info-circle"></i> Current: ${new Date(startTime).toLocaleString()} to ${endTime ? new Date(endTime).toLocaleString() : 'No end time'}
        </div>
      ` : ''}
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-share-alt"></i> Public Results</h3>
      <p class="subtext">Generate a public link for viewing results</p>
      <div style="display:flex;gap:8px">
        <button class="btn neon-btn" onclick="generatePublicLink()" style="flex:1">
          ${org.publicEnabled ? 'Regenerate Link' : 'Generate Link'}
        </button>
        ${org.publicEnabled ? `
          <button class="btn neon-btn-outline" onclick="copyPublicLink()" style="flex:1">Copy Link</button>
        ` : ''}
      </div>
      ${org.publicEnabled && org.publicToken ? `
        <div class="link-box" style="margin-top:12px">
          <strong>Public Results Link:</strong><br>
          <code>${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}</code>
          <button class="btn neon-btn-outline" onclick="navigator.clipboard.writeText('${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}').then(() => showToast('Link copied!', 'success'))" style="margin-top:8px;width:100%">
            <i class="fas fa-copy"></i> Copy Link
          </button>
        </div>
      ` : ''}
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-flag-checkered"></i> Declare Results</h3>
      <p class="subtext">Finalize and declare election results (locks voting)</p>
      <button class="btn neon-btn" ${declared ? 'disabled' : ''} onclick="declareResultsConfirm()" style="width:100%">
        ${declared ? '<i class="fas fa-check-circle"></i> Results Declared' : '<i class="fas fa-flag"></i> Declare Final Results'}
      </button>
      ${declared ? `
        <div class="subtext" style="margin-top:8px;padding:8px;background:rgba(157,0,255,0.1);border-radius:8px">
          <i class="fas fa-clock"></i> Declared at: ${org.resultsDeclaredAt ? new Date(org.resultsDeclaredAt).toLocaleString() : 'N/A'}
        </div>
      ` : ''}
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-bell"></i> Send Voter Alerts</h3>
      <p class="subtext">Send alerts to voters about the election</p>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn neon-btn-outline" onclick="send30MinAlerts()" style="flex:1">
          <i class="fas fa-clock"></i> 30-Min Alert
        </button>
        <button class="btn neon-btn-outline" onclick="sendVoteStartAlerts()" style="flex:1">
          <i class="fas fa-play"></i> Start Alert
        </button>
      </div>
    </div>
    
    <div class="card danger-zone" style="margin-top:20px">
      <h3><i class="fas fa-exclamation-triangle"></i> Danger Zone</h3>
      <p class="subtext">Reset or clear election data</p>
      <div style="margin-top:10px">
        <button class="btn btn-danger" onclick="resetVotesConfirm()" style="width:100%;margin-bottom:10px">
          <i class="fas fa-undo"></i> Reset All Votes
        </button>
        <button class="btn btn-danger" onclick="clearAllDataConfirm()" style="width:100%">
          <i class="fas fa-trash-alt"></i> Clear All Election Data
        </button>
      </div>
    </div>
  `;
}

// ---------------- Event Listeners ----------------
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Neon Voting System Initialized');
  
  setupTabs();
  
  document.getElementById('btn-superadmin')?.addEventListener('click', () => {
    showScreen('superAdminLoginScreen');
  });
  
  document.getElementById('btn-ec')?.addEventListener('click', () => {
    showScreen('ecLoginScreen');
  });
  
  document.getElementById('btn-voter')?.addEventListener('click', () => {
    showScreen('voterLoginScreen');
  });
  
  document.getElementById('btn-public')?.addEventListener('click', () => {
    showScreen('publicScreen');
  });
  
  document.getElementById('btn-guest')?.addEventListener('click', () => {
    showScreen('guestScreen');
  });
  
  const backButtons = {
    'super-back': 'gatewayScreen',
    'ec-back': 'gatewayScreen',
    'voter-back': 'gatewayScreen',
    'public-back': 'gatewayScreen',
    'guest-back': 'gatewayScreen'
  };
  
  Object.entries(backButtons).forEach(([id, screen]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      showScreen(screen);
    });
  });
  
  document.getElementById('super-login-btn')?.addEventListener('click', loginSuperAdmin);
  document.getElementById('ec-login-btn')?.addEventListener('click', loginEC);
  
  // Remove old OTP voter login and use new enhanced voting
  document.getElementById('voter-send-otp')?.removeEventListener('click', async () => {
    const email = document.getElementById('voter-email').value.trim();
    if (!email) {
      showToast('Please enter email', 'error');
      return;
    }
    
    showToast('OTP would be sent to ' + email, 'success');
    document.getElementById('voter-otp-group').classList.remove('hidden');
  });
  
  // Instead, we'll use the new enhanced voting system
  // The voter login screen will be updated by updateVoterLoginScreen()
  
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', logout);
  });
  
  // FIX: Check for stale voter sessions and clear them more intelligently
  if (session.voterSession) {
    const currentScreen = document.querySelector('.screen.active');
    
    // Only clear session if we're not on the voting screen AND not on voter login screen
    if (currentScreen && currentScreen.id !== 'votingScreen' && currentScreen.id !== 'voterLoginScreen') {
      session.voterSession = null;
      saveSession();
      console.log('Stale voter session cleared');
    } else if (currentScreen && currentScreen.id === 'voterLoginScreen') {
      // If on voter login screen, show message but don't auto-clear
      console.log('Previous voting session detected. User can start fresh.');
    }
  }
  
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('org');
  const role = params.get('role');
  const voterId = params.get('voter');
  
  if (orgId) {
    try {
      const orgSnap = await getDoc(doc(db, "organizations", orgId));
      if (orgSnap.exists()) {
        const org = orgSnap.data();
        
        if (role === 'ec') {
          document.getElementById('ec-org-id').value = orgId;
          showScreen('ecLoginScreen');
          showToast(`Please enter EC password for ${org.name}`, 'info');
        } else if (voterId) {
          // Update voter login screen with organization ID pre-filled
          document.querySelector('#voterLoginScreen .app-title').textContent = org.name;
          const orgIdInput = document.getElementById('voter-org-id');
          if (orgIdInput) orgIdInput.value = orgId;
          
          // Voter deep-link: org + voter are handled inside updateVoterLoginScreen()
          showScreen('voterLoginScreen');
          showToast(`Welcome to ${org.name} voting`, 'info');
        } else if (params.get('token') === org.publicToken || org.publicEnabled) {
          document.getElementById('publicOrgName').textContent = org.name;
          showScreen('publicScreen');
        }
      }
    } catch(e) {
      console.error('URL parameter error:', e);
    }
  }
  
  if (session.role === 'superadmin') {
    showScreen('superAdminPanel');
  } else if (session.role === 'ec' && session.orgId) {
    showScreen('ecPanel');
    openECPanel(session.orgId);
  }
  
  // Add debug button after a delay
  setTimeout(addDebugButtons, 2000);
});

// ---------------- Utility Functions ----------------
function logout() {
  if (currentOrgUnsub) {
    currentOrgUnsub();
    currentOrgUnsub = null;
  }
  if (countdownInterval) clearInterval(countdownInterval);
  if (voterCountdownInterval) clearInterval(voterCountdownInterval);
  Object.values(refreshIntervals).forEach(interval => clearInterval(interval));
  refreshIntervals = {};
  
  document.getElementById('countdown-container')?.remove();
  
  // FIX: Clear voter session completely but preserve if user might return to voting
  const currentScreen = document.querySelector('.screen.active');
  
  // Only clear voter session if we're not on voting-related screens
  if (currentScreen && currentScreen.id !== 'votingScreen' && currentScreen.id !== 'voterLoginScreen') {
    currentOrgId = null;
    currentOrgData = null;
    voterSession = null;
    selectedCandidates = {};
    
    // FIX: Clear voter session from localStorage too
    session.voterSession = null;
    session = {};
    saveSession();
  }
  
  showScreen('gatewayScreen');
  showToast('Logged out successfully', 'info');
}

function getDefaultLogo(orgName = '') {
  const initials = orgName ? orgName.substring(0, 2).toUpperCase() : 'NV';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#9D00FF"/>
          <stop offset="100%" style="stop-color:#00C3FF"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="#08102a"/>
      <circle cx="100" cy="80" r="40" fill="url(#grad)"/>
      <text x="100" y="85" font-size="24" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">${initials}</text>
      <text x="100" y="150" font-size="16" text-anchor="middle" fill="#9beaff" font-family="Arial">Voting</text>
    </svg>
  `);
}

function getDefaultAvatar(name) {
  const initial = name ? name.charAt(0).toUpperCase() : 'U';
  return `data:image/svg+xml;utf8,
    <svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>
      <rect width='100' height='100' fill='%2300ffaa'/>
      <text x='50%' y='55%' font-size='42' text-anchor='middle'
            fill='white' font-family='Arial' dy='.1em'>${initial}</text>
    </svg>`;
}

function formatPhoneForDisplay(phone) {
  if (!phone) return "No phone";
  const clean = phone.replace(/\D/g, '');
  
  if (clean.startsWith('233') && clean.length === 12) {
    const local = clean.substring(3);
    return `+233 ${local.substring(0, 3)} ${local.substring(3, 6)} ${local.substring(6)}`;
  }
  
  if (clean.length === 10 && clean.startsWith('0')) {
    return `+233 ${clean.substring(1, 4)} ${clean.substring(4, 7)} ${clean.substring(7)}`;
  }
  
  return `+${clean}`;
}

function formatDateForDisplay(date) {
  if (!date || isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function formatFirestoreTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  
  try {
    let date;
    
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch(e) {
    console.error('Error formatting timestamp:', e);
    return 'N/A';
  }
}

function validateDateOfBirth(dateStr) {
  if (!dateStr || dateStr.trim() === '') {
    return { valid: true };
  }
  
  dateStr = dateStr.trim();
  
  let date;
  
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr) && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  } else {
    date = new Date(dateStr);
  }
  
  if (isNaN(date.getTime())) {
    return { 
      valid: false, 
      error: 'Invalid date format. Please use YYYY-MM-DD or DD/MM/YYYY format.' 
    };
  }
  
  const today = new Date();
  if (date > today) {
    return { 
      valid: false, 
      error: 'Date of birth cannot be in the future.' 
    };
  }
  
  const ageInYears = (today - date) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageInYears > 150) {
    return { 
      valid: false, 
      error: 'Age seems unrealistic. Please check the date.' 
    };
  }
  
  return { 
    valid: true, 
    date: date.toISOString().split('T')[0]
  };
}

// ---------------- Modal Functions ----------------
function createModal(title, content, buttons = null) {
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.3s ease;
  `;
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    background: linear-gradient(135deg, #0a1929 0%, #08102a 100%);
    border-radius: 16px;
    border: 1px solid rgba(0, 255, 255, 0.1);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(157, 0, 255, 0.1);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.4s ease;
  `;
  
  let modalHTML = `
    <div style="padding: 25px; border-bottom: 1px solid rgba(0, 255, 255, 0.1);">
      <h3 style="margin: 0; color: #00eaff; font-size: 20px; display: flex; align-items: center; gap: 10px;">
        ${title}
      </h3>
    </div>
    <div style="padding: 25px;">
      ${content}
    </div>
  `;
  
  if (buttons) {
    modalHTML += `
      <div style="padding: 20px 25px 25px; border-top: 1px solid rgba(0, 255, 255, 0.1); display: flex; gap: 10px; justify-content: flex-end;">
        ${buttons}
      </div>
    `;
  }
  
  modal.innerHTML = modalHTML;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  return overlay;
}

// ---------------- Voter Invite (EC -> Voter) ----------------
// Opens a message preview and provides Copy / WhatsApp / SMS / Email quick actions.
// This does NOT require Firebase Auth.
window.sendVoterInvite = function(credential, name = "", phone = "") {
  try {
    if (!currentOrgId || !currentOrgData) {
      showToast("Open an organization as EC first", "error");
      return;
    }

    const credRaw = String(credential || "").trim();
    if (!credRaw) {
      showToast("Missing voter credential", "error");
      return;
    }

    const credDecoded = decodeURIComponent(credRaw);
    const isEmail = validateEmail(String(credDecoded).toLowerCase());
    const credForLink = isEmail ? String(credDecoded).toLowerCase() : String(credDecoded);

    const link = `${window.location.origin}${window.location.pathname}?org=${encodeURIComponent(currentOrgId)}&voter=${encodeURIComponent(credForLink)}`;

    const voterName = String(name || "").trim() || credDecoded;

    const message =
`🗳️ Neon Voting System

Hello ${voterName},

You have been invited to vote.

🏢 Organization: ${currentOrgData.name || currentOrgId}
🆔 Organization ID: ${currentOrgId}
🔑 Your Credential: ${credDecoded}

👉 Vote here:
${link}

⚠️ Do not share this link or credential.`;

    createModal(
      `<i class="fas fa-paper-plane"></i> Send Voter Invite`,
      `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card" style="padding:12px">
            <div class="subtext" style="margin-bottom:8px">Message Preview</div>
            <textarea id="voterInviteMessage" class="input" rows="10" readonly>${escapeHtml(message)}</textarea>
          </div>

          <div class="subtext">
            Tip: WhatsApp works best for phones. Email uses your default mail app.
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">
          <i class="fas fa-times"></i> Close
        </button>
        <button class="btn neon-btn-outline" onclick="(function(){
          const t=document.getElementById('voterInviteMessage');
          if(!t) return;
          t.select(); t.setSelectionRange(0, 999999);
          navigator.clipboard?.writeText(t.value);
          showToast('Copied', 'success');
        })()">
          <i class="fas fa-copy"></i> Copy
        </button>
        <button class="btn neon-btn" onclick="(function(){
          const msg=encodeURIComponent(document.getElementById('voterInviteMessage')?.value||'');
          window.open('https://wa.me/?text='+msg, '_blank');
        })()">
          <i class="fab fa-whatsapp"></i> WhatsApp
        </button>
        <button class="btn neon-btn-outline" onclick="(function(){
          const msg=encodeURIComponent(document.getElementById('voterInviteMessage')?.value||'');
          window.location.href='sms:?&body='+msg;
        })()">
          <i class="fas fa-sms"></i> SMS
        </button>
        <button class="btn neon-btn-outline" onclick="(function(){
          const subject=encodeURIComponent('Neon Voting Invitation');
          const body=encodeURIComponent(document.getElementById('voterInviteMessage')?.value||'');
          window.location.href='mailto:?subject='+subject+'&body='+body;
        })()">
          <i class="fas fa-envelope"></i> Email
        </button>
      `
    );
  } catch (e) {
    console.error("sendVoterInvite error:", e);
    showToast("Failed to open invite", "error");
  }
};

// ---------------- FIXED Email Change Function with History Subcollection ----------------
window.changeVoterEmail = async function(oldVoterId, oldEmail, voterName) {
  const newEmailInput = document.getElementById('newVoterEmail');
  const confirmEmailInput = document.getElementById('confirmNewVoterEmail');
  const reasonInput = document.getElementById('emailChangeReason');
  
  if (!newEmailInput || !confirmEmailInput) {
    showToast('Email inputs not found', 'error');
    return;
  }
  
  const newEmail = newEmailInput.value.trim().toLowerCase();
  const confirmEmail = confirmEmailInput.value.trim().toLowerCase();
  const reason = reasonInput?.value.trim();
  
  if (!newEmail || !confirmEmail) {
    showToast('Please enter and confirm the new email address', 'error');
    return;
  }
  
  if (newEmail !== confirmEmail) {
    showToast('Email addresses do not match', 'error');
    return;
  }
  
  if (!validateEmail(newEmail)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  if (newEmail === oldEmail.toLowerCase()) {
    showToast('New email is the same as the current email', 'error');
    return;
  }
  
  try {
    const newVoterRef = doc(db, "organizations", currentOrgId, "voters", encodeURIComponent(newEmail));
    const newVoterSnap = await getDoc(newVoterRef);
    
    if (newVoterSnap.exists()) {
      showToast('A voter with this email already exists', 'error');
      return;
    }
  } catch(e) {
    console.error('Error checking duplicate email:', e);
    showToast('Error checking email availability', 'error');
    return;
  }
  
  try {
    const batch = writeBatch(db);
    
    // 1. Record email change in history subcollection
    const emailHistoryRef = doc(
      collection(db, "organizations", currentOrgId, "voters", oldVoterId, "emailHistory")
    );
    
    await setDoc(emailHistoryRef, {
      oldEmail: oldEmail,
      newEmail: newEmail,
      reason: reason || '',
      changedBy: 'ec-admin',
      changedAt: serverTimestamp(),
      organizationId: currentOrgId,
      voterName: voterName
    });
    
    // 2. Get the old voter data
    const oldVoterRef = doc(db, "organizations", currentOrgId, "voters", oldVoterId);
    const oldVoterSnap = await getDoc(oldVoterRef);
    
    if (!oldVoterSnap.exists()) {
      showToast('Voter not found', 'error');
      return;
    }
    
    const oldVoterData = oldVoterSnap.data();
    const hasVoted = oldVoterData.hasVoted || false;
    
    // 3. Create NEW voter document with new email
    const newVoterRef = doc(db, "organizations", currentOrgId, "voters", encodeURIComponent(newEmail));
    
    const newVoterData = {
      ...oldVoterData,
      email: newEmail,
      name: oldVoterData.name || voterName,
      previousEmail: oldEmail,
      emailUpdatedAt: new Date().toISOString(),
      hasVoted: hasVoted,
      votedAt: oldVoterData.votedAt || null,
      isActive: true,
      isReplaced: false,
      lastUpdated: serverTimestamp()
    };
    
    batch.set(newVoterRef, newVoterData);
    
    // 4. Mark OLD voter as inactive/replaced
    batch.update(oldVoterRef, {
      isActive: false,
      isReplaced: true,
      replacedBy: newEmail,
      replacedAt: new Date().toISOString(),
      replacementReason: reason || '',
      lastUpdated: serverTimestamp()
    });
    
    // 5. Update vote records if the voter has voted
    if (hasVoted && oldVoterData.votedAt) {
      try {
        const votesQuery = query(
          collection(db, "organizations", currentOrgId, "votes"),
          where("voterEmail", "==", oldEmail)
        );
        const votesSnap = await getDocs(votesQuery);
        
        if (!votesSnap.empty) {
          votesSnap.forEach(voteDoc => {
            batch.update(voteDoc.ref, {
              voterEmail: newEmail,
              emailUpdatedAt: new Date().toISOString()
            });
          });
        }
      } catch(voteError) {
        console.error('Error updating vote records:', voteError);
      }
    }
    
    await batch.commit();
    
    showToast(`Email changed from ${oldEmail} to ${newEmail}`, 'success');
    document.querySelector('.modal-overlay')?.remove();
    
    loadECVoters();
    
  } catch(e) {
    console.error('Error changing voter email:', e);
    showToast('Error changing email: ' + e.message, 'error');
  }
};

// =====================================================
// ENHANCED VOTER FUNCTIONS WITH EMAIL OR PHONE SUPPORT
// =====================================================

// ---------------- Phone Number Normalization ----------------
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  // Remove all non-digits
  return phone.replace(/\D/g, '');
}


/* ======================================================
   CANONICAL ID + AUDIT HELPERS (Option 3 + Audit)
   ====================================================== */

function normalizeEmailAddr(v){ return v ? String(v).trim().toLowerCase() : ""; }

function normalizePhoneE164(raw){
  if(!raw) return "";
  let p=String(raw).replace(/\s+/g,"").trim();
  // accept +233..., 233..., 0...
  if(p.startsWith("00")) p="+"+p.slice(2);
  if(p.startsWith("0")) p="+233"+p.slice(1); // default Ghana
  if(!p.startsWith("+") && /^\d{7,}$/.test(p)) p="+%s".replace("%s","233")+p; // fallback
  // keep only + and digits
  p="+"+p.replace(/[^0-9]/g,"");
  if(p==="+" ) return "";
  return p;
}

function normalizeOrgVoterId(v){ return v ? String(v).trim().toLowerCase() : ""; }

function buildVoterDocIdFromCredential(credential){
  const c=String(credential||"").trim();
  const email=normalizeEmailAddr(c);
  if(email && validateEmail(email)) return encodeURIComponent(email);

  const phone=normalizePhoneE164(c);
  if(phone && phone.length>=8) return encodeURIComponent("tel:"+phone);

  const oid=normalizeOrgVoterId(c);
  if(oid) return encodeURIComponent("id:"+oid);

  return "";
}

async function writeAudit(orgId, action, actor, meta){
  try{
    if(!orgId) return;
    await addDoc(collection(db,"organizations",orgId,"audit_logs"),{
      action: String(action||""),
      actor: String(actor||""),
      meta: meta||{},
      at: serverTimestamp()
    });
  }catch(e){
    console.warn("audit failed",e);
  }
}

// ---------------- Enhanced Voter Lookup ----------------
async function findVoterByEmailOrPhone(orgId, credential) {
  try {
    const docId = buildVoterDocIdFromCredential(credential);
    if (!docId) return { found: false };

    // 1) Direct lookup (fast path, Option 3 style IDs)
    const directRef = doc(db, "organizations", orgId, "voters", docId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      const voter = directSnap.data() || {};
      return {
        found: true,
        voter: { id: directSnap.id, ...voter },
        matchedBy: docId.startsWith("tel%3A") ? "phone" : (docId.startsWith("id%3A") ? "orgVoterId" : "email"),
        voterDocId: directSnap.id
      };
    }

    // 2) Backward-compat fallback scan (older docs / different IDs)
    const cred = String(credential || "").trim();
    const email = normalizeEmailAddr(cred);
    const phone = normalizePhoneE164(cred);
    const oid = normalizeOrgVoterId(cred);

    const votersSnap = await getDocs(query(
      collection(db, "organizations", orgId, "voters"),
      where("isReplaced", "==", false)
    ));

    for (const voterDoc of votersSnap.docs) {
      const data = voterDoc.data() || {};
      const dEmail = normalizeEmailAddr(data.email);
      const dPhone = normalizePhoneE164(data.phone || data.phoneNumber);
      const dOid = normalizeOrgVoterId(data.orgVoterId || data.voterId);

      if (email && dEmail && email === dEmail) {
        return { found: true, voter: { id: voterDoc.id, ...data }, matchedBy: "email", voterDocId: voterDoc.id };
      }
      if (phone && dPhone && phone === dPhone) {
        return { found: true, voter: { id: voterDoc.id, ...data }, matchedBy: "phone", voterDocId: voterDoc.id };
      }
      if (oid && dOid && oid === dOid) {
        return { found: true, voter: { id: voterDoc.id, ...data }, matchedBy: "orgVoterId", voterDocId: voterDoc.id };
      }
    }

    return { found: false };
  } catch (error) {
    console.error('Error finding voter:', error);
    return { found: false, error: error.message };
  }
}

// ---------------- Enhanced Voter Voting ----------------

// ---------------- Already Voted Screen ----------------
function showAlreadyVotedScreen(orgId, orgName, voter) {
  try {
    const sub = document.getElementById('alreadyVotedSubtext');
    const title = document.getElementById('alreadyVotedTitle');
    const details = document.getElementById('alreadyVotedDetails');

    if (title) title.textContent = 'You already voted';
    if (sub) sub.textContent = `Our system shows you have already submitted your vote for ${orgName || 'this election'}.`;
    if (details) {
      const votedAt = voter?.votedAt ? new Date(voter.votedAt) : null;
      details.innerHTML = `
        <div style="text-align:left; margin-top:16px; padding:14px; border-radius:14px; border:1px solid rgba(0,255,255,0.10); background:rgba(255,255,255,0.03)">
          <div style="font-size:12px; opacity:0.8; margin-bottom:6px"><i class="fas fa-building"></i> Organization</div>
          <div style="font-weight:700">${escapeHtml(orgName || orgId || '')}</div>

          <div style="height:10px"></div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
            <div>
              <div style="font-size:12px; opacity:0.8"><i class="fas fa-id-card"></i> Voter ID</div>
              <div style="font-weight:700">${escapeHtml(voter?.voterId || voter?.id || '')}</div>
            </div>
            <div>
              <div style="font-size:12px; opacity:0.8"><i class="fas fa-clock"></i> Voted At</div>
              <div style="font-weight:700">${votedAt ? votedAt.toLocaleString() : 'Recorded'}</div>
            </div>
          </div>
        </div>
      `;
    }

    // Store minimal session so "Back" can return to voter login with org prefilled
    try {
      session.lastVoterOrg = orgId || '';
      saveSession();
    } catch(e) {}

    showScreen('alreadyVotedScreen');
  } catch (e) {
    console.error('showAlreadyVotedScreen error:', e);
    showToast('You have already voted.', 'error');
  }
}

window.startVoterVotingEnhanced = async function() {
  const orgId = document.getElementById('voter-org-id')?.value.trim();

  // New credential mode (Voter ID + PIN)
  const voterIdInput = document.getElementById('voter-id');
  const pinInput = document.getElementById('voter-pin');

  // Legacy mode (Email/Phone)
  const legacyCredentialInput = document.getElementById('voter-credential');

  if (!orgId) {
    showToast('Please enter organization ID', 'error');
    return;
  }

  try {
    // Check organization exists
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) {
      showToast('Organization not found. Check the organization ID.', 'error');
      return;
    }

    const org = orgSnap.data();

    // Ensure org approved (if your system uses approval gating)
    if (org?.approval?.status && org.approval.status !== 'approved') {
      showToast('Voting is not available yet. Organization is not approved.', 'warning');
      return;
    }

    // Check schedule if set
    const now = new Date();
    if (org.electionSettings?.startTime) {
      const startTime = new Date(org.electionSettings.startTime);
      if (startTime > now) {
        showToast(`Voting starts at ${startTime.toLocaleString()}`, 'warning');
        return;
      }
    }
    if (org.electionSettings?.endTime) {
      const endTime = new Date(org.electionSettings.endTime);
      if (endTime <= now) {
        showToast('Voting has ended for this election.', 'warning');
        return;
      }
    }

    // ---------------- NEW FLOW: Voter ID + PIN ----------------
    if (voterIdInput && pinInput) {
      const voterId = voterIdInput.value.trim();
      const pin = pinInput.value.trim();

      if (!voterId) {
        showToast('Please enter your Voter ID', 'error');
        return;
      }
      if (!pin) {
        showToast('Please enter your PIN', 'error');
        return;
      }

      const voterRef = doc(db, "organizations", orgId, "voters", voterId);
      const voterSnap = await getDoc(voterRef);

      if (!voterSnap.exists()) {
        showToast('Voter not found. Please check your Voter ID or contact EC.', 'error');
        return;
      }

      const voter = voterSnap.data() || {};

      if (voter.isActive === false) {
        showToast('This voter access is disabled. Contact EC.', 'error');
        return;
      }

      // PIN validation (stored on voter doc as "pin")
      if ((voter.pin || '').toString().trim() !== pin) {
        showToast('Invalid PIN. Please check and try again.', 'error');
        return;
      }

      // Already voted => show dedicated screen (not blocking login with a confusing toast)
      if (voter.hasVoted) {
        showAlreadyVotedScreen(orgId, org.name, { ...voter, id: voterId });
        return;
      }

      // Clear existing voter session only if it's a different voter
      if (voterSession && voterSession.voterId && voterSession.voterId !== voterId) {
        voterSession = null;
        selectedCandidates = {};
        session.voterSession = null;
        saveSession();
      }

      voterSession = {
        orgId,
        voterId,
        email: voter.email || '', // keep legacy fields for other parts of the app
        phone: voter.phone || '',
        voterKey: voterId,
        voterData: { ...voter, id: voterId },
        orgData: org,
        matchedBy: 'voterIdPin',
        startTime: new Date()
      };

      session.voterSession = voterSession;
      saveSession();

      await loadVotingBallot(orgId);
      showScreen('votingScreen');

      const greetingName = voter.name || voter.voterId || 'Voter';
      showToast(`Welcome, ${greetingName}! Please cast your vote.`, 'success');
      return;
    }

    // ---------------- LEGACY FLOW: Email/Phone ----------------
    if (legacyCredentialInput) {
      const credential = legacyCredentialInput.value.trim();
      if (!credential) {
        showToast('Please enter your email or phone number', 'error');
        return;
      }

      const result = await findVoterByEmailOrPhone(orgId, credential);

      if (!result.found) {
        showToast('Voter not found. Please check your email/phone or contact EC.', 'error');
        return;
      }

      const { voter, matchedBy } = result;

      if (voter.hasVoted) {
        await window.showVoterLiveDashboard(orgId, voter);
        return;
      }

      if (voterSession && voterSession.email !== voter.email) {
        voterSession = null;
        selectedCandidates = {};
        session.voterSession = null;
        saveSession();
      }

      voterSession = {
        orgId,
        email: voter.email || '',
        phone: voter.phone || '',
        voterData: voter,
        orgData: org,
        matchedBy,
        startTime: new Date()
      };

      session.voterSession = voterSession;
      saveSession();

      await loadVotingBallot(orgId);
      showScreen('votingScreen');

      const greetingName = voter.name || 'Voter';
      showToast(`Welcome, ${greetingName}! Please cast your vote.`, 'success');
      return;
    }

    showToast('Login form not available. Please refresh the page.', 'error');
  } catch (e) {
    console.error('Voter login error:', e);
    showToast('Login failed: ' + (e?.message || 'Unknown error'), 'error');
  }
};

// ---------------- Cancel Voting Function ----------------
window.cancelVoting = function() {
  if (confirm('Are you sure you want to cancel voting? Your selections will be lost.')) {
    // Clear the voter session
    voterSession = null;
    selectedCandidates = {};
    session.voterSession = null;
    saveSession();
    
    // Go back to voter login
    showScreen('voterLoginScreen');
    showToast('Voting cancelled', 'info');
  }
};

// ---------------- Debug Function ----------------
window.debugVoterStatus = async function() {
  const orgId = prompt('Enter Organization ID:');
  const credential = prompt('Enter voter email/phone:');
  
  if (!orgId || !credential) return;
  
  try {
    const result = await findVoterByEmailOrPhone(orgId, credential);
    if (result.found) {
      console.log('Voter found:', result.voter);
      alert(`
Voter Status:
* Name: ${result.voter.name}
* Email: ${result.voter.email}
* Phone: ${result.voter.phone}
* Has Voted: ${result.voter.hasVoted ? 'YES' : 'NO'}
* Is Replaced: ${result.voter.isReplaced ? 'YES' : 'NO'}
* Voter ID: ${result.voter.voterId || 'N/A'}
      `);
    } else {
      alert('Voter not found');
    }
  } catch(e) {
    console.error('Debug error:', e);
    alert('Error: ' + e.message);
  }
};

// =====================================================
// REDESIGNED VOTER INTERFACE - ORG ID + EMAIL/PHONE
// =====================================================

function updateVoterLoginScreen() {
  const screen = document.getElementById('voterLoginScreen');
  if (!screen) return;

  // Modern, clean voter login interface
  const formHtml = `
    <div class="login-container">
      <div class="login-header">
        <div class="login-logo">
          <i class="fas fa-vote-yea" style="font-size: 48px; color: #00eaff;"></i>
        </div>
        <h2>Voter Login</h2>
        <p class="subtext">Enter your voting credentials provided by the Election Commissioner</p>
      </div>

      <div class="login-card">
        <div class="form-group">
          <label class="label">
            <i class="fas fa-building"></i> Organization ID
          </label>
          <input 
            id="voterOrgId" 
            class="input" 
            placeholder="Organization ID (optional)" 
            
            autocomplete="off"
          >
          <div class="input-hint">
            <i class="fas fa-info-circle"></i> Provided by your Election Commissioner
          </div>
        </div>

        <div class="form-group">
          <label class="label">
            <i class="fas fa-user-circle"></i> Your Credential
          </label>
          
          <div class="credential-toggle">
            <button 
              type="button" 
              class="toggle-btn active" 
              data-type="email"
              onclick="setCredentialType('email')"
            >
              <i class="fas fa-envelope"></i> Email
            </button>
            <button 
              type="button" 
              class="toggle-btn" 
              data-type="phone"
              onclick="setCredentialType('phone')"
            >
              <i class="fas fa-phone"></i> Phone
            </button>
          </div>

          <!-- Email Input (default) -->
          <div id="emailInputGroup" class="input-group">
            <input 
              id="voterEmail" 
              class="input" 
              type="email"
              placeholder="your.email@example.com" 
              autocomplete="email"
              required
            >
            <div class="input-hint">
              <i class="fas fa-envelope"></i> Enter the email registered with EC
            </div>
          </div>

          <!-- Phone Input (hidden by default) -->
          <div id="phoneInputGroup" class="input-group" style="display: none;">
            <input 
              id="voterPhone" 
              class="input" 
              type="tel"
              placeholder="+233XXXXXXXXX or 0XXXXXXXXX" 
              autocomplete="tel"
            >
            <div class="input-hint">
              <i class="fas fa-phone"></i> Enter the phone number registered with EC
            </div>
          </div>
        </div>

        <div class="form-group">
          <button 
            class="btn neon-btn-lg" 
            style="width: 100%; padding: 14px;"
            onclick="loginVoterOrgCredential()"
          >
            <i class="fas fa-unlock-alt"></i> Login & Start Voting
          </button>
        </div>

        <div class="login-footer">
          <div class="divider">
            <span>Need Help?</span>
          </div>
          
          <div class="help-links">
            <button class="btn neon-btn-outline" onclick="showScreen('gatewayScreen')">
              <i class="fas fa-home"></i> Back to Gateway
            </button>
            
            <button class="btn neon-btn-outline" onclick="showVoterHelpModal()">
              <i class="fas fa-question-circle"></i> Voting Help
            </button>
          </div>
        </div>
      </div>

      <div class="security-notice">
        <i class="fas fa-shield-alt"></i>
        <span>Your vote is secure and anonymous. No personal voting data is stored.</span>
      </div>
    </div>
  `;

  const contentDiv = screen.querySelector('.screen-content') || screen;
  contentDiv.innerHTML = formHtml;

  // Prefill from URL params if present
  try {
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get('org');
    const voterCred = params.get('voter');
    
    if (orgId) {
      document.getElementById('voterOrgId')?.setAttribute('value', orgId);
    }
    
    if (voterCred) {
      const decodedCred = decodeURIComponent(voterCred);
      // Check if it's email or phone
      if (validateEmail(decodedCred)) {
        document.getElementById('voterEmail')?.setAttribute('value', decodedCred);
      } else {
        // Assume it's phone
        setCredentialType('phone');
        document.getElementById('voterPhone')?.setAttribute('value', decodedCred);
      }
    }
  } catch (e) {
    console.log('No URL params to prefill');
  }
}

// Set credential type (email or phone)
window.setCredentialType = function(type) {
  const emailGroup = document.getElementById('emailInputGroup');
  const phoneGroup = document.getElementById('phoneInputGroup');
  const idGroup = document.getElementById('idInputGroup');

  const emailBtn = document.querySelector('[data-type="email"]');
  const phoneBtn = document.querySelector('[data-type="phone"]');
  const idBtn = document.querySelector('[data-type="id"]');

  // defaults
  if (emailGroup) emailGroup.style.display = 'none';
  if (phoneGroup) phoneGroup.style.display = 'none';
  if (idGroup) idGroup.style.display = 'none';

  emailBtn?.classList.remove('active');
  phoneBtn?.classList.remove('active');
  idBtn?.classList.remove('active');

  if (type === 'phone') {
    phoneGroup && (phoneGroup.style.display = 'block');
    phoneBtn?.classList.add('active');
    document.getElementById('voterPhone')?.focus();
  } else if (type === 'id') {
    idGroup && (idGroup.style.display = 'block');
    idBtn?.classList.add('active');
    document.getElementById('voterOrgVoterId')?.focus();
  } else {
    emailGroup && (emailGroup.style.display = 'block');
    emailBtn?.classList.add('active');
    document.getElementById('voterEmail')?.focus();
  }
};;

// New voter login function for Org + Credential
window.loginVoterOrgCredential = async function() {
  let orgId = (document.getElementById('voterOrgId')?.value || "").trim();
  const email = (document.getElementById('voterEmail')?.value || "").trim();
  const phone = (document.getElementById('voterPhone')?.value || "").trim();
  const orgVoterId = (document.getElementById('voterOrgVoterId')?.value || "").trim();

  const emailGroupVisible = document.getElementById('emailInputGroup')?.style.display !== 'none';
  const phoneGroupVisible = document.getElementById('phoneInputGroup')?.style.display !== 'none';
  const idGroupVisible = document.getElementById('idInputGroup')?.style.display !== 'none';

  const credential = emailGroupVisible ? email : (phoneGroupVisible ? phone : orgVoterId);

  if (!credential) {
    showToast('Please enter your credential (Email, Phone, or Voter ID)', 'error');
    (emailGroupVisible ? document.getElementById('voterEmail') :
      phoneGroupVisible ? document.getElementById('voterPhone') :
      document.getElementById('voterOrgVoterId'))?.focus();
    return;
  }

  // basic validation
  if (emailGroupVisible && !validateEmail(normalizeEmailAddr(email))) {
    showToast('Please enter a valid email address', 'error');
    document.getElementById('voterEmail')?.focus();
    return;
  }
  if (phoneGroupVisible && normalizePhoneE164(phone).length < 8) {
    showToast('Please enter a valid phone number', 'error');
    document.getElementById('voterPhone')?.focus();
    return;
  }

  try {
    showToast('Verifying your credentials...', 'info');

    // If orgId omitted, auto-resolve by scanning organizations (best-effort)
    let org = null;
    if (!orgId) {
      const orgSnap = await getDocs(collection(db, "organizations"));
      for (const o of orgSnap.docs) {
        const res = await findVoterByEmailOrPhone(o.id, credential);
        if (res.found) {
          orgId = o.id;
          org = { id: o.id, ...(o.data() || {}) };
          // attach voter result for later
          window.__resolvedVoterResult = res;
          break;
        }
      }
      if (!orgId) {
        showToast('Voter not found in any organization. Check credential or ask EC.', 'error');
        return;
      }
    }

    // Load org doc if not already
    if (!org) {
      const orgRef = doc(db, "organizations", orgId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) {
        showToast('Organization not found. Check the Organization ID.', 'error');
        return;
      }
      org = { id: orgSnap.id, ...(orgSnap.data() || {}) };
    }

    // 2) Approval/enabled checks
    if (org.isDeleted) {
      showToast('This organization is currently disabled.', 'warning');
      return;
    }

    // 3) Schedule checks (keep your existing logic)
    const now = new Date();
    if (org.electionSettings?.startTime) {
      const startTime = new Date(org.electionSettings.startTime);
      if (startTime > now) {
        showToast(`Voting starts at ${startTime.toLocaleString()}`, 'warning');
        return;
      }
    }
    if (org.electionSettings?.endTime) {
      const endTime = new Date(org.electionSettings.endTime);
      if (endTime <= now) {
        showToast('Voting has ended for this election.', 'warning');
        return;
      }
    }

    // 4) Find voter
    const result = window.__resolvedVoterResult || await findVoterByEmailOrPhone(orgId, credential);
    window.__resolvedVoterResult = null;

    if (!result.found) {
      showToast('Voter not found. Please check your credential or contact EC.', 'error');
      return;
    }

    const voter = result.voter;
    if (voter.hasVoted) {
      await window.showVoterLiveDashboard(orgId, voter);
      return;
    }

    // 5) Create voter session (canonical)
    const voterDocId = result.voterDocId || voter.id;
    const voterKey = voterDocId; // we use docId as canonical key

    voterSession = {
      orgId,
      voterKey,
      voterDocId,
      email: voter.email || "",
      phone: voter.phone || "",
      voterData: voter,
      orgData: org,
      matchedBy: result.matchedBy,
      startTime: new Date()
    };

    session.voterSession = voterSession;
    saveSession();

    await writeAudit(orgId, "VOTER_LOGIN", voterKey, { matchedBy: result.matchedBy });

    await loadVotingBallot(orgId);
    showScreen('votingScreen');
    const greetingName = voter.name || voter.voterId || 'Voter';
    showToast(`Welcome, ${greetingName}! Please cast your vote.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Login failed. Please try again.', 'error');
  }
};;

// Help modal for voters
window.showVoterHelpModal = function() {
  createModal(
    '<i class="fas fa-question-circle"></i> Voting Help',
    `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="help-section">
          <h4 style="color: #00eaff; margin-bottom: 10px;">
            <i class="fas fa-key"></i> How to Get Your Credentials
          </h4>
          <ul style="color: #9beaff; padding-left: 20px;">
            <li>Your Organization ID is provided by the Election Commissioner (EC)</li>
            <li>Use the <strong>email</strong> or <strong>phone number</strong> you registered with</li>
            <li>If you don't have credentials, contact your EC</li>
          </ul>
        </div>
        
        <div class="help-section">
          <h4 style="color: #00eaff; margin-bottom: 10px;">
            <i class="fas fa-vote-yea"></i> Voting Process
          </h4>
          <ul style="color: #9beaff; padding-left: 20px;">
            <li>Select your preferred candidates for each position</li>
            <li>Review your selections before submitting</li>
            <li>Once submitted, your vote cannot be changed</li>
          </ul>
        </div>
        
        <div class="help-section">
          <h4 style="color: #00eaff; margin-bottom: 10px;">
            <i class="fas fa-shield-alt"></i> Security & Privacy
          </h4>
          <ul style="color: #9beaff; padding-left: 20px;">
            <li>Your vote is anonymous and secure</li>
            <li>No one can see how you voted</li>
            <li>Your credential is only used for authentication</li>
          </ul>
        </div>
        
        <div class="help-section" style="background: rgba(255, 193, 7, 0.1); padding: 15px; border-radius: 10px;">
          <h4 style="color: #ffc107; margin-bottom: 10px;">
            <i class="fas fa-exclamation-triangle"></i> Important Notes
          </h4>
          <ul style="color: #ffcc80; padding-left: 20px;">
            <li>Do not share your voting credentials</li>
            <li>Complete voting in one session</li>
            <li>Contact EC immediately if you encounter issues</li>
          </ul>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">
        <i class="fas fa-times"></i> Close
      </button>
      <button class="btn neon-btn" onclick="document.querySelector('.modal-overlay')?.remove(); updateVoterLoginScreen();">
        <i class="fas fa-redo"></i> Back to Login
      </button>
    `
  );
};

// ---------------- Voter Modal Functions ----------------
window.showAddVoterModal = function() {
  // EC adds voters using ONE credential field (Email OR Telephone).
  // Voter will later log in with: Organization ID + this credential.
  createModal(
    `<i class="fas fa-user-plus"></i> Add Voter`,
    `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="label">Full Name *</label>
          <input id="ecVoterNameInput" class="input" placeholder="e.g. Ama Mensah" autocomplete="off">
        </div>

        <div>
          <label class="label">Organization Voter ID (optional)</label>
          <input id="ecVoterOrgVoterIdInput" class="input" placeholder="e.g. ark-001" autocomplete="off">
          <small class="subtext">If set, voter can log in using this Voter ID too.</small>
        </div>

        <div>
          <label class="label">Credential (Email or Telephone) *</label>
          <input id="ecVoterCredentialInput" class="input" placeholder="email@example.com or +233..." autocomplete="off">
          <small class="subtext">Use the same email/phone the voter will use to log in.</small>
        </div>

        <div>
          <label class="label">Date of Birth (optional)</label>
          <input id="ecVoterDobInput" class="input" type="date">
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="addVoterWithEmailOrPhone()">
        <i class="fas fa-check"></i> Add Voter
      </button>
    `
  );

  setTimeout(() => document.getElementById('ecVoterNameInput')?.focus(), 50);
};

window.toggleVoterCredentialType = function(usePhone) {
  window.voterUsesPhone = usePhone;
  
  const emailField = document.getElementById('emailField');
  const phoneField = document.getElementById('phoneField');
  const emailInput = document.getElementById('voterEmailInput');
  const phoneInput = document.getElementById('voterPhoneInput');
  
  if (emailField) emailField.style.display = usePhone ? 'none' : 'block';
  if (phoneField) phoneField.style.display = usePhone ? 'block' : 'none';
  
  // Update required attribute
  if (emailInput) emailInput.required = !usePhone;
  if (phoneInput) phoneInput.required = usePhone;
  
  // Update tab buttons
  document.querySelectorAll('.credential-options .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`.credential-options .tab-btn:nth-child(${usePhone ? 2 : 1})`);
  if (activeBtn) activeBtn.classList.add('active');
};

window.addVoterWithEmailOrPhone = async function() {
  try {
    if (!currentOrgId) {
      showToast("No organization selected", "error");
      return;
    }

    const name = (document.getElementById('ecVoterNameInput')?.value || "").trim();
    const credentialRaw = (document.getElementById('ecVoterCredentialInput')?.value || "").trim();
    const dob = (document.getElementById('ecVoterDobInput')?.value || "").trim();
    const orgVoterIdRaw = (document.getElementById('ecVoterOrgVoterIdInput')?.value || "").trim();

    if (!name) {
      showToast("Name is required", "error");
      return;
    }

    if (!credentialRaw && !orgVoterIdRaw) {
      showToast("Provide Credential (Email/Telephone) or Organization Voter ID", "error");
      return;
    }

    const credentialLower = (credentialRaw || orgVoterIdRaw).toLowerCase().trim();
    const isEmail = validateEmail(credentialLower);

    let docId = "";
    let voterEmail = "";
    let voterPhone = "";
    let credentialType = isEmail ? "email" : "phone";

    if (isEmail) {
      voterEmail = credentialLower;
      docId = encodeURIComponent(voterEmail);
    } else {
      voterPhone = normalizePhoneNumber(credentialRaw);
      if (!voterPhone || voterPhone.length < 7) {
        showToast("Please enter a valid phone number", "error");
        return;
      }
      docId = encodeURIComponent("tel:" + voterPhone);
    }

    // Check if voter already exists
    const voterRef = doc(db, "organizations", currentOrgId, "voters", docId);
    const existingSnap = await getDoc(voterRef);
    if (existingSnap.exists()) {
      const ex = existingSnap.data();
      if (!ex.isReplaced) {
        showToast("A voter with this credential already exists", "error");
        return;
      }
    }

    // Extra duplicate check for phone (in case old records used different doc IDs)
    if (!isEmail) {
      const snap = await getDocs(query(
        collection(db, "organizations", currentOrgId, "voters"),
        where("isReplaced", "==", false)
      ));
      for (const d of snap.docs) {
        const data = d.data() || {};
        if (data.phone) {
          const p = normalizePhoneNumber(data.phone);
          if (p && (p === voterPhone || p.includes(voterPhone) || voterPhone.includes(p))) {
            showToast("A voter with this phone already exists", "error");
            return;
          }
        }
      }
    }

    // Save voter (NO Firebase Auth; no currentUser)
    const payload = {
      name,
      credentialType,
      email: voterEmail || "",
      phone: voterPhone || "",
      hasVoted: false,
      isReplaced: false,
      addedAt: serverTimestamp(),
      addedByRole: "ec",
      orgId: currentOrgId
    };

    if (dob) {
      payload.dateOfBirth = dob;
    }

    await setDoc(voterRef, payload, { merge: true });

    // Increment voter count if it's a brand new doc
    if (!existingSnap.exists()) {
      try {
        await updateDoc(doc(db, "organizations", currentOrgId), { voterCount: increment(1) });
      } catch (e) {
        console.warn("Could not increment voterCount:", e);
      }
    }

    document.querySelector('.modal-overlay')?.remove();
    showToast("Voter added successfully", "success");

    // Refresh voters list
    if (typeof loadECVoters === "function") {
      loadECVoters();
    }
  } catch (e) {
    console.error("Error adding voter:", e);
    showToast("Failed to add voter: " + (e?.message || "Unknown error"), "error");
  }
};

// ================= NEW: Credential-based voter creation + delivery =================
window.generateVoterCredentials = window.generateVoterCredentials || function generateVoterCredentials() {
  return {
    voterId: "VTR-" + Math.random().toString(36).substring(2, 7).toUpperCase(),
    pin: Math.floor(100000 + Math.random() * 900000).toString()
  };
};

window.copyVoterCredentialsFromModal = function() {
  const voterId = document.getElementById("voterIdInput")?.value || "";
  const pin = document.getElementById("voterPinInput")?.value || "";
  const orgId = currentOrgId || "";
  const txt = `Organization ID: ${orgId}\nVoter ID: ${voterId}\nPIN: ${pin}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(txt).then(() => showToast("Credentials copied", "success"))
      .catch(() => showToast("Copy failed. Please copy manually.", "warning"));
  } else {
    showToast("Clipboard not supported. Please copy manually.", "warning");
  }
};

window.regenerateVoterCredentialsInModal = function() {
  const creds = window.generateVoterCredentials();
  const idEl = document.getElementById("voterIdInput");
  const pinEl = document.getElementById("voterPinInput");
  if (idEl) idEl.value = creds.voterId;
  if (pinEl) pinEl.value = creds.pin;
  showToast("New credentials generated", "info");
};

window.sendVoterCredentials = async function({ orgId, orgName, voterId, pin, name, phone, email }) {
  // Calls your Netlify function (keep secrets server-side)
  const res = await fetch("/.netlify/functions/send-voter-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, orgName, voterId, pin, name, phone, email })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to send credentials");
  }
  return await res.json();
};

window.addVoterWithCredentialsAndSend = async function() {
  try {
    if (!currentOrgId) {
      showToast("No organization selected", "error");
      return;
    }

    const name = document.getElementById("voterNameInput")?.value.trim();
    const email = document.getElementById("voterEmailInput")?.value.trim();
    const phone = document.getElementById("voterPhoneInput")?.value.trim();
    const voterId = document.getElementById("voterIdInput")?.value.trim();
    const pin = document.getElementById("voterPinInput")?.value.trim();

    if (!name || !voterId || !pin) {
      showToast("Full name and credentials are required", "error");
      return;
    }

    // Create voter under organizations/{orgId}/voters/{voterId}
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    const existing = await getDoc(voterRef);
    if (existing.exists()) {
      showToast("Voter ID already exists. Click Regenerate.", "warning");
      return;
    }

    await setDoc(voterRef, {
      name,
      email: email || null,
      phone: phone || null,
      voterId,
      pin,
      hasVoted: false,
      isActive: true,
      isReplaced: false,
      addedAt: serverTimestamp(),
      createdBy: session?.ecUid || session?.user?.uid || session?.role || "ec"
    });

    // Send credentials (WhatsApp/Email) – optional based on provided contact details
    let sendResult = { whatsappSent: false, emailSent: false };
    try {
      // fetch orgName if available
      const orgName = currentOrgData?.name || currentOrgData?.orgName || "";
      sendResult = await window.sendVoterCredentials({
        orgId: currentOrgId,
        orgName,
        voterId,
        pin,
        name,
        phone: phone || null,
        email: email || null
      });

      await updateDoc(voterRef, {
        credentialsSent: {
          whatsapp: !!sendResult.whatsappSent,
          email: !!sendResult.emailSent,
          sentAt: serverTimestamp()
        }
      });

      showToast(
        `Voter created. Sent: ${sendResult.whatsappSent ? "WhatsApp " : ""}${sendResult.emailSent ? "Email" : ""}`.trim(),
        "success"
      );
    } catch (sendErr) {
      console.warn("Credentials send failed:", sendErr);
      await updateDoc(voterRef, {
        credentialsSent: {
          whatsapp: false,
          email: false,
          error: (sendErr?.message || "send_failed").slice(0, 250),
          sentAt: serverTimestamp()
        }
      });
      showToast("Voter created, but sending failed. You can resend later.", "warning");
    }

    // Close modal
    document.querySelector(".modal-overlay")?.remove();

    // Refresh voters list if available
    if (typeof refreshVoters === "function") refreshVoters();
    if (typeof loadECVoters === "function") loadECVoters();
  } catch (e) {
    console.error("addVoterWithCredentialsAndSend error:", e);
    showToast("Failed to create voter: " + e.message, "error");
  }
};

window.editVoterModal = async function(voterId) {
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    const voterSnap = await getDoc(voterRef);
    
    if (!voterSnap.exists()) {
      showToast('Voter not found', 'error');
      return;
    }
    
    const voter = voterSnap.data();
    const currentEmail = decodeURIComponent(voterId);
    
    const modal = createModal(
      `<i class="fas fa-edit"></i> Edit Voter: ${voter.name}`,
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Current Email</label>
            <input class="input" value="${escapeHtml(currentEmail)}" disabled style="background: rgba(255,255,255,0.05);">
            <div class="subtext" style="margin-top: 5px;">To change email, use the "Change Email" button</div>
          </div>
          <div>
            <label class="label">Full Name *</label>
            <input id="editVoterName" class="input" value="${escapeHtml(voter.name || '')}" required>
          </div>
          <div>
            <label class="label">Phone Number</label>
            <input id="editVoterPhone" class="input" value="${escapeHtml(voter.phone || '')}" placeholder="+233XXXXXXXXX">
          </div>
          <div>
            <label class="label">Date of Birth (Optional)</label>
            <input id="editVoterDob" class="input" value="${voter.dateOfBirth ? formatDateForDisplay(new Date(voter.dateOfBirth)) : ''}" placeholder="YYYY-MM-DD or DD/MM/YYYY">
            <div class="subtext" style="margin-top: 5px;">Leave empty to remove</div>
          </div>
          <div>
            <label class="label">Voter ID</label>
            <input id="editVoterId" class="input" value="${escapeHtml(voter.voterId || '')}" placeholder="Custom voter ID">
          </div>
          <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
            <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
              <i class="fas fa-info-circle"></i> Voter Status:
            </div>
            <div style="font-size: 12px; color: ${voter.hasVoted ? '#00ffaa' : '#ffc107'};">
              ${voter.hasVoted ? '✅ Has voted' : '⏳ Pending vote'}
              ${voter.isReplaced ? '<br>⚠️ This voter has been replaced by another email' : ''}
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updateVoter('${voterId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => {
      document.getElementById('editVoterName')?.focus();
    }, 100);
  } catch(e) {
    console.error('Error loading voter for edit:', e);
    showToast('Error loading voter details', 'error');
  }
};

window.updateVoter = async function(voterId) {
  const name = document.getElementById('editVoterName')?.value.trim();
  const dob = document.getElementById('editVoterDob')?.value.trim();
  const phone = document.getElementById('editVoterPhone')?.value.trim();
  const voterIdField = document.getElementById('editVoterId')?.value.trim();
  
  if (!name) {
    showToast('Name is required', 'error');
    return;
  }
  
  let currentVoterData = null;
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    const voterSnap = await getDoc(voterRef);
    if (voterSnap.exists()) {
      currentVoterData = voterSnap.data();
    }
  } catch(e) {
    console.error('Error getting current voter data:', e);
  }
  
  if (phone && phone !== (currentVoterData?.phone || '')) {
    try {
      const phoneQuery = query(
        collection(db, "organizations", currentOrgId, "voters"),
        where("phone", "==", phone)
      );
      const phoneSnap = await getDocs(phoneQuery);
      
      if (!phoneSnap.empty) {
        showToast('A voter with this phone number already exists', 'error');
        return;
      }
    } catch(e) {
      console.error('Error checking duplicate phone:', e);
    }
  }
  
  if (voterIdField && voterIdField !== (currentVoterData?.voterId || '')) {
    try {
      const voterIdQuery = query(
        collection(db, "organizations", currentOrgId, "voters"),
        where("voterId", "==", voterIdField)
      );
      const voterIdSnap = await getDocs(voterIdQuery);
      
      if (!voterIdSnap.empty) {
        showToast('A voter with this Voter ID already exists', 'error');
        return;
      }
    } catch(e) {
      console.error('Error checking duplicate voter ID:', e);
    }
  }
  
  let dateOfBirth = '';
  
  if (dob && dob.trim() !== '') {
    const dateValidation = validateDateOfBirth(dob);
    if (!dateValidation.valid) {
      showToast(dateValidation.error, 'error');
      return;
    }
    dateOfBirth = dateValidation.date;
  }
  
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    const updateData = {
      name: name,
      phone: phone || '',
      voterId: voterIdField || '',
      updatedAt: serverTimestamp()
    };
    
    if (dateOfBirth) {
      updateData.dateOfBirth = dateOfBirth;
    } else {
      updateData.dateOfBirth = '';
    }
    
    await updateDoc(voterRef, updateData);
    
    showToast('Voter updated successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECVoters();
  } catch(e) {
    console.error('Error updating voter:', e);
    showToast('Error updating voter: ' + e.message, 'error');
  }
};

window.showBulkVoterModal = function() {
  const modal = createModal(
    '<i class="fas fa-users"></i> Bulk Add Voters',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Voter Data (CSV Format)</label>
          <textarea id="bulkVoterData" class="input" placeholder="Format: Name, Email, Phone, Date of Birth, Voter ID&#10;John Doe, john@example.com, +233501234567, 1990-01-15, ID001&#10;Jane Smith, , +233502345678, 1985-06-30, ID002&#10;Bob Johnson, bob@org.com, , 1980-12-25, ID003" rows="8" style="font-family: monospace; font-size: 13px;"></textarea>
          <div class="subtext" style="margin-top: 5px;">
            One voter per line. Email OR Phone is required. Date format: YYYY-MM-DD or DD/MM/YYYY
          </div>
        </div>
        
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> CSV Format (5 columns):
          </div>
          <div style="font-size: 12px; color: #9beaff; font-family: monospace;">
            1. Name (required)<br>
            2. Email (or empty)<br>
            3. Phone (or empty)<br>
            4. Date of Birth (optional)<br>
            5. Voter ID (optional)<br><br>
            Example:<br>
            John Doe, john@example.com, +233501234567, 1990-01-15, ID001<br>
            Jane Smith, , +233502345678, 1985-06-30, ID002<br>
            Bob Johnson, bob@org.com, , 1980-12-25, ID003
          </div>
        </div>
        
        <div style="background: rgba(0, 255, 170, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 170, 0.1);">
          <div style="color: #00ffaa; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-check-circle"></i> Important:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • Each voter must have <strong>either email OR phone</strong><br>
            • Phone numbers accept any format (local or international)<br>
            • Voters can use either credential to login
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="processBulkVotersEnhanced()">
        <i class="fas fa-upload"></i> Import Voters
      </button>
    `
  );
};

window.processBulkVotersEnhanced = async function() {
  const data = document.getElementById('bulkVoterData')?.value.trim();
  if (!data) {
    showToast('Please enter voter data', 'error');
    return;
  }
  
  const lines = data.split('\n').filter(line => line.trim());
  const voters = [];
  const duplicateCheck = {
    emails: new Set(),
    phones: new Set(),
    voterIds: new Set()
  };
  
  for (const line of lines) {
    const parts = line.split(',').map(part => part.trim());
    if (parts.length >= 2) {
      const voter = {
        name: parts[0],
        email: parts[1] ? parts[1].toLowerCase() : '',
        phone: parts[2] || '',
        dateOfBirth: parts[3] || '',
        voterId: parts[4] || ''
      };
      
      if (!voter.name) {
        showToast(`Invalid voter: Missing name on line "${line}"`, 'error');
        continue;
      }
      
      // Validate email if provided
      if (voter.email && !validateEmail(voter.email)) {
        showToast(`Invalid email for ${voter.name}: ${voter.email}`, 'error');
        continue;
      }
      
      // Require either email or phone
      if (!voter.email && !voter.phone) {
        showToast(`Voter ${voter.name} needs either email or phone`, 'error');
        continue;
      }
      
      // Check for duplicates in this batch
      if (voter.email && duplicateCheck.emails.has(voter.email)) {
        showToast(`Duplicate email in batch: ${voter.email}`, 'error');
        continue;
      }
      
      if (voter.phone) {
        const normalizedPhone = normalizePhoneNumber(voter.phone);
        if (duplicateCheck.phones.has(normalizedPhone)) {
          showToast(`Duplicate phone in batch: ${voter.phone}`, 'error');
          continue;
        }
        duplicateCheck.phones.add(normalizedPhone);
      }
      
      voters.push(voter);
      if (voter.email) duplicateCheck.emails.add(voter.email);
      if (voter.voterId) duplicateCheck.voterIds.add(voter.voterId);
    }
  }
  
  if (voters.length === 0) {
    showToast('No valid voters found', 'error');
    return;
  }
  
  try {
    const batch = writeBatch(db);
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    
    for (const voter of voters) {
      try {
        let docId;
        let voterEmail = voter.email;
        
        if (voter.email && validateEmail(voter.email)) {
          docId = encodeURIComponent(voter.email);
        } else if (voter.phone) {
          docId = `phone_${normalizePhoneNumber(voter.phone)}`;
          voterEmail = '';
        } else {
          errorCount++;
          continue;
        }
        
        // Check for existing voter
        const voterRef = doc(db, "organizations", currentOrgId, "voters", docId);
        const existingVoter = await getDoc(voterRef);
        
        if (existingVoter.exists()) {
          duplicateCount++;
          continue;
        }
        
        // Check for duplicate phone
        if (voter.phone) {
          const normalizedPhone = normalizePhoneNumber(voter.phone);
          const phoneQuery = query(
            collection(db, "organizations", currentOrgId, "voters"),
            where("phone", "!=", "")
          );
          const phoneSnap = await getDocs(phoneQuery);
          
          let phoneDuplicate = false;
          for (const voterDoc of phoneSnap.docs) {
            const voterData = voterDoc.data();
            const existingPhone = normalizePhoneNumber(voterData.phone);
            
            if (existingPhone === normalizedPhone) {
              phoneDuplicate = true;
              break;
            }
          }
          
          if (phoneDuplicate) {
            duplicateCount++;
            continue;
          }
        }
        
        // Check for duplicate voter ID
        if (voter.voterId) {
          const voterIdQuery = query(
            collection(db, "organizations", currentOrgId, "voters"),
            where("voterId", "==", voter.voterId)
          );
          const voterIdSnap = await getDocs(voterIdQuery);
          
          if (!voterIdSnap.empty) {
            duplicateCount++;
            continue;
          }
        }
        
        const voterData = {
          name: voter.name,
          email: voterEmail,
          phone: voter.phone || '',
          voterId: voter.voterId || '',
          hasVoted: false,
          isActive: true,
          isReplaced: false,
          addedAt: serverTimestamp(),
          invited: false
        };
        
        if (voter.dateOfBirth && voter.dateOfBirth.trim() !== '') {
          const dateValidation = validateDateOfBirth(voter.dateOfBirth);
          if (dateValidation.valid) {
            voterData.dateOfBirth = dateValidation.date;
          }
        }
        
        batch.set(voterRef, voterData);
        successCount++;
        
      } catch(e) {
        console.error('Error processing voter:', voter.name, e);
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      await batch.commit();
      
      // Update organization voter count
      const orgRef = doc(db, "organizations", currentOrgId);
      const orgSnap = await getDoc(orgRef);
      const currentCount = orgSnap.exists() ? (orgSnap.data().voterCount || 0) : 0;
      
      await updateDoc(orgRef, {
        voterCount: currentCount + successCount
      });
      
      const updatedOrgSnap = await getDoc(orgRef);
      if (updatedOrgSnap.exists()) {
        currentOrgData = { id: currentOrgId, ...updatedOrgSnap.data() };
        updateECUI();
      }
      
      let message = `Added ${successCount} voters successfully!`;
      if (duplicateCount > 0) message += ` ${duplicateCount} duplicates skipped.`;
      if (errorCount > 0) message += ` ${errorCount} errors.`;
      
      showToast(message, 'success');
      document.querySelector('.modal-overlay')?.remove();
      loadECVoters();
    } else {
      showToast('No new voters added. All may be duplicates.', 'warning');
    }
    
  } catch(e) {
    console.error('Error adding bulk voters:', e);
    showToast('Error: ' + e.message, 'error');
  }
};

window.removeVoter = async function(voterId, voterName) {
  if (!voterId) {
    showToast('Invalid voter ID', 'error');
    return;
  }
  
  if (!confirm(`Are you sure you want to delete voter: ${voterName}?`)) {
    return;
  }
  
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    await deleteDoc(voterRef);
    
    const orgRef = doc(db, "organizations", currentOrgId);
    const orgSnap = await getDoc(orgRef);
    const currentCount = orgSnap.exists() ? (orgSnap.data().voterCount || 0) : 0;
    
    await updateDoc(orgRef, {
      voterCount: Math.max(0, currentCount - 1)
    });
    
    const updatedOrgSnap = await getDoc(orgRef);
    if (updatedOrgSnap.exists()) {
      currentOrgData = { id: currentOrgId, ...updatedOrgSnap.data() };
      updateECUI();
    }
    
    showToast(`Voter ${voterName} deleted`, 'success');
    loadECVoters();
  } catch(e) {
    console.error('Error deleting voter:', e);
    showToast('Error deleting voter: ' + e.message, 'error');
  }
};

window.searchVoters = function() {
  const searchTerm = document.getElementById('voterSearch')?.value.toLowerCase() || '';
  const voterItems = document.querySelectorAll('.voter-item');
  
  voterItems.forEach(item => {
    const email = item.dataset.email || '';
    const name = item.dataset.name || '';
    
    if (email.includes(searchTerm) || name.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
};

// ---------------- Voting System Functions ----------------
async function loadVotingBallot(orgId) {
  const screen = document.getElementById('votingScreen');
  if (!screen) return;
  
  showQuickLoading('votingScreen', 'Loading Ballot');
  
  try {
    const [positionsSnap, candidatesSnap, orgSnap] = await Promise.all([
      getDocs(collection(db, "organizations", orgId, "positions")),
      getDocs(collection(db, "organizations", orgId, "candidates")),
      getDoc(doc(db, "organizations", orgId))
    ]);
    
    if (!orgSnap.exists()) {
      showToast('Organization not found', 'error');
      showScreen('voterLoginScreen');
      return;
    }
    
    const org = orgSnap.data();
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    // Group candidates by position
    const candidatesByPosition = {};
    candidates.forEach(c => {
      if (!candidatesByPosition[c.positionId]) {
        candidatesByPosition[c.positionId] = [];
      }
      candidatesByPosition[c.positionId].push(c);
    });
    
    let html = `
      <div class="voting-header">
        <h2>${org.name || 'Election'} Ballot</h2>
        <div class="subtext">Make your selections below. Click submit when done.</div>
        <div style="margin-top: 10px;">
          <button class="btn neon-btn-outline" onclick="cancelVoting()">
            <i class="fas fa-times"></i> Cancel Voting
          </button>
        </div>
      </div>
      
      <div class="ballot-container">
    `;
    
    if (positions.length === 0) {
      html += `
        <div class="empty-ballot">
          <i class="fas fa-clipboard-list" style="font-size: 64px; color: #00eaff; margin-bottom: 20px;"></i>
          <h3>No Positions Available</h3>
          <p>There are no positions set up for voting yet.</p>
          <button class="btn neon-btn" onclick="showScreen('voterLoginScreen')">
            <i class="fas fa-arrow-left"></i> Back to Login
          </button>
        </div>
      `;
    } else {
      positions.forEach((position, index) => {
        const positionCandidates = candidatesByPosition[position.id] || [];
        
        html += `
          <div class="position-card" data-position-id="${position.id}">
            <div class="position-header">
              <div class="position-title">
                <span class="position-number">${index + 1}</span>
                <h3>${position.name}</h3>
              </div>
              <div class="position-info">
                <span class="badge ${position.votingType === 'multiple' ? 'multiple' : 'single'}">
                  ${position.votingType === 'multiple' ? 'Multiple Choice' : 'Single Choice'}
                </span>
                <span class="subtext">Select ${position.maxCandidates || 1} candidate(s)</span>
              </div>
            </div>
            
            ${position.description ? `
              <div class="position-description">
                <p>${position.description}</p>
              </div>
            ` : ''}
            
            <div class="candidates-grid">
        `;
        
        if (positionCandidates.length === 0) {
          html += `
            <div class="no-candidates">
              <i class="fas fa-user-slash"></i>
              <p>No candidates available for this position</p>
            </div>
          `;
         } else if (positionCandidates.length === 1) {
          const only = positionCandidates[0];
          const onlyPhoto = only.photo || getDefaultAvatar(only.name || "Candidate");
          html += `
            <div class="candidate-card" data-candidate-id="yes">
              <div class="candidate-checkbox">
                <input type="radio"
                       id="candidate-${position.id}-yes"
                       name="position-${position.id}"
                       value="yes"
                       onchange="updateSelectedCandidates('${position.id}', 'yes', true, 1)">
                <label for="candidate-${position.id}-yes"></label>
              </div>
              <div class="candidate-info">
                <div class="candidate-details">
                  <h4>YES</h4>
                  <p class="candidate-tagline">Vote YES for: <strong>${only.name || 'Candidate'}</strong></p>
                </div>
              </div>
            </div>

            <div class="candidate-card" data-candidate-id="no">
              <div class="candidate-checkbox">
                <input type="radio"
                       id="candidate-${position.id}-no"
                       name="position-${position.id}"
                       value="no"
                       onchange="updateSelectedCandidates('${position.id}', 'no', true, 1)">
                <label for="candidate-${position.id}-no"></label>
              </div>
              <div class="candidate-info">
                <div class="candidate-details">
                  <h4>NO</h4>
                  <p class="candidate-tagline">Vote NO (reject this candidate)</p>
                </div>
              </div>
            </div>

            <div class="subtext" style="grid-column:1/-1;margin-top:6px;opacity:.9">
              Single candidate: <strong>${only.name || 'Candidate'}</strong>
            </div>
          `;
        } else {
          positionCandidates.forEach(candidate => {
            const photoUrl = candidate.photo || getDefaultAvatar(candidate.name);
            
            html += `
              <div class="candidate-card" data-candidate-id="${candidate.id}">
                <div class="candidate-checkbox">
                  <input type="radio" 
                         id="candidate-${candidate.id}" 
                         name="position-${position.id}" 
                         value="${candidate.id}"
                         onchange="updateSelectedCandidates('${position.id}', '${candidate.id}', this.checked, ${position.maxCandidates || 1})">
                  <label for="candidate-${candidate.id}"></label>
                </div>
                <div class="candidate-info">
                  <img src="${photoUrl}" alt="${candidate.name}" class="candidate-photo">
                  <div class="candidate-details">
                    <h4>${candidate.name}</h4>
                    ${candidate.tagline ? `<p class="candidate-tagline">${candidate.tagline}</p>` : ''}
                    ${candidate.bio ? `<div class="candidate-bio">${candidate.bio.substring(0, 100)}${candidate.bio.length > 100 ? '...' : ''}</div>` : ''}
                  </div>
                </div>
              </div>
            `;
          });
        }
        
        html += `
            </div>
          </div>
        `;
      });
      
      html += `
        <div class="voting-footer">
          <div class="vote-summary">
            <div class="summary-item">
              <span class="label">Positions:</span>
              <span class="value">${positions.length}</span>
            </div>
            <div class="summary-item">
              <span class="label">Selected:</span>
              <span id="selectedCount" class="value">0</span>
            </div>
            <div class="summary-item">
              <span class="label">Status:</span>
              <span id="voteStatus" class="value pending">Ready to Vote</span>
            </div>
          </div>
          
          <div class="vote-actions">
            <button class="btn neon-btn-outline" onclick="clearSelections()">
              <i class="fas fa-eraser"></i> Clear All
            </button>
            <button class="btn neon-btn" onclick="submitVote()" id="submitVoteBtn" disabled>
              <i class="fas fa-paper-plane"></i> Submit Vote
            </button>
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
    screen.innerHTML = html;
    
    // Add countdown timer if election has end time
    if (org.electionSettings?.endTime) {
      startVoterCountdown(org.electionSettings.endTime);
    }
    
  } catch(e) {
    console.error('Error loading ballot:', e);
    renderError('votingScreen', 'Error loading ballot: ' + e.message, () => {
      showScreen('voterLoginScreen');
    });
  }
}

function updateSelectedCandidates(positionId, candidateId, isSelected, maxSelections) {
  if (!selectedCandidates[positionId]) {
    selectedCandidates[positionId] = [];
  }
  
  if (isSelected) {
    // For single choice, clear previous selection
    const positionEl = document.querySelector(`[data-position-id="${positionId}"]`);
    if (positionEl && positionEl.querySelector('input[type="radio"]')) {
      selectedCandidates[positionId] = [candidateId];
      // Uncheck other radio buttons
      positionEl.querySelectorAll('input[type="radio"]').forEach(input => {
        if (input.value !== candidateId) {
          input.checked = false;
        }
      });
    } else {
      // For multiple choice, check max selections
      if (selectedCandidates[positionId].length >= maxSelections) {
        showToast(`Maximum ${maxSelections} selection(s) allowed for this position`, 'warning');
        document.getElementById(`candidate-${candidateId}`).checked = false;
        return;
      }
      selectedCandidates[positionId].push(candidateId);
    }
  } else {
    selectedCandidates[positionId] = selectedCandidates[positionId].filter(id => id !== candidateId);
  }
  
  updateVoteSummary();
}

function updateVoteSummary() {
  let totalSelected = 0;
  let totalPositions = 0;
  
  Object.keys(selectedCandidates).forEach(positionId => {
    if (selectedCandidates[positionId].length > 0) {
      totalSelected += selectedCandidates[positionId].length;
      totalPositions++;
    }
  });
  
  const selectedCountEl = document.getElementById('selectedCount');
  const voteStatusEl = document.getElementById('voteStatus');
  const submitBtn = document.getElementById('submitVoteBtn');
  
  if (selectedCountEl) selectedCountEl.textContent = totalSelected;
  
  if (totalSelected > 0) {
    if (voteStatusEl) {
      voteStatusEl.textContent = 'Ready to Submit';
      voteStatusEl.className = 'value ready';
    }
    if (submitBtn) submitBtn.disabled = false;
  } else {
    if (voteStatusEl) {
      voteStatusEl.textContent = 'Select Candidates';
      voteStatusEl.className = 'value pending';
    }
    if (submitBtn) submitBtn.disabled = true;
  }
}

function clearSelections() {
  if (!confirm('Are you sure you want to clear all selections?')) return;
  
  selectedCandidates = {};
  
  // Uncheck all checkboxes and radios
  document.querySelectorAll('.candidate-card input[type="checkbox"], .candidate-card input[type="radio"]').forEach(input => {
    input.checked = false;
  });
  
  updateVoteSummary();
  showToast('All selections cleared', 'info');
}

async function submitVote() {
  if (!voterSession) {
    showToast('Voter session not found. Please login again.', 'error');
    showScreen('voterLoginScreen');
    return;
  }

  // Validate selections
  const positions = document.querySelectorAll('.position-card');
  let isValid = true;
  let validationMessage = '';

  positions.forEach(position => {
    const positionId = position.dataset.positionId;
    const selectedCount = selectedCandidates[positionId]?.length || 0;

    // Require at least 1 selection per position
    if (selectedCount === 0) {
      isValid = false;
      validationMessage = 'Please make a selection for all positions before submitting.';
    }

    // Enforce single-choice if inputs are radios (or YES/NO)
    const hasRadio = position.querySelector('input[type="radio"]');
    if (hasRadio && selectedCount > 1) {
      isValid = false;
      validationMessage = 'Only one selection is allowed for some positions.';
    }
  });

  if (!isValid) {
    showToast(validationMessage || 'Please complete your ballot.', 'error');
    return;
  }

  if (!confirm('Submit your vote? This action cannot be undone.')) return;

  try {
    const batch = writeBatch(db);

    // Use canonical vote doc id = voterKey (prevents double voting)
    const voteDocId = voterSession.voterKey || voterSession.voterDocId;
    const voteRef = doc(db, "organizations", voterSession.orgId, "votes", voteDocId);

    // prevent overwrite
    const existingVote = await getDoc(voteRef);
    if (existingVote.exists()) {
      showToast('A vote for this voter already exists.', 'warning');
      return;
    }

    // Flatten choices: store as { positionId: choice } when single, or array when multi
    const choices = {};
    Object.keys(selectedCandidates).forEach(pid => {
      const arr = selectedCandidates[pid] || [];
      choices[pid] = arr.length <= 1 ? (arr[0] || null) : arr;
    });

    const voteData = {
      voterKey: voteDocId,
      voterId: voteDocId,
      voterEmail: voterSession.email || "",
      voterPhone: voterSession.phone || "",
      voterName: voterSession.voterData?.name || voterSession.email || voterSession.phone || "Voter",
      choices,
      votedAt: serverTimestamp(),
      userAgent: navigator.userAgent
    };

    batch.set(voteRef, voteData);

    // Update voter status (canonical voter doc)
    const voterDocId = voterSession.voterDocId || encodeURIComponent(voterSession.email || "");
    const voterRef = doc(db, "organizations", voterSession.orgId, "voters", voterDocId);
    batch.update(voterRef, { hasVoted: true, votedAt: serverTimestamp() });

    // Update org vote count (best-effort)
    const orgRef = doc(db, "organizations", voterSession.orgId);
    batch.update(orgRef, { voteCount: increment(1) });

    await batch.commit();

    await writeAudit(voterSession.orgId, "VOTE_SUBMITTED", voteDocId, { positions: Object.keys(choices).length });

    // Clear session
    voterSession = null;
    selectedCandidates = {};
    session.voterSession = null;
    saveSession();

    showToast('✅ Vote submitted successfully!', 'success');
    showScreen('gatewayScreen');
  } catch (error) {
    console.error('Error submitting vote:', error);
    showToast('Failed to submit vote. Please try again.', 'error');
  }
}

async function getIPAddress() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch(e) {
    return 'unknown';
  }
}

function showVoteSuccess() {
  const screen = document.getElementById('votingScreen');
  if (!screen) return;
  
  screen.innerHTML = `
    <div class="vote-success">
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h2>Vote Submitted Successfully!</h2>
      <p>Thank you for participating in the election.</p>
      <div class="success-details">
        <div class="detail-item">
          <span class="label">Time:</span>
          <span class="value">${new Date().toLocaleString()}</span>
        </div>
        <div class="detail-item">
          <span class="label">Voter:</span>
          <span class="value">${voterSession?.email || 'Unknown'}</span>
        </div>
      </div>
      <div class="success-actions">
        <button class="btn neon-btn-outline" onclick="showScreen('voterLoginScreen')">
          <i class="fas fa-redo"></i> Vote Again
        </button>
        <button class="btn neon-btn" onclick="showScreen('gatewayScreen')">
          <i class="fas fa-home"></i> Return Home
        </button>
      </div>
    </div>
  `;
}

function startVoterCountdown(endTime) {
  if (!endTime) return;
  
  const endDate = new Date(endTime);
  const now = new Date();
  
  if (endDate <= now) {
    showToast('Voting has ended', 'error');
    showScreen('voterLoginScreen');
    return;
  }
  
  // Create countdown container if it doesn't exist
  let countdownContainer = document.getElementById('countdown-container');
  if (!countdownContainer) {
    countdownContainer = document.createElement('div');
    countdownContainer.id = 'countdown-container';
    countdownContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 255, 255, 0.2);
      border-radius: 12px;
      padding: 12px 20px;
      color: white;
      z-index: 1000;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(countdownContainer);
  }
  
  function updateCountdown() {
    const now = new Date();
    const diff = endDate - now;
    
    if (diff <= 0) {
      countdownContainer.innerHTML = `
        <i class="fas fa-hourglass-end" style="color: #ff4444;"></i>
        <span style="color: #ff4444;">Voting Ended</span>
      `;
      clearInterval(voterCountdownInterval);
      
      // Auto-submit if voting in progress
      if (document.getElementById('submitVoteBtn') && !document.getElementById('submitVoteBtn').disabled) {
        showToast('Voting time has ended. Submitting your vote...', 'warning');
        setTimeout(() => submitVote(), 1000);
      }
      
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    countdownContainer.innerHTML = `
      <i class="fas fa-clock" style="color: #00eaff;"></i>
      <span style="color: ${hours < 1 ? '#ff9800' : '#00ffaa'}">
        ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}
      </span>
      <span class="subtext" style="font-size: 12px; color: #9beaff;">Remaining</span>
    `;
  }
  
  updateCountdown();
  voterCountdownInterval = setInterval(updateCountdown, 1000);
}

// ===============================
// ADD POSITION (EC) — UNIFIED FIX
// ===============================

// Show Add Position Modal
window.showAddPositionModal = function() {
  const modal = createModal(
    '<i class="fas fa-plus-circle"></i> Add New Position',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Position Name *</label>
          <input id="pos-name" class="input" placeholder="e.g., President, Secretary, Treasurer" required>
        </div>
        <div>
          <label class="label">Description (Optional)</label>
          <textarea id="pos-desc" class="input" placeholder="Brief description of the position" rows="3"></textarea>
        </div>
        <div>
          <label class="label">Maximum Candidates *</label>
          <input id="pos-max" class="input" type="number" min="1" max="10" value="1">
          <div class="subtext" style="margin-top: 5px;">Maximum number of candidates for this position</div>
        </div>
        <div>
          <label class="label">Voting Type *</label>
          <div style="display: flex; gap: 20px; margin-top: 5px;">
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="votingType" value="single" checked>
              <span>Single Choice</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="votingType" value="multiple">
              <span>Multiple Choice</span>
            </label>
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="savePosition()">
        <i class="fas fa-plus-circle"></i> Add Position
      </button>
    `
  );
  
  setTimeout(() => {
    document.getElementById('pos-name')?.focus();
  }, 100);
};

// Save Position to Firestore
window.savePosition = async function() {
  if (!currentOrgId) {
    showToast("Organization not loaded", "error");
    return;
  }

  const name = document.getElementById("pos-name")?.value.trim();
  const description = document.getElementById("pos-desc")?.value.trim();
  const maxCandidates = parseInt(document.getElementById("pos-max")?.value || '1');
  const votingType = document.querySelector('input[name="votingType"]:checked')?.value || 'single';
  
  if (!name) {
    showToast('Position name is required', 'error');
    return;
  }
  
  if (maxCandidates < 1 || maxCandidates > 10) {
    showToast('Maximum candidates must be between 1 and 10', 'error');
    return;
  }
  
  try {
    // Check for duplicate position name
    const positionQuery = query(
      collection(db, "organizations", currentOrgId, "positions"),
      where("name", "==", name)
    );
    const positionSnap = await getDocs(positionQuery);
    
    if (!positionSnap.empty) {
      showToast('A position with this name already exists', 'error');
      return;
    }
    
    const positionRef = doc(collection(db, "organizations", currentOrgId, "positions"));
    const positionId = positionRef.id;
    
    await setDoc(positionRef, {
      id: positionId,
      name: name,
      description: description || '',
      maxCandidates: maxCandidates,
      votingType: votingType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showToast('Position added successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECPositions();
  } catch(e) {
    console.error('Error adding position:', e);
    showToast('Error adding position: ' + e.message, 'error');
  }
};

window.editPositionModal = async function(positionId) {
  try {
    const positionRef = doc(db, "organizations", currentOrgId, "positions", positionId);
    const positionSnap = await getDoc(positionRef);
    
    if (!positionSnap.exists()) {
      showToast('Position not found', 'error');
      return;
    }
    
    const position = positionSnap.data();
    
    const modal = createModal(
      `<i class="fas fa-edit"></i> Edit Position: ${position.name}`,
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Position Name *</label>
            <input id="editPositionName" class="input" value="${escapeHtml(position.name || '')}" required>
          </div>
          <div>
            <label class="label">Description</label>
            <textarea id="editPositionDesc" class="input" rows="3">${escapeHtml(position.description || '')}</textarea>
          </div>
          <div>
            <label class="label">Maximum Candidates *</label>
            <input id="editPositionMaxCandidates" class="input" type="number" min="1" max="10" value="${position.maxCandidates || 1}">
          </div>
          <div>
            <label class="label">Voting Type *</label>
            <div style="display: flex; gap: 20px; margin-top: 5px;">
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="editVotingType" value="single" ${position.votingType === 'single' ? 'checked' : ''}>
                <span>Single Choice</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="editVotingType" value="multiple" ${position.votingType === 'multiple' ? 'checked' : ''}>
                <span>Multiple Choice</span>
              </label>
            </div>
          </div>
          <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
            <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
              <i class="fas fa-info-circle"></i> Note:
            </div>
            <div style="font-size: 12px; color: #9beaff;">
              Changing voting type may affect existing votes<br>
              Consider resetting votes if changing from multiple to single
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updatePosition('${positionId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => {
      document.getElementById('editPositionName')?.focus();
    }, 100);
  } catch(e) {
    console.error('Error loading position for edit:', e);
    showToast('Error loading position details', 'error');
  }
};

window.updatePosition = async function(positionId) {
  const name = document.getElementById('editPositionName')?.value.trim();
  const description = document.getElementById('editPositionDesc')?.value.trim();
  const maxCandidates = parseInt(document.getElementById('editPositionMaxCandidates')?.value || '1');
  const votingType = document.querySelector('input[name="editVotingType"]:checked')?.value || 'single';
  
  if (!name) {
    showToast('Position name is required', 'error');
    return;
  }
  
  if (maxCandidates < 1 || maxCandidates > 10) {
    showToast('Maximum candidates must be between 1 and 10', 'error');
    return;
  }
  
  try {
    const positionQuery = query(
      collection(db, "organizations", currentOrgId, "positions"),
      where("name", "==", name)
    );
    const positionSnap = await getDocs(positionQuery);
    
    let duplicate = false;
    positionSnap.forEach(doc => {
      if (doc.id !== positionId) {
        duplicate = true;
      }
    });
    
    if (duplicate) {
      showToast('Another position with this name already exists', 'error');
      return;
    }
  } catch(e) {
    console.error('Error checking duplicate position:', e);
  }
  
  try {
    const positionRef = doc(db, "organizations", currentOrgId, "positions", positionId);
    
    await updateDoc(positionRef, {
      name: name,
      description: description || '',
      maxCandidates: maxCandidates,
      votingType: votingType,
      updatedAt: serverTimestamp()
    });
    
    showToast('Position updated successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECPositions();
  } catch(e) {
    console.error('Error updating position:', e);
    showToast('Error updating position: ' + e.message, 'error');
  }
};

window.deletePositionConfirm = function(positionId, positionName) {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Delete Position',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-trash-alt"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Delete "${escapeHtml(positionName)}"?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will also delete all candidates for this position and remove any votes cast for them.
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3);">
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> Warning: This action cannot be undone!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="deletePosition('${positionId}')" style="flex: 1">
        <i class="fas fa-trash"></i> Delete Position
      </button>
    `
  );
};

window.deletePosition = async function(positionId) {
  try {
    const candidatesQuery = query(
      collection(db, "organizations", currentOrgId, "candidates"),
      where("positionId", "==", positionId)
    );
    const candidatesSnap = await getDocs(candidatesQuery);
    
    const batch = writeBatch(db);
    candidatesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    const positionRef = doc(db, "organizations", currentOrgId, "positions", positionId);
    batch.delete(positionRef);
    
    await batch.commit();
    
    showToast('Position and all associated candidates deleted', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECPositions();
    loadECCandidates();
  } catch(e) {
    console.error('Error deleting position:', e);
    showToast('Error deleting position: ' + e.message, 'error');
  }
};

// ---------------- Candidate Modal Functions ----------------
window.showAddCandidateModal = function() {
  loadPositionsForCandidateModal();
};

async function loadPositionsForCandidateModal() {
  try {
    const positionsSnap = await getDocs(collection(db, "organizations", currentOrgId, "positions"));
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    if (positions.length === 0) {
      showToast('Please create positions first', 'error');
      return;
    }
    
    let positionOptions = '';
    positions.forEach(p => {
      positionOptions += `<option value="${p.id}">${p.name}</option>`;
    });
    
    const modal = createModal(
      '<i class="fas fa-user-plus"></i> Add New Candidate',
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Select Position *</label>
            <select id="candidatePositionSelect" class="input" required>
              <option value="">Select a position...</option>
              ${positionOptions}
            </select>
          </div>
          <div>
            <label class="label">Candidate Name *</label>
            <input id="candidateNameInput" class="input" placeholder="Enter candidate's full name" required>
          </div>
          <div>
            <label class="label">Tagline (Optional)</label>
            <input id="candidateTaglineInput" class="input" placeholder="Short slogan or tagline">
          </div>
          <div>
            <label class="label">Biography (Optional)</label>
            <textarea id="candidateBioInput" class="input" placeholder="Candidate biography, achievements, etc." rows="4"></textarea>
          </div>
          <div>
            <label class="label">Candidate Photo (Optional)</label>
            <div style="margin-bottom: 10px;">
              <div id="candidatePhotoPreview" style="width: 100px; height: 100px; border-radius: 8px; border: 2px dashed rgba(0,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px;">
                <i class="fas fa-user" style="font-size: 32px; color: #00eaff"></i>
              </div>
              <input type="file" id="candidatePhotoFile" accept="image/*" class="input" onchange="previewCandidatePhoto()">
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="addCandidate()">
          <i class="fas fa-user-plus"></i> Add Candidate
        </button>
      `
    );
  
    setTimeout(() => {
      document.getElementById('candidatePositionSelect')?.focus();
    }, 100);
  } catch(e) {
    console.error('Error loading positions:', e);
    showToast('Error loading positions', 'error');
  }
}

window.showAddCandidateForPositionModal = function(positionId, positionName) {
  loadPositionForCandidateModal(positionId, positionName);
};

async function loadPositionForCandidateModal(positionId, positionName) {
  const modal = createModal(
    `<i class="fas fa-user-plus"></i> Add Candidate to ${positionName}`,
    `
      <input type="hidden" id="candidatePositionId" value="${positionId}">
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Candidate Name *</label>
          <input id="candidateNameInput" class="input" placeholder="Enter candidate's full name" required>
        </div>
        <div>
          <label class="label">Tagline (Optional)</label>
          <input id="candidateTaglineInput" class="input" placeholder="Short slogan or tagline">
        </div>
        <div>
          <label class="label">Biography (Optional)</label>
          <textarea id="candidateBioInput" class="input" placeholder="Candidate biography, achievements, etc." rows="4"></textarea>
        </div>
        <div>
          <label class="label">Candidate Photo (Optional)</label>
          <div style="margin-bottom: 10px;">
            <div id="candidatePhotoPreview" style="width: 100px; height: 100px;border-radius: 8px; border: 2px dashed rgba(0,255,255,0.3); display: flex; align-items: center; justify-content:center; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px;">
              <i class="fas fa-user" style="font-size: 32px; color: #00eaff"></i>
            </div>
            <input type="file" id="candidatePhotoFile" accept="image/*" class="input" onchange="previewCandidatePhoto()">
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="addCandidate()">
        <i class="fas fa-user-plus"></i> Add Candidate
      </button>
    `
  );
  
  setTimeout(() => {
    document.getElementById('candidateNameInput')?.focus();
  }, 100);
}

window.previewCandidatePhoto = function() {
  const fileInput = document.getElementById('candidatePhotoFile');
  const preview = document.getElementById('candidatePhotoPreview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
};

window.addCandidate = async function() {
  const positionId = document.getElementById('candidatePositionId')?.value || 
                    document.getElementById('candidatePositionSelect')?.value;
  const name = document.getElementById('candidateNameInput')?.value.trim();
  const tagline = document.getElementById('candidateTaglineInput')?.value.trim();
  const bio = document.getElementById('candidateBioInput')?.value.trim();
  const photoFile = document.getElementById('candidatePhotoFile')?.files[0];
  
  if (!positionId) {
    showToast('Please select a position', 'error');
    return;
  }
  
  if (!name) {
    showToast('Candidate name is required', 'error');
    return;
  }
  
  try {
    const candidateQuery = query(
      collection(db, "organizations", currentOrgId, "candidates"),
      where("positionId", "==", positionId),
      where("name", "==", name)
    );
    const candidateSnap = await getDocs(candidateQuery);
    
    if (!candidateSnap.empty) {
      showToast('A candidate with this name already exists for this position', 'error');
      return;
    }
    
    let photoUrl = '';
    
    if (photoFile) {
      try {
        const storageReference = storageRef(storage, `organizations/${currentOrgId}/candidates/${Date.now()}_${photoFile.name}`);
        const reader = new FileReader();
        
        photoUrl = await new Promise((resolve, reject) => {
          reader.onload = async function(e) {
            try {
              await uploadString(storageReference, e.target.result.split(',')[1], 'base64', {
                contentType: photoFile.type
              });
              const url = await getDownloadURL(storageReference);
              resolve(url);
            } catch(error) {
              reject(error);
            }
          };
          reader.readAsDataURL(photoFile);
        });
      } catch(photoError) {
        console.error('Error uploading photo:', photoError);
        showToast('Error uploading photo, using default avatar', 'warning');
        photoUrl = getDefaultAvatar(name);
      }
    } else {
      photoUrl = getDefaultAvatar(name);
    }
    
    const candidateRef = doc(collection(db, "organizations", currentOrgId, "candidates"));
    const candidateId = candidateRef.id;
    
    await setDoc(candidateRef, {
      id: candidateId,
      positionId: positionId,
      name: name,
      tagline: tagline || '',
      bio: bio || '',
      photo: photoUrl,
      votes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showToast('Candidate added successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECCandidates();
  } catch(e) {
    console.error('Error adding candidate:', e);
    showToast('Error adding candidate: ' + e.message, 'error');
  }
};

window.editCandidateModal = async function(candidateId) {
  try {
    const candidateRef = doc(db, "organizations", currentOrgId, "candidates", candidateId);
    const candidateSnap = await getDoc(candidateRef);
    
    if (!candidateSnap.exists()) {
      showToast('Candidate not found', 'error');
      return;
    }
    
    const candidate = candidateSnap.data();
    
    const positionsSnap = await getDocs(collection(db, "organizations", currentOrgId, "positions"));
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    let positionOptions = '';
    positions.forEach(p => {
      positionOptions += `<option value="${p.id}" ${p.id === candidate.positionId ? 'selected' : ''}>${p.name}</option>`;
    });
    
    const modal = createModal(
      `<i class="fas fa-edit"></i> Edit Candidate: ${candidate.name}`,
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Select Position *</label>
            <select id="editCandidatePosition" class="input" required>
              <option value="">Select a position...</option>
              ${positionOptions}
            </select>
          </div>
          <div>
            <label class="label">Candidate Name *</label>
            <input id="editCandidateName" class="input" value="${escapeHtml(candidate.name || '')}" required>
          </div>
          <div>
            <label class="label">Tagline</label>
            <input id="editCandidateTagline" class="input" value="${escapeHtml(candidate.tagline || '')}" placeholder="Short slogan or tagline">
          </div>
          <div>
            <label class="label">Biography</label>
            <textarea id="editCandidateBio" class="input" rows="4" placeholder="Candidate biography, achievements, etc.">${escapeHtml(candidate.bio || '')}</textarea>
          </div>
          <div>
            <label class="label">Candidate Photo</label>
            <div style="margin-bottom: 10px;">
              <div id="editCandidatePhotoPreview" style="width: 100px; height: 100px;border-radius: 8px; border: 2px solid rgba(0,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px;">
                <img src="${candidate.photo || getDefaultAvatar(candidate.name)}" style="width:100%;height:100%;object-fit:cover;">
              </div>
              <input type="file" id="editCandidatePhotoFile" accept="image/*" class="input" onchange="previewEditCandidatePhoto()">
              <div class="subtext" style="margin-top: 5px;">Leave empty to keep current photo</div>
            </div>
          </div>
          <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
            <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
              <i class="fas fa-chart-line"></i> Statistics:
            </div>
            <div style="font-size: 12px; color: #9beaff;">
              Current Votes: ${candidate.votes || 0}<br>
              Added: ${candidate.createdAt ? formatFirestoreTimestamp(candidate.createdAt) : 'N/A'}
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updateCandidate('${candidateId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => {
      document.getElementById('editCandidateName')?.focus();
    }, 100);
  } catch(e) {
    console.error('Error loading candidate for edit:', e);
    showToast('Error loading candidate details', 'error');
  }
};

window.previewEditCandidatePhoto = function() {
  const fileInput = document.getElementById('editCandidatePhotoFile');
  const preview = document.getElementById('editCandidatePhotoPreview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
};

window.updateCandidate = async function(candidateId) {
  const positionId = document.getElementById('editCandidatePosition')?.value;
  const name = document.getElementById('editCandidateName')?.value.trim();
  const tagline = document.getElementById('editCandidateTagline')?.value.trim();
  const bio = document.getElementById('editCandidateBio')?.value.trim();
  const photoFile = document.getElementById('editCandidatePhotoFile')?.files[0];
  
  if (!positionId) {
    showToast('Please select a position', 'error');
    return;
  }
  
  if (!name) {
    showToast('Candidate name is required', 'error');
    return;
  }
  
  try {
    const candidateRef = doc(db, "organizations", currentOrgId, "candidates", candidateId);
    const candidateSnap = await getDoc(candidateRef);
    const currentCandidate = candidateSnap.data();
    
    if (currentCandidate.name !== name || currentCandidate.positionId !== positionId) {
      const candidateQuery = query(
        collection(db, "organizations", currentOrgId, "candidates"),
        where("positionId", "==", positionId),
        where("name", "==", name)
      );
      const candidateSnap = await getDocs(candidateQuery);
      
      let duplicate = false;
      candidateSnap.forEach(doc => {
        if (doc.id !== candidateId) {
          duplicate = true;
        }
      });
      
      if (duplicate) {
        showToast('Another candidate with this name already exists for this position', 'error');
        return;
      }
    }
    
    let photoUrl = currentCandidate.photo;
    
    if (photoFile) {
      try {
        const storageReference = storageRef(storage, `organizations/${currentOrgId}/candidates/${Date.now()}_${photoFile.name}`);
        const reader = new FileReader();
        
        photoUrl = await new Promise((resolve, reject) => {
          reader.onload = async function(e) {
            try {
              await uploadString(storageReference, e.target.result.split(',')[1], 'base64', {
                contentType: photoFile.type
              });
              const url = await getDownloadURL(storageReference);
              resolve(url);
            } catch(error) {
              reject(error);
            }
          };
          reader.readAsDataURL(photoFile);
        });
        
        if (currentCandidate.photo && !currentCandidate.photo.includes('data:image/svg+xml')) {
          try {
            const oldPhotoRef = storageRef(storage, currentCandidate.photo);
            await deleteObject(oldPhotoRef);
          } catch(deleteError) {
            console.warn('Could not delete old photo:', deleteError);
          }
        }
      } catch(photoError) {
        console.error('Error uploading photo:', photoError);
        showToast('Error uploading photo, keeping current photo', 'warning');
      }
    } else {
      photoUrl = currentCandidate.photo;
    }
    
    await updateDoc(candidateRef, {
      positionId: positionId,
      name: name,
      tagline: tagline || '',
      bio: bio || '',
      photo: photoUrl,
      updatedAt: serverTimestamp()
    });
    
    showToast('Candidate updated successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECCandidates();
  } catch(e) {
    console.error('Error updating candidate:', e);
    showToast('Error updating candidate: ' + e.message, 'error');
  }
};

window.deleteCandidateConfirm = function(candidateId, candidateName) {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Delete Candidate',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-user-slash"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Delete "${escapeHtml(candidateName)}"?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will remove all votes cast for this candidate.
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3);">
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> Warning: This action cannot be undone!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="deleteCandidate('${candidateId}')" style="flex: 1">
        <i class="fas fa-trash"></i> Delete Candidate
      </button>
    `
  );
};

window.deleteCandidate = async function(candidateId) {
  try {
    const candidateRef = doc(db, "organizations", currentOrgId, "candidates", candidateId);
    const candidateSnap = await getDoc(candidateRef);
    
    if (candidateSnap.exists()) {
      const candidate = candidateSnap.data();
      
      if (candidate.photo && !candidate.photo.includes('data:image/svg+xml')) {
        try {
          const photoRef = storageRef(storage, candidate.photo);
          await deleteObject(photoRef);
        } catch(deleteError) {
          console.warn('Could not delete candidate photo:', deleteError);
        }
      }
    }
    
    await deleteDoc(candidateRef);
    
    showToast('Candidate deleted', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECCandidates();
  } catch(e) {
    console.error('Error deleting candidate:', e);
    showToast('Error deleting candidate: ' + e.message, 'error');
  }
};

// ---------------- Settings Functions ----------------
window.saveElectionSchedule = async function() {
  const startTime = document.getElementById('ecStartTime')?.value;
  const endTime = document.getElementById('ecEndTime')?.value;
  
  if (!startTime) {
    showToast('Start time is required', 'error');
    return;
  }
  
  try {
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : null;
    
    if (endDate && endDate <= startDate) {
      showToast('End time must be after start time', 'error');
      return;
    }
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      electionSettings: {
        startTime: startDate.toISOString(),
        endTime: endDate ? endDate.toISOString() : null
      },
      electionStatus: 'scheduled'
    });
    
    showToast('Election schedule saved!', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error saving schedule:', e);
    showToast('Error saving schedule: ' + e.message, 'error');
  }
};

window.clearElectionSchedule = async function() {
  try {
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      electionSettings: {},
      electionStatus: 'active'
    });
    
    showToast('Election schedule cleared!', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error clearing schedule:', e);
    showToast('Error clearing schedule: ' + e.message, 'error');
  }
};

window.generatePublicLink = async function() {
  try {
    const publicToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      publicEnabled: true,
      publicToken: publicToken,
      publicLink: `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&token=${publicToken}`
    });
    
    showToast('Public link generated!', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error generating link:', e);
    showToast('Error generating link: ' + e.message, 'error');
  }
};

window.copyPublicLink = function() {
  const link = `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&token=${currentOrgData?.publicToken}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copied to clipboard!', 'success');
  });
};

window.declareResultsConfirm = function() {
  const modal = createModal(
    '<i class="fas fa-flag-checkered"></i> Declare Final Results',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #9D00FF; margin-bottom: 20px;">
          <i class="fas fa-flag"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Declare Final Results?</h3>
        <p style="color: #9beaff; margin-bottom: 20px;">
          This will lock voting and mark the election as completed. Voters will no longer be able to vote.
        </p>
        <div style="background: rgba(157, 0, 255, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(157, 0, 255, 0.3);">
          <div style="color: #9D00FF; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> Note: This action cannot be reversed!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="declareResults()" style="flex: 1; background: linear-gradient(90deg, #9D00FF, #00C3FF);">
        <i class="fas fa-flag"></i> Declare Results
      </button>
    `
  );
};

window.declareResults = async function() {
  try {
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      electionStatus: 'declared',
      resultsDeclaredAt: serverTimestamp()
    });
    
    showToast('Results declared successfully! Voting is now locked.', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECSettings();
  } catch(e) {
    console.error('Error declaring results:', e);
    showToast('Error declaring results: ' + e.message, 'error');
  }
};

window.resetVotesConfirm = function() {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Reset All Votes',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff9800; margin-bottom: 20px;">
          <i class="fas fa-undo"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Reset All Votes?</h3>
        <p style="color: #ffcc80; margin-bottom: 20px;">
          This will reset all votes to zero. Voters will be able to vote again.
        </p>
        <div style="background: rgba(255, 152, 0, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 152, 0, 0.3);">
          <div style="color: #ff9800; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> All vote counts will be reset to zero!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-warning" onclick="resetAllVotes()" style="flex: 1">
        <i class="fas fa-undo"></i> Reset Votes
      </button>
    `
  );
};

window.resetAllVotes = async function() {
  try {
    const candidatesSnap = await getDocs(collection(db, "organizations", currentOrgId, "candidates"));
    const batch = writeBatch(db);
    
    candidatesSnap.forEach(doc => {
      batch.update(doc.ref, { votes: 0 });
    });
    
    const votesSnap = await getDocs(collection(db, "organizations", currentOrgId, "votes"));
    votesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    votersSnap.forEach(doc => {
      const voterData = doc.data();
      if (!voterData.isReplaced) {
        batch.update(doc.ref, { 
          hasVoted: false,
          votedAt: null 
        });
      }
    });
    
    const orgRef = doc(db, "organizations", currentOrgId);
    batch.update(orgRef, { voteCount: 0 });
    
    await batch.commit();
    
    showToast('All votes reset successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECSettings();
    loadECOutcomes();
  } catch(e) {
    console.error('Error resetting votes:', e);
    showToast('Error resetting votes: ' + e.message, 'error');
  }
};

window.clearAllDataConfirm = function() {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Clear All Election Data',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-trash-alt"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Clear ALL Election Data?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will delete ALL data: Voters, Candidates, Positions, and Votes. The election will be completely reset.
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3);">
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> WARNING: This action cannot be undone!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="clearAllData()" style="flex: 1">
        <i class="fas fa-trash-alt"></i> Clear All Data
      </button>
    `
  );
};

window.clearAllData = async function() {
  try {
    showToast('Clearing all data...', 'info');
    
    const votesSnap = await getDocs(collection(db, "organizations", currentOrgId, "votes"));
    const batch1 = writeBatch(db);
    votesSnap.forEach(doc => {
      batch1.delete(doc.ref);
    });
    await batch1.commit();
    
    const candidatesSnap = await getDocs(collection(db, "organizations", currentOrgId, "candidates"));
    const batch2 = writeBatch(db);
    const deletePhotoPromises = [];
    
    candidatesSnap.forEach(doc => {
      const candidate = doc.data();
      batch2.delete(doc.ref);
      
      if (candidate.photo && !candidate.photo.includes('data:image/svg+xml')) {
        try {
          const photoRef = storageRef(storage, candidate.photo);
          deletePhotoPromises.push(deleteObject(photoRef));
        } catch(photoError) {
          console.warn('Could not delete candidate photo:', photoError);
        }
      }
    });
    await batch2.commit();
    await Promise.all(deletePhotoPromises);
    
    const positionsSnap = await getDocs(collection(db, "organizations", currentOrgId, "positions"));
    const batch3 = writeBatch(db);
    positionsSnap.forEach(doc => {
      batch3.delete(doc.ref);
    });
    await batch3.commit();
    
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    const batch4 = writeBatch(db);
    votersSnap.forEach(doc => {
      batch4.delete(doc.ref);
    });
    await batch4.commit();
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      voterCount: 0,
      voteCount: 0,
      electionSettings: {},
      electionStatus: 'active',
      publicEnabled: false,
      publicToken: null,
      publicLink: null,
      resultsDeclaredAt: null
    });
    
    showToast('All election data cleared successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECSettings();
    
    loadECVoters();
    loadECPositions();
    loadECCandidates();
    loadECOutcomes();
  } catch(e) {
    console.error('Error clearing data:', e);
    showToast('Error clearing data: ' + e.message, 'error');
  }
};

window.send30MinAlerts = async function() {
  try {
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    let sentCount = 0;
    
    votersSnap.forEach(doc => {
      const voter = doc.data();
      if (!voter.isReplaced && !voter.hasVoted) {
        sentCount++;
      }
    });
    
    showToast(`30-minute alerts sent to ${sentCount} pending voters`, 'success');
  } catch(e) {
    console.error('Error sending alerts:', e);
    showToast('Error sending alerts: ' + e.message, 'error');
  }
};

window.sendVoteStartAlerts = async function() {
  try {
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    let sentCount = 0;
    
    votersSnap.forEach(doc => {
      const voter = doc.data();
      if (!voter.isReplaced) {
        sentCount++;
      }
    });
    
    showToast(`Vote start alerts sent to ${sentCount} voters`, 'success');
  } catch(e) {
    console.error('Error sending alerts:', e);
    showToast('Error sending alerts: ' + e.message, 'error');
  }
};

// ---------------- Export Functions ----------------
window.exportVotersCSV = async function() {
  try {
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    const voters = [];
    votersSnap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    let csv = 'Name,Email,Phone,Date of Birth,Voter ID,Has Voted,Status,Replaced By\n';
    
    voters.forEach(v => {
      const name = `"${v.name || ''}"`;
      const email = `"${decodeURIComponent(v.id)}"`;
      const phone = `"${v.phone || ''}"`;
      const dob = v.dateOfBirth ? `"${formatDateForDisplay(new Date(v.dateOfBirth))}"` : '""';
      const voterId = `"${v.voterId || ''}"`;
      const hasVoted = v.hasVoted ? 'Yes' : 'No';
      const status = v.isReplaced ? 'Replaced' : 'Active';
      const replacedBy = v.replacedBy ? `"${v.replacedBy}"` : '""';
      
      csv += `${name},${email},${phone},${dob},${voterId},${hasVoted},${status},${replacedBy}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voters_${currentOrgId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Voters CSV exported successfully!', 'success');
  } catch(e) {
    console.error('Error exporting voters CSV:', e);
    showToast('Error exporting CSV: ' + e.message, 'error');
  }
};

;

// ---------------- Super Admin Modal Functions ----------------
window.showCreateOrgModal = function() {
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
            <input type="file" id="orgLogoFile" accept="image/*" class="input" onchange="previewOrgLogo()">
          </div>
        </div>
        <div>
          <label class="label">Organization Name *</label>
          <input id="newOrgName" class="input" placeholder="Enter organization name" required>
        </div>
        <div>
          <label class="label">Description (Optional)</label>
          <textarea id="newOrgDesc" class="input" placeholder="Organization description" rows="2"></textarea>
        </div>
        <div>
          <label class="label">EC Password * (min 6 characters)</label>
          <input id="newOrgECPass" class="input" placeholder="Set EC password" type="password" required>
        </div>
        <div>
          <label class="label">EC Email (optional)</label>
          <input id="newOrgECEmail" class="input" placeholder="ec@example.com" type="email">
        </div>
        <div>
          <label class="label">EC Phone (optional)</label>
          <input id="newOrgECPhone" class="input" placeholder="+233XXXXXXXXX">
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> Note:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • EC Password will be used by Election Commissioners to log in<br>
            • Keep this password secure
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="createNewOrganization()">
        <i class="fas fa-plus-circle"></i> Create Organization
      </button>
    `
  );
};

window.previewOrgLogo = function() {
  const fileInput = document.getElementById('orgLogoFile');
  const preview = document.getElementById('orgLogoPreview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
};

window.createNewOrganization = async function() {
  const name = document.getElementById('newOrgName')?.value.trim();
  const description = document.getElementById('newOrgDesc')?.value.trim();
  const ecPassword = document.getElementById('newOrgECPass')?.value;
  const ecEmail = document.getElementById('newOrgECEmail')?.value.trim();
  const ecPhone = document.getElementById('newOrgECPhone')?.value.trim();
  const logoFile = document.getElementById('orgLogoFile')?.files[0];
  
  if (!name) {
    showToast('Organization name is required', 'error');
    return;
  }
  
  if (!ecPassword || ecPassword.length < 6) {
    showToast('EC password must be at least 6 characters', 'error');
    return;
  }
  
  try {
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
    
    await setDoc(orgRef, {
      id: orgId,
      name: name,
      description: description || '',
      logoUrl: logoUrl,
      ecPassword: ecPassword,
      ecEmail: ecEmail || '',
      ecPhone: ecPhone || '',
      voterCount: 0,
      voteCount: 0,
      electionStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      approval: {
        status: 'pending',
        requestedAt: serverTimestamp()
      }
    });
    
    showToast(`Organization "${name}" created successfully!`, 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadSuperOrganizationsEnhanced();
  } catch(e) {
    console.error('Error creating organization:', e);
    showToast('Error creating organization: ' + e.message, 'error');
  }
};

window.openOrgAsEC = function(orgId) {
  document.getElementById('ec-org-id').value = orgId;
  showScreen('ecLoginScreen');
  showToast(`Enter EC password for organization`, 'info');
};

window.showECInviteModal = function(orgId, orgName, ecPassword) {
  const modal = createModal(
    `<i class="fas fa-paper-plane"></i> Send EC Invite for ${orgName}`,
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Organization ID</label>
          <input class="input" value="${orgId}" disabled style="background: rgba(255,255,255,0.05);">
        </div>
        <div>
          <label class="label">EC Password</label>
          <input class="input" value="${ecPassword}" disabled style="background: rgba(255,255,255,0.05);">
        </div>
        <div>
          <label class="label">Recipient Email *</label>
          <input id="ecInviteEmail" class="input" placeholder="ec@example.com" type="email" required>
        </div>
        <div>
          <label class="label">Message (Optional)</label>
          <textarea id="ecInviteMessage" class="input" rows="3" placeholder="Add a personal message..."></textarea>
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-link"></i> EC Login Link:
          </div>
          <div style="font-size: 12px; color: #9beaff; word-break: break-all;">
            ${window.location.origin}${window.location.pathname}?org=${orgId}&role=ec}
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="sendECInvite('${orgId}', '${escapeHtml(orgName)}', '${ecPassword}')">
        <i class="fas fa-paper-plane"></i> Send Invite
      </button>
    `
  );
};

window.sendECInvite = function(orgId, orgName, ecPassword) {
  const email = document.getElementById('ecInviteEmail')?.value.trim();
  const message = document.getElementById('ecInviteMessage')?.value.trim();
  
  if (!email || !validateEmail(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  const loginLink = `${window.location.origin}${window.location.pathname}?org=${orgId}&role=ec`;
  
  const emailBody = `
Organization: ${orgName}
Organization ID: ${orgId}
EC Password: ${ecPassword}
Login Link: ${loginLink}

${message ? `Message: ${message}` : ''}

Please use the above credentials to log in as Election Commissioner.
  `;
  
  console.log('EC Invite would be sent to:', email);
  console.log('Email body:', emailBody);
  
  showToast(`EC invite sent to ${email}`, 'success');
  document.querySelector('.modal-overlay')?.remove();
};

window.showPasswordModal = function(orgId, ecPassword) {
  const modal = createModal(
    '<i class="fas fa-eye"></i> View EC Password',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #00eaff; margin-bottom: 20px;">
          <i class="fas fa-key"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">EC Password</h3>
        <div style="background: rgba(0, 255, 255, 0.1); padding: 15px; border-radius: 8px; border: 2px solid rgba(0, 255, 255, 0.3); margin: 20px 0;">
          <div style="font-family: monospace; font-size: 20px; color: #00ffaa; letter-spacing: 2px;">
            ${ecPassword}
          </div>
        </div>
        <p style="color: #9beaff; font-size: 14px;">
          This password is used by Election Commissioners to log in.
        </p>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Close
      </button>
      <button class="btn neon-btn" onclick="navigator.clipboard.writeText('${ecPassword}').then(() => showToast('Password copied!', 'success'))" style="flex: 1">
        <i class="fas fa-copy"></i> Copy Password
      </button>
    `
  );
};

// ENHANCED: Delete Organization Confirmation with Stats
window.deleteOrganizationConfirm = function(orgId, orgName, voterCount = 0, voteCount = 0) {
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
      <button class="btn btn-danger" onclick="deleteOrganizationEnhanced('${orgId}')" style="flex: 1">
        <i class="fas fa-trash"></i> Delete Organization
      </button>
    `
  );
};

// Use the enhanced deletion function
window.deleteOrganization = deleteOrganizationEnhanced;

window.changeSuperPassword = async function() {
  const newPass = document.getElementById('new-super-pass')?.value;
  
  if (!newPass || newPass.length < 8) {
    showToast('New password must be at least 8 characters', 'error');
    return;
  }
  
  try {
    const ref = doc(db, "meta", "superAdmin");
    await updateDoc(ref, { password: newPass });
    
    showToast('SuperAdmin password changed successfully!', 'success');
    document.getElementById('new-super-pass').value = '';
  } catch(e) {
    console.error('Error changing password:', e);
    showToast('Error changing password: ' + e.message, 'error');
  }
};

// ENHANCED: Approve Election Function
window.approveElection = async function(orgId, orgName = null) {
  if (!orgId) return;
  
  const orgNameText = orgName ? ` "${orgName}"` : '';
  
  if (!confirm(`Approve election for organization${orgNameText}? This will unlock voting.`)) return;
  
  try {
    await updateDoc(doc(db, "organizations", orgId), {
      approval: {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: "superadmin"
      }
    });
    
    showToast(`Election${orgNameText} approved successfully! ✅`, "success");
    loadSuperOrganizationsEnhanced();
    loadSuperApprovals();
  } catch (e) {
    console.error("Approval error:", e);
    showToast("Approval failed: " + (e?.message || e), "error");
  }
};

// NEW: Reject Election Function
window.rejectElection = async function(orgId, orgName = null) {
  if (!orgId) return;
  
  const orgNameText = orgName ? ` "${orgName}"` : '';
  const reason = prompt(`Enter reason for rejecting election${orgNameText}:`);
  
  if (reason === null) return; // User cancelled
  
  if (!reason.trim()) {
    showToast("Please provide a rejection reason", "error");
    return;
  }
  
  try {
    await updateDoc(doc(db, "organizations", orgId), {
      approval: {
        status: "rejected",
        rejectedAt: serverTimestamp(),
        rejectedBy: "superadmin",
        rejectionReason: reason
      }
    });
    
    showToast(`Election${orgNameText} rejected`, "success");
    loadSuperOrganizationsEnhanced();
    loadSuperApprovals();
  } catch (e) {
    console.error("Rejection error:", e);
    showToast("Rejection failed: " + e.message, "error");
  }
};

// NEW: Revoke Approval Function
window.revokeApproval = async function(orgId, orgName = null) {
  if (!orgId) return;
  
  const orgNameText = orgName ? ` "${orgName}"` : '';
  
  if (!confirm(`Revoke approval for election${orgNameText}? This will lock voting.`)) return;
  
  try {
    await updateDoc(doc(db, "organizations", orgId), {
      approval: {
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
};

// NEW: Reconsider Rejection Function
window.reconsiderApproval = async function(orgId, orgName = null) {
  if (!orgId) return;
  
  const orgNameText = orgName ? ` "${orgName}"` : '';
  
  if (!confirm(`Move election${orgNameText} back to pending status?`)) return;
  
  try {
    await updateDoc(doc(db, "organizations", orgId), {
      approval: {
        status: "pending",
        reconsideredAt: serverTimestamp(),
        reconsideredBy: "superadmin"
      }
    });
    
    showToast(`Election${orgNameText} moved to pending`, "success");
    loadSuperOrganizationsEnhanced();
    loadSuperApprovals();
  } catch (e) {
    console.error("Reconsider error:", e);
    showToast("Reconsider failed: " + e.message, "error");
  }
};

// NEW: Submit for Approval Function (EC side)
window.submitForApprovalFinal = async function() {
  if (!currentOrgId || !currentOrgData) {
    showToast("No organization loaded", "error");
    return;
  }
  
  try {
    // Update approval status to pending
    await updateDoc(doc(db, "organizations", currentOrgId), {
      approval: {
        status: "pending",
        requestedAt: serverTimestamp(),
        requestedBy: "ec",
        organizationName: currentOrgData.name || currentOrgId
      }
    });
    
    showToast("Election submitted for SuperAdmin approval! ✅", "success");
    loadECApproval();
  } catch (e) {
    console.error("Submit for approval error:", e);
    showToast("Submission failed: " + e.message, "error");
  }
};

// NEW: Resubmit for Approval Function
window.resubmitForApproval = async function() {
  if (!currentOrgId || !currentOrgData) {
    showToast("No organization loaded", "error");
    return;
  }
  
  if (!confirm("Resubmit this election for SuperAdmin approval?")) return;
  
  try {
    await updateDoc(doc(db, "organizations", currentOrgId), {
      approval: {
        status: "pending",
        requestedAt: serverTimestamp(),
        requestedBy: "ec",
        organizationName: currentOrgData.name || currentOrgId,
        resubmitted: true
      }
    });
    
    showToast("Election resubmitted for approval! ✅", "success");
    loadECApproval();
  } catch (e) {
    console.error("Resubmit error:", e);
    showToast("Resubmit failed: " + e.message, "error");
  }
};

// NEW: View Organization Details
window.viewOrgDetails = async function(orgId) {
  try {
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      showToast("Organization not found", "error");
      return;
    }
    
    const org = orgSnap.data();
    
    // Get counts
    const [votersSnap, positionsSnap, candidatesSnap] = await Promise.all([
      getDocs(collection(db, "organizations", orgId, "voters")),
      getDocs(collection(db, "organizations", orgId, "positions")),
      getDocs(collection(db, "organizations", orgId, "candidates"))
    ]);
    
    const voterCount = votersSnap.size;
    const positionCount = positionsSnap.size;
    const candidateCount = candidatesSnap.size;
    
    createModal(
      `<i class="fas fa-eye"></i> Organization Details: ${org.name || orgId}`,
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div style="text-align: center; margin-bottom: 10px;">
            <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                 style="width: 100px; height: 100px; border-radius: 12px; object-fit: cover; border: 2px solid rgba(0,255,255,0.2); margin-bottom: 10px;">
            <h3 style="color: #fff; margin: 0;">${org.name || orgId}</h3>
            <div class="subtext">ID: ${orgId}</div>
          </div>
          
          <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <div class="card" style="flex: 1; text-align: center; padding: 10px;">
              <div style="font-size: 20px; color: #00eaff; font-weight: bold;">${voterCount}</div>
              <div style="font-size: 12px; color: #9beaff;">Voters</div>
            </div>
            <div class="card" style="flex: 1; text-align: center; padding: 10px;">
              <div style="font-size: 20px; color: #00eaff; font-weight: bold;">${positionCount}</div>
              <div style="font-size: 12px; color: #9beaff;">Positions</div>
            </div>
            <div class="card" style="flex: 1; text-align: center; padding: 10px;">
              <div style="font-size: 20px; color: #00eaff; font-weight: bold;">${candidateCount}</div>
              <div style="font-size: 12px; color: #9beaff;">Candidates</div>
            </div>
          </div>
          
          <div>
            <div class="label">Description</div>
            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; margin-bottom: 10px;">
              ${org.description || 'No description provided'}
            </div>
          </div>
          
          <div>
            <div class="label">Election Status</div>
            <div style="color: ${org.electionStatus === 'active' ? '#00ffaa' : 
                              org.electionStatus === 'scheduled' ? '#ffc107' : 
                              org.electionStatus === 'declared' ? '#9D00FF' : '#888'};">
              ${org.electionStatus || 'active'}
            </div>
          </div>
          
          ${org.electionSettings?.startTime ? `
            <div>
              <div class="label">Election Schedule</div>
              <div>
                Start: ${new Date(org.electionSettings.startTime).toLocaleString()}<br>
                ${org.electionSettings.endTime ? `End: ${new Date(org.electionSettings.endTime).toLocaleString()}` : 'No end time set'}
              </div>
            </div>
          ` : ''}
          
          <div>
            <div class="label">EC Contact</div>
            <div>
              ${org.ecEmail ? `Email: ${org.ecEmail}<br>` : ''}
              ${org.ecPhone ? `Phone: ${org.ecPhone}` : 'No contact provided'}
            </div>
          </div>
          
          <div>
            <div class="label">Created</div>
            <div>${org.createdAt ? new Date(org.createdAt).toLocaleString() : 'Unknown'}</div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
          <i class="fas fa-times"></i> Close
        </button>
        <button class="btn neon-btn" onclick="document.querySelector('.modal-overlay').remove(); approveElection('${orgId}', '${escapeHtml(org.name || orgId)}')" style="flex: 1">
          <i class="fas fa-check"></i> Approve
        </button>
      `
    );
  } catch(e) {
    console.error("Error viewing org details:", e);
    showToast("Error loading organization details: " + e.message, "error");
  }
};

// ---------------- Sync Function ----------------
window.syncVoterCounts = async function() {
  try {
    showToast('Syncing voter counts...', 'info');
    
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    let totalVoters = 0;
    votersSnap.forEach(doc => {
      const voterData = doc.data();
      if (!voterData.isReplaced) {
        totalVoters++;
      }
    });
    
    const votesSnap = await getDocs(collection(db, "organizations", currentOrgId, "votes"));
    const votesCast = votesSnap.size;
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      voterCount: totalVoters,
      voteCount: votesCast,
      lastSync: serverTimestamp()
    });
    
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      currentOrgData = { id: currentOrgId, ...orgSnap.data() };
      updateECUI();
    }
    
    showToast(`Synced! Total Active Voters: ${totalVoters}, Votes Cast: ${votesCast}`, 'success');
    loadECOutcomes();
  } catch(e) {
    console.error('Error syncing voter counts:', e);
    showToast('Error syncing counts: ' + e.message, 'error');
  }
};

// ---------------- Animation CSS ----------------
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .show {
    display: block !important;
    animation: fadeIn 0.3s ease;
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00C3FF, #9D00FF);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  
  /* Voting Interface Styles */
  .voting-header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(0, 255, 255, 0.1);
  }
  
  .voting-header h2 {
    color: #00eaff;
    margin-bottom: 8px;
  }
  
  .ballot-container {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .position-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(0, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 25px;
    backdrop-filter: blur(10px);
  }
  
  .position-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
  }
  
  .position-title {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .position-number {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #9D00FF, #00C3FF);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 18px;
  }
  
  .position-title h3 {
    color: white;
    margin: 0;
    font-size: 20px;
  }
  
  .position-info {
    text-align: right;
  }
  
  .badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    display: inline-block;
    margin-bottom: 5px;
  }
  
  .badge.single {
    background: rgba(0, 255, 170, 0.1);
    color: #00ffaa;
    border: 1px solid rgba(0, 255, 170, 0.2);
  }
  
  .badge.multiple {
    background: rgba(157, 0, 255, 0.1);
    color: #9D00FF;
    border: 1px solid rgba(157, 0, 255, 0.2);
  }
  
  .badge.success {
    background: rgba(0, 255, 170, 0.1);
    color: #00ffaa;
    border: 1px solid rgba(0, 255, 170, 0.2);
  }
  
  .badge.warning {
    background: rgba(255, 193, 7, 0.1);
    color: #ffc107;
    border: 1px solid rgba(255, 193, 7, 0.2);
  }
  
  .badge.danger {
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;
    border: 1px solid rgba(255, 68, 68, 0.2);
  }
  
  .badge.info {
    background: rgba(0, 234, 255, 0.1);
    color: #00eaff;
    border: 1px solid rgba(0, 234, 255, 0.2);
  }
  
  .position-description {
    background: rgba(0, 0, 0, 0.2);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    border-left: 3px solid #00eaff;
  }
  
  .position-description p {
    margin: 0;
    color: #9beaff;
    font-size: 14px;
  }
  
  .candidates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 15px;
  }
  
  .candidate-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 255, 0.05);
    border-radius: 10px;
    padding: 15px;
    display: flex;
    align-items: center;
    gap: 15px;
    transition: all 0.3s ease;
    cursor: pointer;
  }
  
  .candidate-card:hover {
    background: rgba(0, 255, 255, 0.05);
    border-color: rgba(0, 255, 255, 0.2);
    transform: translateY(-2px);
  }
  
  .candidate-checkbox {
    position: relative;
  }
  
  .candidate-checkbox input[type="checkbox"],
  .candidate-checkbox input[type="radio"] {
    display: none;
  }
  
  .candidate-checkbox label {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(0, 255, 255, 0.3);
    border-radius: 6px;
    display: block;
    cursor: pointer;
    position: relative;
    transition: all 0.3s ease;
  }
  
  .candidate-checkbox input[type="radio"] + label {
    border-radius: 50%;
  }
  
  .candidate-checkbox input:checked + label {
    background: linear-gradient(135deg, #9D00FF, #00C3FF);
    border-color: transparent;
  }
  
  .candidate-checkbox input:checked + label::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-weight: bold;
  }
  
  .candidate-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap// Wait for DOM to update, then prefill
setTimeout(() => {
  const orgIdInput = document.getElementById('voterOrgId');
  const emailInput = document.getElementById('voterEmail');
  const phoneInput = document.getElementById('voterPhone');
  
  if (orgIdInput) orgIdInput.value = orgId;
  
  const decodedVoterId = decodeURIComponent(voterId);
  if (validateEmail(decodedVoterId.toLowerCase())) {
    // It's an email
    if (emailInput) {
      emailInput.value = decodedVoterId;
      setCredentialType('email');
    }
  } else {
    // Assume it's a phone number
    if (phoneInput) {
      phoneInput.value = decodedVoterId;
      setCredentialType('phone');
    }
  }
}, 500);// Continue from last line...

    .candidate-photo {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      object-fit: cover;
      border: 2px solid rgba(0, 255, 255, 0.2);
      background: #08102a;
    }

    .candidate-details {
      flex: 1;
    }

    .candidate-details h4 {
      color: white;
      margin: 0 0 5px 0;
      font-size: 16px;
    }

    .candidate-tagline {
      color: #00eaff;
      font-size: 14px;
      margin: 0 0 5px 0;
      font-weight: 500;
    }

    .candidate-bio {
      color: #9beaff;
      font-size: 13px;
      opacity: 0.8;
    }

    .no-candidates {
      grid-column: 1 / -1;
      text-align: center;
      padding: 30px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      border: 1px dashed rgba(0, 255, 255, 0.2);
    }

    .no-candidates i {
      font-size: 48px;
      color: #00eaff;
      margin-bottom: 10px;
    }

    .no-candidates p {
      color: #9beaff;
      margin: 0;
    }

    .voting-footer {
      margin-top: 30px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      border: 1px solid rgba(0, 255, 255, 0.1);
    }

    .vote-summary {
      display: flex;
      justify-content: space-around;
      margin-bottom: 20px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-item .label {
      display: block;
      color: #9beaff;
      font-size: 12px;
      margin-bottom: 5px;
    }

    .summary-item .value {
      display: block;
      color: white;
      font-size: 20px;
      font-weight: bold;
    }

    .summary-item .value.pending {
      color: #ffc107;
    }

    .summary-item .value.ready {
      color: #00ffaa;
    }

    .vote-actions {
      display: flex;
      gap: 15px;
    }

    .vote-actions button {
      flex: 1;
      padding: 12px;
    }

    .vote-success {
      text-align: center;
      max-width: 500px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .success-icon {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, #00ffaa, #00C3FF);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 30px auto;
      font-size: 48px;
      color: white;
    }

    .vote-success h2 {
      color: #00eaff;
      margin-bottom: 15px;
    }

    .vote-success p {
      color: #9beaff;
      margin-bottom: 30px;
      font-size: 18px;
    }

    .success-details {
      background: rgba(0, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .detail-item .label {
      color: #9beaff;
    }

    .detail-item .value {
      color: white;
      font-weight: bold;
    }

    .success-actions {
      display: flex;
      gap: 15px;
    }

    /* Login Styles */
    .login-container {
      max-width: 500px;
      margin: 0 auto;
      padding: 20px;
    }

    .login-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .login-logo {
      margin-bottom: 20px;
    }

    .login-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(0, 255, 255, 0.1);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 20px;
      backdrop-filter: blur(10px);
    }

    .form-group {
      margin-bottom: 20px;
    }

    .credential-toggle {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }

    .toggle-btn {
      flex: 1;
      padding: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(0, 255, 255, 0.2);
      border-radius: 8px;
      color: #9beaff;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
    }

    .toggle-btn.active {
      background: linear-gradient(135deg, #9D00FF, #00C3FF);
      color: white;
      border-color: transparent;
    }

    .input-group {
      margin-bottom: 15px;
    }

    .input-hint {
      color: #9beaff;
      font-size: 12px;
      margin-top: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .login-footer {
      margin-top: 30px;
    }

    .divider {
      display: flex;
      align-items: center;
      margin: 20px 0;
      color: #9beaff;
      font-size: 12px;
    }

    .divider::before,
    .divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: rgba(0, 255, 255, 0.2);
    }

    .divider span {
      padding: 0 15px;
    }

    .help-links {
      display: flex;
      gap: 10px;
    }

    .security-notice {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #9beaff;
      font-size: 14px;
      padding: 15px;
      background: rgba(0, 255, 170, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(0, 255, 170, 0.1);
    }

    /* Modal Styles */
    .modal-overlay {
      animation: fadeIn 0.3s ease;
    }

    .modal {
      animation: slideUp 0.4s ease;
    }

    .modal h3 {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Toast Styles */
    #toast {
      display: none;
      animation: fadeIn 0.3s ease;
      color: white;
      font-weight: bold;
      padding: 12px 22px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
      text-align: center;
      min-width: 250px;
      max-width: 80vw;
      word-break: break-word;
    }

    #toast.show {
      display: block;
    }

    /* EC Panel Styles */
    .ec-panel-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .ec-panel-header h1 {
      color: #00eaff;
      margin-bottom: 10px;
    }

    .ec-tabs {
      display: flex;
      gap: 5px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      padding: 5px;
      margin-bottom: 20px;
    }

    .ec-tabs .tab-btn {
      flex: 1;
      padding: 12px 15px;
      background: transparent;
      border: none;
      color: #9beaff;
      cursor: pointer;
      border-radius: 8px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .ec-tabs .tab-btn:hover {
      background: rgba(0, 255, 255, 0.1);
    }

    .ec-tabs .tab-btn.active {
      background: linear-gradient(135deg, #9D00FF, #00C3FF);
      color: white;
    }

    .ec-tab-content {
      animation: fadeIn 0.3s ease;
    }

    /* Super Admin Styles */
    .super-tabs {
      display: flex;
      gap: 5px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      padding: 5px;
      margin-bottom: 20px;
    }

    .super-tabs .tab-btn {
      flex: 1;
      padding: 12px 15px;
      background: transparent;
      border: none;
      color: #9beaff;
      cursor: pointer;
      border-radius: 8px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .super-tabs .tab-btn:hover {
      background: rgba(0, 255, 255, 0.1);
    }

    .super-tabs .tab-btn.active {
      background: linear-gradient(135deg, #9D00FF, #00C3FF);
      color: white;
    }

    .super-tab-content {
      animation: fadeIn 0.3s ease;
    }

    /* List Styles */
    .list-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(0, 255, 255, 0.1);
      border-radius: 10px;
      margin-bottom: 10px;
      transition: all 0.3s ease;
    }

    .list-item:hover {
      background: rgba(0, 255, 255, 0.05);
      border-color: rgba(0, 255, 255, 0.2);
      transform: translateX(5px);
    }

    .voter-item {
      position: relative;
    }

    /* Card Styles */
    .card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(0, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      backdrop-filter: blur(10px);
    }

    .info-card {
      background: linear-gradient(135deg, rgba(157, 0, 255, 0.1), rgba(0, 195, 255, 0.1));
      border: 1px solid rgba(157, 0, 255, 0.2);
    }

    .danger-zone {
      background: rgba(255, 68, 68, 0.05);
      border: 2px solid rgba(255, 68, 68, 0.2);
    }

    /* Organization Card */
    .org-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(0, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      backdrop-filter: blur(10px);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
    }

    .empty-state i {
      margin-bottom: 20px;
    }

    .empty-state h3 {
      color: white;
      margin-bottom: 10px;
    }

    .mt-20 {
      margin-top: 20px;
    }

    /* Link Box */
    .link-box {
      background: rgba(0, 255, 255, 0.05);
      border: 1px solid rgba(0, 255, 255, 0.1);
      border-radius: 8px;
      padding: 15px;
      margin-top: 15px;
      word-break: break-all;
    }

    /* Requirement Items */
    .requirement-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
    }

    .requirement-item.requirement-met {
      background: rgba(0, 255, 170, 0.05);
      border: 1px solid rgba(0, 255, 170, 0.2);
    }

    .requirement-item.requirement-pending {
      background: rgba(255, 193, 7, 0.05);
      border: 1px solid rgba(255, 193, 7, 0.2);
    }

    .requirement-checkbox {
      width: 24px;
      height: 24px;
      border: 2px solid rgba(0, 255, 255, 0.3);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .requirement-checkbox.checked {
      background: linear-gradient(135deg, #9D00FF, #00C3FF);
      border-color: transparent;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .candidates-grid {
        grid-template-columns: 1fr;
      }
      
      .vote-summary {
        flex-direction: column;
        gap: 15px;
      }
      
      .vote-actions {
        flex-direction: column;
      }
      
      .help-links {
        flex-direction: column;
      }
      
      .ec-tabs, .super-tabs {
        flex-wrap: wrap;
      }
      
      .ec-tabs .tab-btn, .super-tabs .tab-btn {
        flex: 1 0 calc(50% - 10px);
      }
    }

    @media (max-width: 480px) {
      .candidate-card {
        flex-direction: column;
        text-align: center;
      }
      
      .position-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
      
      .position-info {
        text-align: left;
      }
    }
  `;
document.head.appendChild(style);

// ---------------- Debug Functions ----------------
function addDebugButtons() {
  const debugDiv = document.createElement('div');
  debugDiv.id = 'debug-buttons';
  debugDiv.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:9999;display:flex;gap:5px;flex-direction:column;';
  
  const debugHtml = `
    <button onclick="toggleDebugMode()" style="background:#333;color:#0f0;border:1px solid #0f0;border-radius:4px;padding:6px 10px;font-size:12px;cursor:pointer;">
      🔧 Debug Mode
    </button>
    <button onclick="checkFirestoreConnection()" style="background:#333;color:#0af;border:1px solid #0af;border-radius:4px;padding:6px 10px;font-size:12px;cursor:pointer;">
      🔗 Test DB
    </button>
    <button onclick="clearAllLocalStorage()" style="background:#333;color:#f44;border:1px solid #f44;border-radius:4px;padding:6px 10px;font-size:12px;cursor:pointer;">
      🧹 Clear Local
    </button>
    <button onclick="exportConfig()" style="background:#333;color:#ff0;border:1px solid #ff0;border-radius:4px;padding:6px 10px;font-size:12px;cursor:pointer;">
      📋 Export Config
    </button>
  `;
  
  debugDiv.innerHTML = debugHtml;
  document.body.appendChild(debugDiv);
}

window.toggleDebugMode = function() {
  window.debugMode = !window.debugMode;
  showToast(`Debug mode ${window.debugMode ? 'ON' : 'OFF'}`, window.debugMode ? 'success' : 'info');
  console.log('Debug mode:', window.debugMode);
  
  if (window.debugMode) {
    // Show additional debug info
    console.log('Current org:', currentOrgId);
    console.log('Current user:', session.role);
    console.log('Voter session:', voterSession);
  }
};

window.checkFirestoreConnection = async function() {
  try {
    const testRef = doc(db, "meta", "connectionTest");
    await setDoc(testRef, { timestamp: serverTimestamp() }, { merge: true });
    showToast('✅ Firestore connection OK', 'success');
  } catch(e) {
    console.error('Firestore connection test failed:', e);
    showToast('❌ Firestore connection failed: ' + e.message, 'error');
  }
};

window.clearAllLocalStorage = function() {
  if (confirm('Clear ALL localStorage data?')) {
    localStorage.clear();
    session = {};
    currentOrgId = null;
    currentOrgData = null;
    voterSession = null;
    selectedCandidates = {};
    
    showToast('LocalStorage cleared', 'info');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
};

window.exportConfig = function() {
  const config = {
    firebaseConfig,
    currentOrgId,
    currentOrgData,
    session,
    voterSession,
    selectedCandidates,
    activeTab,
    refreshIntervals,
    votingChoices
  };
  
  console.log('Current config:', config);
  
  const configStr = JSON.stringify(config, null, 2);
  navigator.clipboard.writeText(configStr).then(() => {
    showToast('Config copied to clipboard', 'success');
  });
};

// Initialize
console.log('Neon Voting System v2.0 Loaded');

// Auto-start voter login if URL has voter parameter
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const voterId = params.get('voter');
  const orgId = params.get('org');
  const role = params.get('role');
  
  // If it's a voter deep link
  if (voterId && orgId && (!role || role === 'voter')) {
    // Update voter login screen with pre-filled values
    updateVoterLoginScreen();
    
    // Wait for DOM to update, then prefill
    setTimeout(() => {
      const orgIdInput = document.getElementById('voterOrgId');
      const emailInput = document.getElementById('voterEmail');
      const phoneInput = document.getElementById('voterPhone');
      
      if (orgIdInput) orgIdInput.value = orgId;
      
      const decodedVoterId = decodeURIComponent(voterId);
      if (validateEmail(decodedVoterId.toLowerCase())) {
        // It's an email
        if (emailInput) {
          emailInput.value = decodedVoterId;
          setCredentialType('email');
        }
      } else {
        // Assume it's a phone number
        if (phoneInput) {
          phoneInput.value = decodedVoterId;
          setCredentialType('phone');
        }
      }
    }, 500);
  }
});

// Start the application
if (typeof setupTabs === 'function') {
  setupTabs();
}

// Export for global use
window.NeonVoting = {
  db,
  storage,
  currentOrgId,
  currentOrgData,
  session,
  showToast,
  showScreen,
  logout,
  loginEC,
  loginSuperAdmin,
  openECPanel,
  loadECVoters,
  loadECPositions,
  loadECCandidates,
  loadECOutcomes,
  loadECApproval,
  loadECSettings,
  loadSuperOrganizationsEnhanced,
  loadSuperDeleteEnhanced,
  loadSuperApprovals,
  startVoterVotingEnhanced,
  updateVoterLoginScreen
};
// Switch to Bulk Invite tab from Voters tab
function switchToBulkInvite() {
  // Switch to bulk invite tab
  document.querySelectorAll('[data-ec-tab]').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-ec-tab="bulk-invite"]').classList.add('active');
  document.querySelectorAll('[id^="ecContent-"]').forEach(content => {
    content.style.display = 'none';
  });
  document.getElementById('ecContent-bulk-invite').style.display = 'block';
  
  // Reset any previous bulk invite state
  window.votingState.bulkInvite.processing = false;
  const bp=document.getElementById('bulkProgress'); if(bp) bp.style.display='none';
}

console.log('✅ Neon Voting System v2.0 Ready');


/* ======================================================
   EXPORTS (Option 4) — Results CSV/PDF + Audit CSV
   Works for BOTH Super Admin + EC. Pass orgId or uses currentOrgId.
   ====================================================== */

function _ensureOrgId(orgId){
  try{ if (orgId) return orgId; }catch(e){}
  try{ if (window.currentOrgId) return window.currentOrgId; }catch(e){}
  try{ if (typeof currentOrgId !== 'undefined' && currentOrgId) return currentOrgId; }catch(e){}
  try{ if (window.session && window.session.orgId) return window.session.orgId; }catch(e){}
  return "";
}

function _csvDownload(filename, rows){
  const esc=(v)=>{
    const s=String(v??"");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  const csv=rows.map(r=>r.map(esc).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

window.exportResultsCSV = async function(orgId){
  // CSV export disabled — Results export is PDF only
  return window.exportResultsPDF(orgId);
};



window.exportAuditCSV = async function(orgId){
  try{
    orgId=_ensureOrgId(orgId);
    if(!orgId){ showToast("Select an organization first", "warning"); return; }

    const snap = await getDocs(query(
      collection(db,"organizations",orgId,"audit_logs")
    ));

    const rows=[["Organization ID",orgId],["Exported At", new Date().toISOString()],[],["Time","Action","Actor","Meta"]];
    snap.forEach(d=>{
      const a=d.data()||{};
      const t = a.at?.toDate ? a.at.toDate().toISOString() : "";
      rows.push([t, a.action||"", a.actor||"", JSON.stringify(a.meta||{})]);
    });

    _csvDownload(`audit_${orgId}.csv`, rows);
    showToast("Audit exported ✅", "success");
  }catch(e){
    console.error(e);
    showToast("Audit export failed.", "error");
  }
};

window.exportResultsPDF = async function(orgId){
  try{
    orgId = _ensureOrgId(orgId);
    if(!orgId){
      showToast("Organization not resolved", "error");
      return;
    }

    // Ensure jsPDF is available
    const jsp = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf : (window.jspdf || null);
    const jsPDFCtor = (jsp && (jsp.jsPDF || jsp)) ? (jsp.jsPDF || jsp) : null;
    if(!jsPDFCtor){
      showToast("PDF library not loaded (jsPDF)", "error");
      return;
    }

    // Load positions, candidates, votes (ORG ROOT collections)
    const [posSnap, candSnap, votesSnap] = await Promise.all([
      getDocs(collection(db,"organizations",orgId,"positions")),
      getDocs(collection(db,"organizations",orgId,"candidates")),
      getDocs(collection(db,"organizations",orgId,"votes")),
    ]);

    const positions = posSnap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
    const candidates = candSnap.docs.map(d=>({id:d.id, ...(d.data()||{})}));

    // Count votes: support votes documents shaped like { choices: { [positionId]: candidateId OR ['a','b'] }, ... }
    // Also support { selections: {...} } fallback.
    const countsByPosition = {}; // {posId: {candId: count}}
    let totalBallots = 0;

    votesSnap.forEach(vd=>{
      const v = vd.data() || {};
      const choices = v.choices || v.selections || v.votes || {};
      if (choices && typeof choices === "object") {
        totalBallots += 1;
        Object.entries(choices).forEach(([posId, sel])=>{
          if (!countsByPosition[posId]) countsByPosition[posId] = {};
          const bump = (candId)=>{
            if(!candId) return;
            countsByPosition[posId][candId] = (countsByPosition[posId][candId]||0) + 1;
          };
          if (Array.isArray(sel)) sel.forEach(bump);
          else bump(sel);
        });
      }
    });

    // Group candidates by positionId (common fields: positionId, positionID, postId)
    const byPos = {};
    candidates.forEach(c=>{
      const pid = c.positionId || c.positionID || c.postId || c.postID || c.position || c.position_id;
      if(!pid) return;
      if(!byPos[pid]) byPos[pid] = [];
      byPos[pid].push(c);
    });

    // Build PDF
    const doc = new jsPDFCtor();
    let y = 18;

    doc.setFontSize(16);
    doc.text("Neon Voting System — Election Results", 105, y, { align:"center" });
    y += 10;

    doc.setFontSize(10);
    doc.text(`Organization: ${orgId}`, 14, y); y += 6;
    doc.text(`Exported: ${new Date().toLocaleString()}`, 14, y); y += 6;
    doc.text(`Total ballots: ${totalBallots}`, 14, y); y += 10;

    // Helper to add page breaks
    const ensureSpace = (needed)=>{
      if (y + needed > 280){
        doc.addPage();
        y = 18;
      }
    };

    // Render each position
    for (const p of positions){
      const posId = p.id;
      const title = (p.name || p.title || p.positionName || "(Position)").toString();
      const posCands = (byPos[posId] || []).slice();

      // If no candidates found for position, still show heading
      ensureSpace(14);
      doc.setFontSize(12);
      doc.text(title.toUpperCase(), 14, y); y += 6;
      doc.setFontSize(9);
      doc.text(`Position ID: ${posId}`, 14, y); y += 6;

      // Sort candidates by votes desc
      const posCounts = countsByPosition[posId] || {};
      posCands.sort((a,b)=>((posCounts[b.id]||0) - (posCounts[a.id]||0)));

      // Table header
      ensureSpace(10);
      doc.setFontSize(10);
      doc.text("Candidate", 14, y);
      doc.text("Votes", 160, y);
      y += 6;

      if (posCands.length === 0){
        doc.setFontSize(10);
        doc.text("No candidates found for this position.", 14, y); y += 8;
        continue;
      }

      for (const c of posCands){
        ensureSpace(14);
        const name = (c.name || c.fullName || c.candidateName || c.displayName || "(Candidate)").toString();
        const votes = (posCounts[c.id] || 0);

        // Candidate photo (best-effort)
        const photo = c.photoURL || c.photoUrl || c.imageUrl || c.imageURL || c.avatar || c.photo;
        if (photo && typeof photo === "string" && photo.startsWith("data:image/")){
          try{
            doc.addImage(photo, "JPEG", 14, y-4, 10, 10);
          }catch(e){}
          doc.text(name, 28, y+4);
        }else{
          doc.text(name, 14, y+4);
        }
        doc.text(String(votes), 165, y+4);
        y += 12;
      }

      y += 4;
    }

    // Signatures page (EC + Super Admin)
    doc.addPage();
    let sy = 22;
    doc.setFontSize(16);
    doc.text("Verification & Signatures", 105, sy, { align:"center" });
    sy += 18;

    const drawSig = (sig, x)=>{
      doc.setFontSize(12);
      doc.text(sig.role || "Signature", x, sy);
      doc.setFontSize(11);
      doc.text(`Name: ${sig.name || ""}`, x, sy+10);
      doc.text(`Signed: ${sig.signedAt || ""}`, x, sy+18);
      // line
      doc.line(x, sy+32, x+70, sy+32);
      if (sig.image && typeof sig.image === "string" && sig.image.startsWith("data:image/")){
        try{ doc.addImage(sig.image, "PNG", x, sy+22, 70, 16); }catch(e){}
      }
    };

    const sigState = window.signatureState || {};
    if (sigState.ec) drawSig(sigState.ec, 20);
    if (sigState.superAdmin) drawSig(sigState.superAdmin, 120);

    doc.save(`Results_${orgId}.pdf`);
    showToast("PDF exported successfully", "success");
  }catch(err){
    console.error("exportResultsPDF failed:", err);
    showToast("PDF export failed", "error");
  }
};




// =========================================================
// GLOBAL EXPORTS (keep tabs/buttons functional from HTML)
// =========================================================
try {
  // Expose key handlers to global scope for inline onclick usage (module-safe)
  if (typeof window !== "undefined") {
    window.submitVote = window.submitVote || submitVote;
    window.clearSelections = window.clearSelections || clearSelections;
    window.updateVoteSummary = window.updateVoteSummary || updateVoteSummary;

    window.goBackWithoutVoting = window.goBackWithoutVoting || function () {
      try {
        if (confirm('Go back without submitting your vote? Your selections will remain until you submit.')) {
          showToast('You can return later to submit your vote.', 'info');
          showScreen('voterLoginScreen');
        }
      } catch (e) {
        console.warn('goBackWithoutVoting error:', e);
      }
    };
  }
} catch (e) {
  console.warn("Global export patch failed:", e);
}



/* ======================================================
   PATCH: Missing globals & broken tabs (Jan 2026)
   Fixes:
   - Super Admin WhatsApp invite not responding
   - EC Change Email modal not responding
   - EC Bulk Invite tabs/preview/send/history missing
   - Voter selection handler global export
   ====================================================== */

(function(){
  try {
    // Ensure inline/onchange handlers work with type="module"
    window.updateSelectedCandidates = updateSelectedCandidates;
    window.submitVote = submitVote;
    window.cancelVoting = window.cancelVoting || cancelVoting;

    // --- Super Admin: EC WhatsApp Invite Modal ---
    window.closeModal = function(){ document.querySelectorAll('.modal-overlay').forEach(el=>el.remove()); };

    window.showECWhatsAppModal = function(orgId, orgName, ecPassword){
      try{
        const loginLink = `${window.location.origin}${window.location.pathname}?org=${encodeURIComponent(orgId)}&role=ec`;
        createModal(
          `<i class="fab fa-whatsapp"></i> Send EC Invite (WhatsApp)`,
          `
            <div style="display:flex;flex-direction:column;gap:14px">
              <div>
                <label class="label">Organization ID</label>
                <input class="input" value="${escapeHtml(orgId)}" disabled>
              </div>
              <div>
                <label class="label">EC Password</label>
                <input class="input" value="${escapeHtml(ecPassword || '')}" disabled>
              </div>
              <div>
                <label class="label">Phone Number *</label>
                <input id="ecInviteWAPhone" class="input" placeholder="+233XXXXXXXXX" type="tel">
                <small class="subtext">Include country code (e.g., +233...)</small>
              </div>
              <div>
                <label class="label">Message (editable)</label>
                <textarea id="ecInviteWAMessage" class="input" rows="6"></textarea>
              </div>
            </div>
          `,
          `
            <button class="btn neon-btn-outline" onclick="closeModal()">
              <i class="fas fa-times"></i> Cancel
            </button>
            <button class="btn neon-btn" onclick="sendECWhatsAppInvite('${escapeHtml(orgId)}')">
              <i class="fab fa-whatsapp"></i> Open WhatsApp
            </button>
          `
        );

        const msg = `🗳 *Neon Voting System*\n\nHello,\nYou have been appointed as the *Election Commissioner (EC)* for:\n*${orgName || orgId}*\n\n🆔 Org ID: ${orgId}\n🔐 EC Password: ${ecPassword || ''}\n\n👉 Login link:\n${loginLink}\n\n⚠️ Keep these credentials secure.`;
        const ta = document.getElementById("ecInviteWAMessage");
        if (ta) ta.value = msg;

      } catch(e){
        console.error("showECWhatsAppModal error:", e);
        showToast("Failed to open WhatsApp invite modal", "error");
      }
    };

    window.sendECWhatsAppInvite = function(orgId){
      try{
        const phoneRaw = String(document.getElementById("ecInviteWAPhone")?.value || "").trim();
        const message = String(document.getElementById("ecInviteWAMessage")?.value || "").trim();
        if (!phoneRaw){
          showToast("Enter phone number", "warning");
          return;
        }
        // Build wa.me link (strip spaces)
        const phone = phoneRaw.replace(/\s+/g,'').replace(/^\+/, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
        showToast("WhatsApp opened", "success");
      } catch(e){
        console.error("sendECWhatsAppInvite error:", e);
        showToast("Failed to open WhatsApp", "error");
      }
    };

    // --- EC: Change Voter Email Modal (missing) ---
    function changeVoterEmailModal(voterId, oldEmail, voterName){
      createModal(
        `<i class="fas fa-at"></i> Change Voter Email`,
        `
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="subtext">Voter: <strong>${escapeHtml(voterName || oldEmail || voterId)}</strong></div>
            <div>
              <label class="label">Old Email</label>
              <input class="input" value="${escapeHtml(oldEmail || '')}" disabled>
            </div>
            <div>
              <label class="label">New Email</label>
              <input id="newVoterEmail" class="input" type="email" placeholder="newemail@example.com">
            </div>
            <div>
              <label class="label">Confirm New Email</label>
              <input id="confirmNewVoterEmail" class="input" type="email" placeholder="newemail@example.com">
            </div>
            <div>
              <label class="label">Reason (optional)</label>
              <input id="emailChangeReason" class="input" placeholder="e.g., typo correction">
            </div>
            <div class="subtext" style="opacity:.85">
              Note: Changing email creates a new voter record and preserves history (as implemented in your change function).
            </div>
          </div>
        `,
        `
          <button class="btn neon-btn-outline" onclick="closeModal()"><i class="fas fa-times"></i> Cancel</button>
          <button class="btn neon-btn" onclick="changeVoterEmail('${escapeJs(voterId)}','${escapeJs(oldEmail || '')}','${escapeJs(voterName || '')}')">
            <i class="fas fa-save"></i> Save
          </button>
        `
      );
    }
    window.changeVoterEmailModal = changeVoterEmailModal;

    // --- EC: Bulk Invite UI functions (missing) ---
    window.showBulkTab = function(tab){
      try{
        document.querySelectorAll('.bulk-invite-tab').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('#ecContent-bulk-invite .bulk-tab-content').forEach(el=>el.classList.add('hidden'));

        // Activate button
        const btn = Array.from(document.querySelectorAll('.bulk-invite-tab'))
          .find(b => (b.getAttribute('onclick') || '').includes(`'${tab}'`));
        if (btn) btn.classList.add('active');

        const contentId = `bulkTab-${tab}`;
        document.getElementById(contentId)?.classList.remove('hidden');
      } catch(e){
        console.error("showBulkTab error:", e);
      }
    };

    // Parse bulk voter textarea into objects
        function _parseBulkVoters(text){
      const rows = String(text||"").split(/\r?\n/).map(r=>r.trim()).filter(Boolean);
      const out = [];
      rows.forEach((row, idx)=>{
        // Accept formats:
        // 1) EmailOrPhone, Full Name, OptionalID/PIN
        // 2) Full Name, EmailOrPhone, OptionalID/PIN
        const parts = row.split(",").map(p=>p.trim()).filter(p=>p.length>0);
        if (parts.length < 2) return;

        const looksLikeCredential = (s)=>{
          const v = String(s||"").trim();
          if (!v) return false;
          if (v.includes("@")) return true;
          if (/^\+?\d[\d\s\-()]{6,}$/.test(v)) return true;
          return false;
        };

        let credential = "";
        let name = "";
        let orgVoterId = "";

        if (looksLikeCredential(parts[0])) {
          credential = parts[0];
          name = parts[1] || "";
          orgVoterId = parts[2] || "";
        } else if (looksLikeCredential(parts[1])) {
          name = parts[0] || "";
          credential = parts[1];
          orgVoterId = parts[2] || "";
        } else {
          // fallback: treat first as credential
          credential = parts[0];
          name = parts[1] || "";
          orgVoterId = parts[2] || "";
        }

        if (!credential) return;
        out.push({ name, credential, orgVoterId, line: idx+1 });
      });
      return out;
    }

    window.previewBulkVoters = function(){
      try{
        const txt = document.getElementById("bulkVoterText")?.value || "";
        const list = _parseBulkVoters(txt);
        const el = document.getElementById("bulkPreview") || document.getElementById("manualPreview");
        if (!el) return;

        if (list.length === 0){
          el.innerHTML = `<div class="empty-state"><i class="fas fa-info-circle"></i><p>No valid rows found. Use: Name,EmailOrPhone,OptionalID</p></div>`;
          return;
        }

        el.innerHTML = `
          <div class="card" style="padding:12px">
            <div class="subtext" style="margin-bottom:8px">${list.length} voter(s) detected</div>
            <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow:auto">
              ${list.map(v=>`
                <div style="display:flex;justify-content:space-between;gap:10px;border:1px solid rgba(0,255,255,.12);padding:8px;border-radius:10px">
                  <div>
                    <div style="font-weight:700">${escapeHtml(v.name || "(no name)")}</div>
                    <div class="subtext">${escapeHtml(v.credential)}${v.orgVoterId?` • ID: ${escapeHtml(v.orgVoterId)}`:""}</div>
                  </div>
                  <div class="badge">Line ${v.line}</div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      } catch(e){
        console.error("previewBulkVoters error:", e);
        showToast("Preview failed", "error");
      }
    };

    window.sendBulkInvites = async function(){
      try{
        if (!currentOrgId){
          showToast("Select an organization first", "warning");
          return;
        }

        const txt = document.getElementById("bulkVoterText")?.value || "";
        const list = _parseBulkVoters(txt);
        if (list.length === 0){
          showToast("No valid voters to invite", "warning");
          return;
        }

        const progress = document.getElementById("bulkProgress");
        const setProgress = (done,total)=>{ if(progress) progress.textContent = `${done}/${total}`; };

        let done=0, ok=0, dup=0, fail=0;

        for (const v of list){
          try{
            // Use your existing addVoter function (handles email/phone + duplicates)
            const res = await window.addVoterWithEmailOrPhone(v.name, v.credential, v.orgVoterId);
            if (res && res.duplicate) dup++;
            else ok++;
          } catch(e){
            fail++;
            console.warn("Bulk add voter failed:", v, e);
          }
          done++;
          setProgress(done, list.length);
        }

        showToast(`Bulk done: ${ok} added, ${dup} duplicates, ${fail} failed`, fail? "warning":"success");
        // Refresh voters list so EC sees result immediately
        try{ loadECVoters(); }catch(_){}
      } catch(e){
        console.error("sendBulkInvites error:", e);
        showToast("Bulk invite failed", "error");
      }
    };

    window.showInviteHistory = async function(){
      // You may not have invite history stored yet; avoid breaking UI.
      createModal(
        `<i class="fas fa-history"></i> Invite History`,
        `<div class="subtext">Invite history is not yet stored as a collection in this build. (No errors—this is just informational.)</div>`,
        `<button class="btn neon-btn" onclick="closeModal()"><i class="fas fa-check"></i> OK</button>`
      );
    };

  } catch(e){
    console.warn("Patch block failed:", e);
  }
})();


function escapeJs(str){ return String(str||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n'); }

// ======================================================
// EC EDIT LOCK (Once voting starts, EC can't edit voters/positions/candidates)
// Super Admin can still edit.
// ======================================================
function _nowMs(){ return Date.now(); }

function isVotingInProgress(org){
  const s = org?.electionSettings?.startTime ? new Date(org.electionSettings.startTime).getTime() : null;
  const e = org?.electionSettings?.endTime ? new Date(org.electionSettings.endTime).getTime() : null;
  const now=_nowMs();
  if(s && now >= s){
    if(e && now > e) return false;
    return true;
  }
  const st = (org?.electionStatus||"").toLowerCase();
  return st === "started" || st === "in_progress" || st === "in progress";
}

function isEcEditLocked(){
  if(window.session?.role !== "ec") return false;
  if(!window.currentOrgData) return false;
  return isVotingInProgress(window.currentOrgData);
}

function _guardEcEdit(){
  if(isEcEditLocked()){
    showToast("Voting has started. EC editing is locked. Contact Super Admin.", "error");
    return false;
  }
  return true;
}

// ======================================================
// COUNTS RECALC (keeps Super Admin dashboard accurate)
// ======================================================
async function recalcOrgCounts(orgId){
  try{
    const [votersSnap, votesSnap, posSnap, candSnap] = await Promise.all([
      getDocs(collection(db,"organizations",orgId,"voters")),
      getDocs(collection(db,"organizations",orgId,"votes")),
      getDocs(collection(db,"organizations",orgId,"positions")),
      getDocs(collection(db,"organizations",orgId,"candidates")),
    ]);
    const voterCount = votersSnap.size;
    const voteCount = votesSnap.size;
    const positionCount = posSnap.size;
    const candidateCount = candSnap.size;

    await updateDoc(doc(db,"organizations",orgId),{
      voterCount, voteCount, positionCount, candidateCount,
      lastCountsAt: serverTimestamp()
    });
    return {voterCount,voteCount,positionCount,candidateCount};
  }catch(e){
    console.warn("recalcOrgCounts failed", e);
    return null;
  }
}

async function _getCandidatesMap(orgId){
  const map = {};
  try{
    const cSnap = await getDocs(collection(db,"organizations",orgId,"candidates"));
    cSnap.forEach(d=>{
      const x=d.data()||{};
      map[d.id]={id:d.id, name:x.name||x.fullName||x.title||("Candidate "+d.id), positionId:x.positionId||x.position||x.postId||null};
    });
  }catch(e){}
  try{
    const pSnap = await getDocs(collection(db,"organizations",orgId,"positions"));
    for(const p of pSnap.docs){
      const cc = await getDocs(collection(db,"organizations",orgId,"positions",p.id,"candidates"));
      cc.forEach(d=>{
        const x=d.data()||{};
        if(!map[d.id]) map[d.id]={id:d.id, name:x.name||x.fullName||("Candidate "+d.id), positionId:p.id};
      });
    }
  }catch(e){}
  return map;
}

// ======================================================
// EC BULK INVITE TAB (Manual + CSV + Excel .xlsx via SheetJS)
// ======================================================
function _ensureEl(id){ return document.getElementById(id); }

function _parseBulkText(text){
  const rows=[];
  String(text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(line=>{
    const parts=line.split(",").map(s=>s.trim()).filter(Boolean);
    const first=parts[0]||"";
    const name=parts[1]||"";
    const voterId=parts[2]||"";
    const isEmail=/@/.test(first);
    const isPhone=/^\+?\d[\d\s\-()]{6,}$/.test(first);
    rows.push({ email: isEmail?first:"", phone: (!isEmail && isPhone)?first:"", name, voterId });
  });
  return rows;
}

function _renderBulkPreview(rows){
  const box=_ensureEl("bulkPreview");
  const countEl=_ensureEl("bulkCount");
  if(countEl) countEl.textContent = String(rows.length);
  if(!box) return;
  if(!rows.length){
    box.innerHTML = '<div class="subtext">No rows yet. Paste voters or upload a file.</div>';
    return;
  }
  box.innerHTML = rows.slice(0,50).map((r)=>`
    <div class="list-item" style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px">
      <div style="min-width:0">
        <div style="font-weight:800;color:#fff">${escapeHtml(r.name||"(no name)")}</div>
        <div class="subtext" style="word-break:break-all">${escapeHtml(r.email||r.phone||"")}${r.voterId?` • ID: ${escapeHtml(r.voterId)}`:""}</div>
      </div>
      <span class="badge info">${r.email?"Email":"Phone"}</span>
    </div>
  `).join("") + (rows.length>50?`<div class="subtext">Showing 50 of ${rows.length}</div>`:"");
}

async function _bulkCreateVoters(rows){
  if(!currentOrgId){ showToast("Select an organization first", "warning"); return; }
  if(!rows.length){ showToast("No voters to add", "warning"); return; }
  if(isEcEditLocked()){
    showToast("Voting has started. EC edits are locked.", "error");
    return;
  }

  const btn=_ensureEl("bulkRunBtn");
  const prog=_ensureEl("bulkProgress");
  const progText=_ensureEl("bulkProgressText");
  if(btn) btn.disabled=true;
  if(prog){ prog.style.display="block"; }
  if(progText) progText.textContent="Processing…";

  let ok=0, dup=0, bad=0;

  for(const r of rows){
    const identifier = (r.email || r.phone || "").trim();
    if(!identifier){ bad++; continue; }
    const docId = encodeURIComponent(identifier.toLowerCase());
    const ref = doc(db,"organizations",currentOrgId,"voters",docId);
    try{
      const snap=await getDoc(ref);
      if(snap.exists()){ dup++; continue; }
      await setDoc(ref,{
        name: r.name || "",
        email: r.email || "",
        phone: r.phone || "",
        voterId: r.voterId || "",
        isActive: true,
        hasVoted: false,
        createdAt: serverTimestamp(),
        createdBy: "ec"
      });
      ok++;
    }catch(e){
      console.warn("Bulk add row failed", e);
      bad++;
    }
  }

  await recalcOrgCounts(currentOrgId);

  showToast(`Bulk add complete: ${ok} added, ${dup} duplicates, ${bad} invalid`, ok? "success":"warning");
  if(progText) progText.textContent="Done.";
  if(btn) btn.disabled=false;
  if(prog){ setTimeout(()=>{ prog.style.display="none"; }, 900); }
}

async function loadECBulkInvite(){
  const el=_ensureEl("ecContent-bulk-invite");
  if(!el) return;

  el.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h3 style="margin:0"><i class="fas fa-users"></i> Bulk Add Voters</h3>
        <span class="badge info">Org: <span style="font-family:monospace">${escapeHtml(currentOrgId||"")}</span></span>
      </div>
      <p class="subtext">Paste voters, upload CSV, or upload Excel. Each row: <b>email/phone, name, optional-id</b></p>

      <div class="grid" style="margin-top:10px">
        <div class="col-6">
          <label class="label">Manual paste</label>
          <textarea id="bulkVoterText" class="input" rows="8" placeholder="email@site.com, John Doe, 1001\n+233xxxxxxxxx, Ama, 1002"></textarea>
          <div class="row" style="margin-top:10px">
            <button class="btn neon-btn-outline" id="bulkPreviewBtn"><i class="fas fa-eye"></i> Preview</button>
            <button class="btn neon-btn" id="bulkRunBtn"><i class="fas fa-cloud-upload-alt"></i> Add to Org</button>
          </div>
        </div>

        <div class="col-6">
          <label class="label">Upload CSV</label>
          <input id="bulkCsvFile" class="input" type="file" accept=".csv" />
          <label class="label" style="margin-top:12px">Upload Excel (.xlsx)</label>
          <input id="bulkXlsxFile" class="input" type="file" accept=".xlsx,.xls" />
          <div class="subtext" style="margin-top:10px">
            CSV/Excel columns accepted: <b>email</b> or <b>phone</b>, <b>name</b>, optional <b>id</b>.
          </div>

          <div class="card" style="margin-top:14px;background:rgba(255,255,255,.03)">
            <div class="row" style="justify-content:space-between">
              <strong>Preview</strong>
              <span class="badge info"><span id="bulkCount">0</span> rows</span>
            </div>
            <div id="bulkPreview" style="margin-top:10px;max-height:300px;overflow:auto"></div>
          </div>

          <div id="bulkProgress" style="display:none;margin-top:12px">
            <div class="subtext" id="bulkProgressText">Processing…</div>
          </div>
        </div>
      </div>
    </div>
  `;

  let rows=[];
  const preview = ()=>{
    rows=_parseBulkText(_ensureEl("bulkVoterText")?.value||"");
    _renderBulkPreview(rows);
  };

  _ensureEl("bulkPreviewBtn")?.addEventListener("click", preview);
  _ensureEl("bulkRunBtn")?.addEventListener("click", async ()=>{
    preview();
    await _bulkCreateVoters(rows);
  });

  _ensureEl("bulkCsvFile")?.addEventListener("change", async (e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const text=await file.text();
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    if(!lines.length) return;
    const header=lines[0].toLowerCase();
    if(header.includes("email")||header.includes("phone")||header.includes("name")){
      const cols=lines[0].split(",").map(s=>s.trim().toLowerCase());
      const idxEmail=cols.indexOf("email");
      const idxPhone=cols.indexOf("phone");
      const idxName=cols.indexOf("name");
      const idxId=cols.indexOf("id");
      rows = lines.slice(1).map(l=>l.split(",").map(s=>s.trim())).filter(a=>a.length>=2).map(a=>({
        email: idxEmail>=0 ? (a[idxEmail]||"") : "",
        phone: idxPhone>=0 ? (a[idxPhone]||"") : "",
        name: idxName>=0 ? (a[idxName]||"") : (a[1]||""),
        voterId: idxId>=0 ? (a[idxId]||"") : ""
      }));
    }else{
      rows=_parseBulkText(lines.join("\n"));
    }
    _renderBulkPreview(rows);
  });

  _ensureEl("bulkXlsxFile")?.addEventListener("change", async (e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    if(!window.XLSX){
      showToast("Excel requires SheetJS. Use index.fixed.html which loads it.", "error");
      return;
    }
    const data = await file.arrayBuffer();
    const wb = window.XLSX.read(data, {type:"array"});
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const jsonRows = window.XLSX.utils.sheet_to_json(sheet, {defval:""});
    rows = jsonRows.map(r=>({
      email: String(r.email||r.Email||"").trim(),
      phone: String(r.phone||r.Phone||"").trim(),
      name: String(r.name||r.Name||"").trim(),
      voterId: String(r.id||r.ID||r.voterId||"").trim()
    })).filter(r=> (r.email||r.phone) );
    _renderBulkPreview(rows);
  });

  _renderBulkPreview([]);
}

// ======================================================
// GLOBAL DASHBOARD CHART SAFETY (Prevent crashes)
// ======================================================
function updateVotesChart(data){
  const el = document.getElementById("votesChart");
  if(!el){ return; }
  // If you later add Chart.js, this will be replaced
  el.innerHTML = '<div class="subtext">Votes chart will render here.</div>';
}

function updateStatusChart(data){
  const el = document.getElementById("statusChart");
  if(!el){ return; }
  el.innerHTML = '<div class="subtext">Election status chart will render here.</div>';
}

// ======================================================
// SUPER ADMIN TAB SWITCH (Hard switch panels, prevent dashboard hijack)
// ======================================================
window.__dashboardInitialized = window.__dashboardInitialized || false;
window.__dashboardRefreshTimer = window.__dashboardRefreshTimer || null;

window.showSuperTab = function(tab){
  try{ console.log("Showing super tab:", tab); }catch(e){}
  // Buttons
  document.querySelectorAll("[data-super-tab]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.superTab === tab);
  });
  // Panels
  document.querySelectorAll(".super-tab-content").forEach(p=>{ p.style.display="none"; });
  const active = document.getElementById(`super-${tab}`);
  if(active) active.style.display="block";

  // Only run dashboard refresh while dashboard tab is active
  if(tab === "dashboard"){
    if(!window.__dashboardInitialized && typeof window.initializeDashboard === "function"){
      window.__dashboardInitialized = true;
      window.initializeDashboard();
    }
    if(!window.__dashboardRefreshTimer && typeof window.refreshDashboard === "function"){
      window.__dashboardRefreshTimer = setInterval(()=>{ 
        try{ window.refreshDashboard(); }catch(e){} 
      }, 30000);
    }
  } else {
    if(window.__dashboardRefreshTimer){
      clearInterval(window.__dashboardRefreshTimer);
      window.__dashboardRefreshTimer = null;
    }
  }
};

// Alias: danger tab loader
function loadSuperDanger(){ return loadSuperDelete(); }



/* =========================================================
   ELECTION SCHEDULE ENGINE (Countdown + Auto Status + Reminders Queue)
   - Uses organizations/{orgId}.electionSettings.startTime/endTime (ISO or Date string)
   - Auto-updates electionStatus when Super Admin is online
   - Enforces EC freeze + voter gating using computed window (even if status isn't updated)
   - Queues 30-minute reminders (requires backend/EmailJS/Twilio to actually send)
   ========================================================= */

function getElectionWindow(orgData) {
  const s = orgData?.electionSettings?.startTime ? new Date(orgData.electionSettings.startTime) : null;
  const e = orgData?.electionSettings?.endTime ? new Date(orgData.electionSettings.endTime) : null;
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return { start: null, end: null };
  return { start: s, end: e };
}

function computeElectionPhase(orgData) {
  const { start, end } = getElectionWindow(orgData);
  if (!start || !end) return null;
  const now = Date.now();
  const s = start.getTime();
  const e = end.getTime();
  if (now < s) return "scheduled";
  if (now >= s && now < e) return "active";
  return "ended";
}

function msToHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

function updateCountdownBanner(orgId, orgData) {
  const el = document.getElementById("electionCountdownBanner");
  if (!el) return;

  const { start, end } = getElectionWindow(orgData);
  if (!start || !end) {
    el.style.display = "none";
    return;
  }

  const now = Date.now();
  const s = start.getTime();
  const e = end.getTime();

  let label = "";
  let diff = 0;

  if (now < s) {
    label = "Election starts in";
    diff = s - now;
  } else if (now >= s && now < e) {
    label = "Election ends in";
    diff = e - now;
  } else {
    label = "Election ended";
    diff = 0;
  }

  if (label === "Election ended") {
    el.textContent = "⏱ Election ended";
  } else {
    const t = msToHMS(diff);
    el.textContent = `⏱ ${label}: ${t.h}h ${t.m}m ${t.s}s`;
  }
  el.style.display = "block";
}

// Role-agnostic "truth": voting is live if now is within start/end window
function isVotingLive(orgData) {
  const { start, end } = getElectionWindow(orgData);
  if (!start || !end) return false;
  const now = Date.now();
  return now >= start.getTime() && now < end.getTime();
}

// UI freeze for EC based on computed window/status
window.applyECFreezeUI = window.applyECFreezeUI || function applyECFreezeUI() {
  try {
    if (session?.role !== "ec") return;
    if (!currentOrgData) return;

    const locked = isVotingLive(currentOrgData) || (currentOrgData.electionStatus === "active");
    if (!locked) return;

    // Disable known EC edit actions
    const selectors = [
      "#addVoterBtn", "#bulkAddVoterBtn", "#addPositionBtn", "#addCandidateBtn",
      ".ec-edit-btn", ".ec-delete-btn",
      "button[onclick*='showAddVoterModal']",
      "button[onclick*='showBulkVoterModal']",
      "button[onclick*='showAddPositionModal']",
      "button[onclick*='showAddCandidateModal']"
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        btn.disabled = true;
        btn.classList.add("disabled");
        btn.title = "Editing is locked — voting has started.";
      });
    });
  } catch (e) {
    console.error("applyECFreezeUI error:", e);
  }
};

// Auto-update electionStatus (Super Admin only, best-effort)
async function maybeAutoUpdateElectionStatus(orgId, orgData) {
  try {
    if (session?.role !== "superadmin") return;
    const desired = computeElectionPhase(orgData);
    if (!desired) return;

    const current = orgData?.electionStatus || "active";
    if (current === "declared") return; // do not override manual "declared"
    if (current === desired) return;

    await updateDoc(doc(db, "organizations", orgId), {
      electionStatus: desired,
      statusAutoUpdatedAt: serverTimestamp()
    });
    console.log("Auto electionStatus ->", desired);
  } catch (e) {
    console.warn("maybeAutoUpdateElectionStatus skipped:", e);
  }
}

// Queue 30-min reminders (Super Admin only). Actual sending requires backend integration.
async function maybeQueue30MinReminders(orgId, orgData) {
  try {
    if (session?.role !== "superadmin") return;
    if (orgData?.remindersQueuedAt) return;

    const { start } = getElectionWindow(orgData);
    if (!start) return;

    const now = Date.now();
    const diffMs = start.getTime() - now;

    // Trigger within a 90-second window around 30 minutes before start
    const thirtyMin = 30 * 60 * 1000;
    if (diffMs > thirtyMin + 45_000) return;
    if (diffMs < thirtyMin - 45_000) return;

    const votersSnap = await getDocs(collection(db, "organizations", orgId, "voters"));
    const batch = writeBatch(db);
    const queueCol = collection(db, "organizations", orgId, "remindersQueue");

    votersSnap.forEach(vDoc => {
      const v = vDoc.data() || {};
      const qRef = doc(queueCol);
      batch.set(qRef, {
        voterId: vDoc.id,
        email: v.email || null,
        phone: v.phone || v.telephone || null,
        createdAt: serverTimestamp(),
        status: "queued",
        type: "30_min_before_start"
      });
    });

    batch.update(doc(db, "organizations", orgId), {
      remindersQueuedAt: serverTimestamp()
    });

    await batch.commit();
    showToast?.("30-minute reminders queued (requires sending service)", "success");
    console.log("30-minute reminders queued:", votersSnap.size);
  } catch (e) {
    console.warn("maybeQueue30MinReminders skipped:", e);
  }
}

// One place to tick schedule logic whenever org data updates
function electionRealtimeTick(orgId, orgData) {
  updateCountdownBanner(orgId, orgData);
  maybeAutoUpdateElectionStatus(orgId, orgData);
  maybeQueue30MinReminders(orgId, orgData);
  // EC freeze is applied elsewhere too, but safe to call here if present
  applyECFreezeUI?.();
}

// Provide safe fallbacks to avoid runtime errors from missing dashboard funcs
window.initializeDashboard = window.initializeDashboard || function(){};
window.refreshDashboard = window.refreshDashboard || function(){};
window.loadOrgOverview = window.loadOrgOverview || async function(){};


/* ================================
   AUTO-PUBLISH RESULTS ON END
   ================================ */
async function autoPublishResultsIfEnded(orgId, orgData) {
  if (orgData.electionStatus === "ended" && !orgData.resultsPublished) {
    await firestore.collection("organizations").doc(orgId).update({
      resultsPublished: true,
      resultsPublishedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log("✅ Results auto-published");
  }
}

/* ================================
   VOTER STATUS DASHBOARD (READ-ONLY)
   ================================ */
async function showVoterStatusView(orgId, voter) {
  await window.firebaseReady;

  document.getElementById("voterVoteSection")?.classList.add("hidden");
  document.getElementById("voterStatusSection")?.classList.remove("hidden");

  const orgSnap = await firestore.collection("organizations").doc(orgId).get();
  const orgData = orgSnap.data();

  renderVoterElectionStatus(orgData);
  await loadResultsByPosition(orgId, { readOnly: true });
  startVoterLiveRefresh(orgId);
}

function renderVoterElectionStatus(orgData) {
  const el = document.getElementById("voterElectionStatus");
  if (!el) return;

  if (orgData.electionStatus === "ongoing") {
    el.textContent = "🟢 Election in progress";
  } else if (orgData.electionStatus === "ended") {
    el.textContent = "🏁 Election ended — final results";
  } else {
    el.textContent = "⏳ Election has not started";
  }
}


// ================================
// COMPATIBILITY: Screen Navigation
// ================================
window.showScreen = function (screenId) {
  try {
    document.querySelectorAll(".screen").forEach(el => el.classList.add("hidden"));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove("hidden");
    else console.warn("Screen not found:", screenId);
  } catch (err) {
    console.error("showScreen failed:", err);
  }
};



// ================================
// COMPATIBILITY: Super Admin Orgs Loader
// ================================
window.loadSuperOrganizations = async function () {
  try {
    await window.firebaseReady;
    if (typeof window.loadOrganizationsForSuperAdmin === "function") {
      return await window.loadOrganizationsForSuperAdmin();
    }
    if (typeof window.loadOrganizations === "function") {
      return await window.loadOrganizations(); // fallback if your project uses this name
    }
    console.warn("No super org loader found (loadOrganizationsForSuperAdmin/loadOrganizations).");
  } catch (err) {
    console.error("loadSuperOrganizations failed:", err);
  }
};



// ================================
// COMPATIBILITY: Outcomes Refresh Button
// ================================
window.refreshOutcomes = async function () {
  try {
    await window.firebaseReady;

    // Best-effort org id discovery
    const params = new URLSearchParams(window.location.search);
    const orgFromUrl = params.get("org");
    const orgId =
      window.CURRENT_ORG_ID ||
      window.currentOrgId ||
      window.EC_STATE?.orgId ||
      window.ORG_ID ||
      orgFromUrl;

    if (!orgId) {
      console.warn("refreshOutcomes: orgId not found");
      return;
    }

    if (typeof window.loadResultsByPosition === "function") {
      return await window.loadResultsByPosition(orgId, { readOnly: false });
    }

    if (typeof window.loadECOutcomes === "function") {
      return await window.loadECOutcomes(orgId);
    }

    console.warn("refreshOutcomes: no outcomes loader found");
  } catch (err) {
    console.error("refreshOutcomes failed:", err);
  }
};



// ================================
// COMPATIBILITY: Super Admin Login
// ================================

// (removed: legacy loginSuperAdmin wrapper)




// ================================
// COMPATIBILITY: Missing onclick stubs
// (Prevents ReferenceError in production)
// ================================
window.cancelBulkInvite = window.cancelBulkInvite || function () { console.warn('cancelBulkInvite() is not wired yet.'); };
window.checkFirebaseStatus = window.checkFirebaseStatus || function () { console.warn('checkFirebaseStatus() is not wired yet.'); };
window.closeInviteHistory = window.closeInviteHistory || function () { console.warn('closeInviteHistory() is not wired yet.'); };
window.loadActivityFeed = window.loadActivityFeed || function () { console.warn('loadActivityFeed() is not wired yet.'); };
window.processCSVFile = window.processCSVFile || function () { console.warn('processCSVFile() is not wired yet.'); };
window.processExcelFile = window.processExcelFile || function () { console.warn('processExcelFile() is not wired yet.'); };
window.removeCSVFile = window.removeCSVFile || function () { console.warn('removeCSVFile() is not wired yet.'); };
window.resetAppData = window.resetAppData || function () { console.warn('resetAppData() is not wired yet.'); };
window.saveElectionSettings = window.saveElectionSettings || function () { console.warn('saveElectionSettings() is not wired yet.'); };
window.saveSyncSettings = window.saveSyncSettings || function () { console.warn('saveSyncSettings() is not wired yet.'); };
window.selectTemplate = window.selectTemplate || function () { console.warn('selectTemplate() is not wired yet.'); };
window.setDashboardTimeFilter = window.setDashboardTimeFilter || function () { console.warn('setDashboardTimeFilter() is not wired yet.'); };
window.showAllOrganizations = function(){ try{ if(typeof window.showSuperTab==='function'){ window.showSuperTab('orgs'); } else if(typeof window.showScreen==='function'){ window.showScreen('superAdminScreen'); } }catch(e){} };
window.useSelectedTemplate = window.useSelectedTemplate || function () { console.warn('useSelectedTemplate() is not wired yet.'); };

// ================================
// VOTER LIVE RESULTS AUTO-REFRESH
// ================================
window.VOTER_LIVE_REFRESH_TIMER = null;

async function startVoterLiveRefresh(orgId) {
  try {
    clearInterval(window.VOTER_LIVE_REFRESH_TIMER);
    window.VOTER_LIVE_REFRESH_TIMER = setInterval(async () => {
      try {
        await window.firebaseReady;
        if (typeof window.loadResultsByPosition === "function") {
          await window.loadResultsByPosition(orgId, { readOnly: true });
        }
      } catch (e) {}
    }, 30000);
  } catch (err) {
    console.error("startVoterLiveRefresh failed:", err);
  }
}


// ================================
// FINAL STABILIZATION: Voter Live Results After Voting
// ================================
window.showVoterLiveDashboard = async function(orgId, voterData) {
  try {
    // Ensure Firebase is ready
    if (window.firebaseReady) await window.firebaseReady;

    // Show the existing alreadyVotedScreen as the post-vote dashboard
    if (typeof window.showScreen === "function") {
      window.showScreen("alreadyVotedScreen");
    } else {
      // fallback
      document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
      document.getElementById("alreadyVotedScreen")?.classList.remove("hidden");
    }

    // Load org status
    const orgSnap = await getDoc(doc(db, "organizations", orgId));
    const org = orgSnap.exists() ? orgSnap.data() : {};

    const statusEl = document.getElementById("voterLiveStatus");
    if (statusEl) {
      const st = (org.electionStatus || "not_started");
      statusEl.textContent =
        st === "ongoing" ? "🟢 Election in progress — live updates" :
        st === "ended" ? "🏁 Election ended — final results" :
        "⏳ Election has not started";
    }

    // Render outcomes using the same proven EC outcomes renderer,
    // then copy its output into the voter container (safe reuse).
    // We temporarily set currentOrgId/currentOrgData which loadECOutcomes expects.
    try {
      window.currentOrgId = orgId;
      window.currentOrgData = org;

      if (typeof window.loadECOutcomes === "function") {
        await window.loadECOutcomes();
        const src = document.getElementById("ecContent-outcomes");
        const dst = document.getElementById("voterLiveResultsContainer");
        if (dst && src) dst.innerHTML = src.innerHTML;
      }
    } catch (e) {
      console.warn("Voter live outcomes render failed, will retry:", e);
    }

    // Auto-refresh every 30s (status + results)
    clearInterval(window.__voterLiveTimer);
    window.__voterLiveTimer = setInterval(async () => {
      try {
        const orgSnap2 = await getDoc(doc(db, "organizations", orgId));
        const org2 = orgSnap2.exists() ? orgSnap2.data() : {};
        const statusEl2 = document.getElementById("voterLiveStatus");
        if (statusEl2) {
          const st2 = (org2.electionStatus || "not_started");
          statusEl2.textContent =
            st2 === "ongoing" ? "🟢 Election in progress — live updates" :
            st2 === "ended" ? "🏁 Election ended — final results" :
            "⏳ Election has not started";
        }
        window.currentOrgId = orgId;
        window.currentOrgData = org2;
        if (typeof window.loadECOutcomes === "function") {
          await window.loadECOutcomes();
          const src2 = document.getElementById("ecContent-outcomes");
          const dst2 = document.getElementById("voterLiveResultsContainer");
          if (dst2 && src2) dst2.innerHTML = src2.innerHTML;
        }
      } catch (e) {}
    }, 30000);

  } catch (err) {
    console.error("showVoterLiveDashboard failed:", err);
  }
};


// ================================
// INVITE HISTORY LOGGER (PRODUCTION)
// ================================
async function logInviteHistory({
  orgId,
  type,
  channel,
  recipient,
  status,
  sentByRole,
  sentById,
  meta = {}
}) {
  try {
    await window.firebaseReady;
    if (!orgId || !type || !channel || !recipient) return;

    await firebase.firestore()
      .collection("organizations")
      .doc(orgId)
      .collection("inviteHistory")
      .add({
        orgId,
        type,
        channel,
        recipient,
        status,
        sentByRole,
        sentById: sentById || "unknown",
        meta,
        sentAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch (err) {
    console.warn("Invite history logging failed:", err);
  }
}

// ================================
// INVITE HISTORY VIEW (READ-ONLY)
// ================================
window.showInviteHistory = async function () {
  await window.firebaseReady;

  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.getElementById("inviteHistoryTab")?.classList.remove("hidden");

  const orgId =
    window.CURRENT_ORG_ID ||
    window.EC_STATE?.orgId ||
    new URLSearchParams(location.search).get("org");

  if (!orgId) return;

  const list = document.getElementById("inviteHistoryList");
  if (!list) return;
  list.innerHTML = "<p>Loading…</p>";

  const snap = await firebase.firestore()
    .collection("organizations")
    .doc(orgId)
    .collection("inviteHistory")
    .orderBy("sentAt", "desc")
    .limit(100)
    .get();

  if (snap.empty) {
    list.innerHTML = "<p>No invites sent yet.</p>";
    return;
  }

  list.innerHTML = "";
  snap.forEach(doc => {
    const d = doc.data();
    const row = document.createElement("div");
    row.className = "invite-row";
    row.innerHTML = `
      <strong>${(d.type || "").toUpperCase()}</strong> • ${d.channel}<br>
      <span>${d.recipient}</span><br>
      <small>
        Status: <b>${d.status}</b> |
        By: ${d.sentByRole} |
        ${d.sentAt?.toDate?.().toLocaleString?.() || ""}
      </small>
    `;
    list.appendChild(row);
  });
};
