/**
 * EC Module - Settings
 * Handles election settings, schedule, and configuration
 */

import { db } from '../config/firebase.js';
import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast } from '../utils/ui-helpers.js';
import { checkEditLock } from './utils.js';

/**
 * Load EC settings tab
 */
export async function loadECSettings() {
  const el = document.getElementById("ecContent-settings");
  if (!el || !window.currentOrgData) return;
  
  // Get translation function
  const t = window.t || ((key) => key);
  
  const org = window.currentOrgData;
  const startTime = org.electionSettings?.startTime || '';
  const endTime = org.electionSettings?.endTime || '';
  const declared = org.electionStatus === 'declared';
  
  let html = `
    <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:2px solid rgba(0,255,255,0.2);flex-wrap:wrap">
      <button class="settings-tab-btn active" onclick="switchSettingsTab('schedule')">
        <i class="fas fa-calendar-alt"></i> ${t('schedule')}
      </button>
      <button class="settings-tab-btn" onclick="switchSettingsTab('results')">
        <i class="fas fa-chart-pie"></i> ${t('results')}
      </button>
    </div>
    
    <div id="settingsTab-schedule" class="settings-tab-content">
      <div class="card">
        <h3><i class="fas fa-calendar-alt"></i> ${t('election_schedule')}</h3>
        <label class="label">${t('start_date_time')}</label>
        <input id="ecStartTime" type="datetime-local" class="input" value="${startTime ? new Date(startTime).toISOString().slice(0,16) : ''}">
        <label class="label">${t('end_date_time')}</label>
        <input id="ecEndTime" type="datetime-local" class="input" value="${endTime ? new Date(endTime).toISOString().slice(0,16) : ''}">
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn neon-btn" onclick="saveElectionSchedule()" style="flex:1">${t('save_schedule')}</button>
          <button class="btn neon-btn-outline" onclick="clearElectionSchedule()" style="flex:1">${t('clear')}</button>
        </div>
        ${startTime ? `
          <div class="subtext" style="margin-top:10px;padding:8px;background:rgba(0,255,255,0.05);border-radius:8px">
            <i class="fas fa-info-circle"></i> Current: ${new Date(startTime).toLocaleString()} to ${endTime ? new Date(endTime).toLocaleString() : 'No end time'}
          </div>
        ` : ''}
      </div>
      
      <div class="card" style="margin-top:20px">
        <h3><i class="fas fa-bell"></i> ${t('send_voter_alerts')}</h3>
        <p class="subtext">${t('send_alerts_to_voters')}</p>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn neon-btn-outline" onclick="send30MinAlerts()" style="flex:1">
            <i class="fas fa-clock"></i> ${t('min_alert')}
          </button>
          <button class="btn neon-btn-outline" onclick="sendVoteStartAlerts()" style="flex:1">
            <i class="fas fa-play"></i> ${t('start_alert')}
          </button>
        </div>
      </div>
      
      <div class="card danger-zone" style="margin-top:20px">
        <h3><i class="fas fa-exclamation-triangle"></i> ${t('danger_zone')}</h3>
        <p class="subtext">${t('reset_or_clear')}</p>
        <div style="margin-top:10px">
          <button class="btn btn-danger" onclick="resetVotesConfirm()" style="width:100%;margin-bottom:10px">
            <i class="fas fa-undo"></i> ${t('reset_all_votes')}
          </button>
          <button class="btn btn-danger" onclick="clearAllDataConfirm()" style="width:100%">
            <i class="fas fa-trash-alt"></i> ${t('clear_all_election_data')}
          </button>
        </div>
      </div>
    </div>
    
    <div id="settingsTab-results" class="settings-tab-content" style="display:none">
      <div class="card">
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
    </div>
  `;
  
  el.innerHTML = html;
}

/**
 * Switch settings tab
 */
export function switchSettingsTab(tabId) {
  const tabs = document.querySelectorAll('.settings-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
  const contents = document.querySelectorAll('.settings-tab-content');
  contents.forEach(c => c.style.display = 'none');
  
  document.getElementById(`settingsTab-${tabId}`).style.display = 'block';
  
  if (tabId === 'templates' && typeof window.loadInviteTemplates === 'function') {
    window.loadInviteTemplates();
  }
}

/**
 * Save election schedule
 */
export async function saveElectionSchedule() {
  // ✅ PATCH 2: Check edit lock before allowing schedule changes
  if (checkEditLock(window.currentOrgData)) return;
  
  const startTime = document.getElementById('ecStartTime')?.value;
  const endTime = document.getElementById('ecEndTime')?.value;
  
  if (!startTime || !endTime) {
    showToast('Please provide both start and end times', 'error');
    return;
  }
  
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  
  if (endDate <= startDate) {
    showToast('End time must be after start time', 'error');
    return;
  }
  
  try {
    const orgRef = doc(db, "organizations", window.currentOrgId);
    await updateDoc(orgRef, {
      'electionSettings.startTime': startDate.toISOString(),
      'electionSettings.endTime': endDate.toISOString(),
      electionStatus: 'scheduled',
      updatedAt: serverTimestamp()
    });
    
    showToast('Election schedule saved successfully', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error saving schedule:', e);
    showToast('Error saving schedule: ' + e.message, 'error');
  }
}

/**
 * Clear election schedule
 */
export async function clearElectionSchedule() {
  // ✅ PATCH 2: Check edit lock before allowing schedule changes
  if (checkEditLock(window.currentOrgData)) return;
  
  if (!confirm('Clear election schedule?\n\nThis will remove all scheduled dates.')) {
    return;
  }
  
  try {
    const orgRef = doc(db, "organizations", window.currentOrgId);
    await updateDoc(orgRef, {
      'electionSettings.startTime': null,
      'electionSettings.endTime': null,
      electionStatus: 'active',
      updatedAt: serverTimestamp()
    });
    
    showToast('Election schedule cleared', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error clearing schedule:', e);
    showToast('Error clearing schedule: ' + e.message, 'error');
  }
}

/**
 * Generate public results link
 */
export async function generatePublicLink() {
  try {
    const token = Math.random().toString(36).substring(2, 15);
    const orgRef = doc(db, "organizations", window.currentOrgId);
    
    await updateDoc(orgRef, {
      publicEnabled: true,
      publicToken: token,
      updatedAt: serverTimestamp()
    });
    
    showToast('Public link generated successfully', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error generating public link:', e);
    showToast('Error generating public link: ' + e.message, 'error');
  }
}

/**
 * Copy public link to clipboard
 */
export function copyPublicLink() {
  const org = window.currentOrgData;
  if (!org || !org.publicToken) {
    showToast('No public link available', 'error');
    return;
  }
  
  const link = `${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast('Public link copied to clipboard', 'success');
    }).catch(e => {
      console.error('Error copying to clipboard:', e);
      showToast('Error copying link', 'error');
    });
  } else {
    showToast('Clipboard not supported', 'error');
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadECSettings = loadECSettings;
  window.switchSettingsTab = switchSettingsTab;
  window.saveElectionSchedule = saveElectionSchedule;
  window.clearElectionSchedule = clearElectionSchedule;
  window.generatePublicLink = generatePublicLink;
  window.copyPublicLink = copyPublicLink;
}
