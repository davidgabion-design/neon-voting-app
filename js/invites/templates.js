/**
 * Invites Module - Templates
 * Handles customizable invitation templates
 */

import { db } from '../config/firebase.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast } from '../utils/ui-helpers.js';
import { escapeHtml } from '../utils/validation.js';

/**
 * Load invite templates editor
 */
export async function loadInviteTemplates() {
  try {
    if (!window.currentOrgId || !window.currentOrgData) return;
    
    const org = window.currentOrgData;
    const templates = org.inviteTemplates || getDefaultInviteTemplates();
    
    let html = `
      <div class="card">
        <h3><i class="fas fa-envelope"></i> Customize Invitation Templates</h3>
        <p class="subtext">Customize the invitation emails sent to voters and EC</p>
        
        <div style="margin-top:20px">
          <h4 style="color:#00ffaa">Voter Invitation Subject</h4>
          <input id="templateVoterSubject" class="input" placeholder="Invitation subject" value="${escapeHtml(templates.voterSubject || '')}">
          
          <h4 style="color:#00ffaa;margin-top:15px">Voter Invitation Body</h4>
          <textarea id="templateVoterBody" class="input" rows="6" placeholder="Use {voterName}, {orgName}, {orgId}, {email}, {appUrl}" style="font-family:monospace;font-size:12px">${escapeHtml(templates.voterBody || '')}</textarea>
          
          <h4 style="color:#00ffaa;margin-top:15px">EC Invitation Subject</h4>
          <input id="templateECSubject" class="input" placeholder="EC invitation subject" value="${escapeHtml(templates.ecSubject || '')}">
          
          <h4 style="color:#00ffaa;margin-top:15px">EC Invitation Body</h4>
          <textarea id="templateECBody" class="input" rows="6" placeholder="Use {ecName}, {orgName}, {orgId}, {password}, {appUrl}" style="font-family:monospace;font-size:12px">${escapeHtml(templates.ecBody || '')}</textarea>
          
          <div style="margin-top:20px;display:flex;gap:8px">
            <button class="btn neon-btn" onclick="saveInviteTemplates()">
              <i class="fas fa-save"></i> Save Templates
            </button>
            <button class="btn neon-btn-outline" onclick="resetInviteTemplates()">
              <i class="fas fa-redo"></i> Reset to Default
            </button>
          </div>
        </div>
      </div>
    `;
    
    const el = document.getElementById("settingsTab-templates");
    if (el) el.innerHTML = html;
  } catch (e) {
    console.error("Error loading templates:", e);
  }
}

/**
 * Get default invite templates
 */
export function getDefaultInviteTemplates() {
  return {
    voterSubject: "🗳️ You're Invited to Vote",
    voterBody: "Hi {voterName}!\n\nYou're invited to vote in the {orgName} election.\n\nLogin Details:\n- Organization ID: {orgId}\n- Your Email: {email}\n\nVisit: {appUrl}?role=voter&org={orgId}\n\nVote securely and confidentially!",
    ecSubject: "🔐 Election Commissioner Invitation",
    ecBody: "Hi {ecName}!\n\nYou've been invited as Election Commissioner for {orgName}\n\nLogin Credentials:\n- Organization ID: {orgId}\n- Password: {password}\n\nVisit: {appUrl}?role=ec&org={orgId}\n\nPlease change your password after first login."
  };
}

function replaceTemplateTokens(text, variables) {
  if (!text) return "";
  let result = String(text);
  Object.entries(variables).forEach(([key, value]) => {
    const token = `{${key}}`;
    result = result.split(token).join(String(value ?? ""));
  });
  return result;
}

export function buildVoterInviteTemplate({ voterName, orgName, orgId, email, appUrl }) {
  const defaults = getDefaultInviteTemplates();
  const orgTemplates = window.currentOrgData?.inviteTemplates || {};
  const subjectRaw = orgTemplates.voterSubject || defaults.voterSubject;
  const bodyRaw = orgTemplates.voterBody || defaults.voterBody;
  const variables = { voterName, orgName, orgId, email, appUrl };

  return {
    subject: replaceTemplateTokens(subjectRaw, variables),
    body: replaceTemplateTokens(bodyRaw, variables)
  };
}

export function buildECInviteTemplate({ ecName, orgName, orgId, password, appUrl }) {
  const defaults = getDefaultInviteTemplates();
  const orgTemplates = window.currentOrgData?.inviteTemplates || {};
  const subjectRaw = orgTemplates.ecSubject || defaults.ecSubject;
  const bodyRaw = orgTemplates.ecBody || defaults.ecBody;
  const variables = { ecName, orgName, orgId, password, appUrl };

  return {
    subject: replaceTemplateTokens(subjectRaw, variables),
    body: replaceTemplateTokens(bodyRaw, variables)
  };
}

export function buildVoterSmsInviteMessage({ voterName, orgName, orgId, appUrl }) {
  return `Hi ${voterName}! You're invited to vote in ${orgName} election. Visit: ${appUrl}?role=voter&org=${orgId} Org ID: ${orgId} 🗳️`;
}

export function buildVoterSmsAlertMessage({ voterName, orgName, orgId, appUrl, alertType }) {
  const baseLink = `${appUrl}?role=voter&org=${orgId}`;

  if (alertType === 'start') {
    return `🗳️ Hi ${voterName}! Voting is NOW OPEN for ${orgName}! Visit: ${baseLink} Org ID: ${orgId} Cast your vote now! ✅`;
  }

  return `⏰ Hi ${voterName}! Voting for ${orgName} starts in 30 minutes. Visit: ${baseLink} Org ID: ${orgId} 🗳️`;
}

/**
 * Save invite templates
 */
export async function saveInviteTemplates() {
  try {
    const templates = {
      voterSubject: document.getElementById("templateVoterSubject")?.value || "",
      voterBody: document.getElementById("templateVoterBody")?.value || "",
      ecSubject: document.getElementById("templateECSubject")?.value || "",
      ecBody: document.getElementById("templateECBody")?.value || ""
    };
    
    await updateDoc(doc(db, "organizations", window.currentOrgId), { inviteTemplates: templates });
    window.currentOrgData.inviteTemplates = templates;
    showToast("✅ Templates saved successfully", "success");
  } catch (e) {
    console.error("Error saving templates:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Reset templates to defaults
 */
export async function resetInviteTemplates() {
  if (!confirm("Reset all templates to defaults?")) return;
  
  try {
    await updateDoc(doc(db, "organizations", window.currentOrgId), { inviteTemplates: {} });
    window.currentOrgData.inviteTemplates = {};
    loadInviteTemplates();
    showToast("✅ Templates reset to defaults", "success");
  } catch (e) {
    console.error("Error resetting templates:", e);
    showToast("Error: " + e.message, "error");
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadInviteTemplates = loadInviteTemplates;
  window.getDefaultInviteTemplates = getDefaultInviteTemplates;
  window.saveInviteTemplates = saveInviteTemplates;
  window.resetInviteTemplates = resetInviteTemplates;
}
