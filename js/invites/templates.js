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
  const loginLink = `${appUrl}?role=voter&org=${orgId}`;
  
  const subject = `🗳️ You're Invited to Vote - ${orgName}`;
  
  const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voter Invitation</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#0a0a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a0033 0%, #0d1b2a 100%);min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0d1b2a;border-radius:12px;border:2px solid #00ffaa;box-shadow:0 8px 32px rgba(0,255,170,0.2);">
          <!-- Header -->
          <tr>
            <td style="padding:30px;text-align:center;border-bottom:1px solid rgba(0,255,170,0.2);">
              <h1 style="margin:0;color:#00ffaa;font-size:28px;font-weight:700;text-shadow:0 0 20px rgba(0,255,170,0.5);">
                ⚡ Neon Voting System
              </h1>
              <p style="margin:10px 0 0;color:#888;font-size:14px;">
                ${orgName}
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="margin:0 0 20px;color:#00d4ff;font-size:22px;font-weight:600;text-align:center;">
                🗳️ You're Invited to Vote!
              </h2>
              
              <p style="margin:0 0 25px;color:#b0b0b0;font-size:16px;line-height:1.6;text-align:center;">
                Hi <strong style="color:#00ffaa;">${voterName || 'Voter'}</strong>! You've been registered to participate in the election.
              </p>
              
              <!-- Credentials Box -->
              <div style="background:rgba(0,20,40,0.6);border:1px solid rgba(0,255,170,0.3);border-radius:8px;padding:25px;margin:0 0 25px;">
                <p style="margin:0 0 15px;color:#00d4ff;font-size:16px;line-height:1.6;">
                  <strong>Organization ID:</strong> <span style="color:#00ffaa;font-family:monospace;font-size:18px;">${orgId}</span>
                </p>
                <p style="margin:0;color:#00d4ff;font-size:16px;line-height:1.6;">
                  <strong>Your Email:</strong> <span style="color:#00ffaa;font-family:monospace;font-size:16px;">${email}</span>
                </p>
              </div>
              
              <!-- Button -->
              <div style="text-align:center;margin:0 0 30px;">
                <a href="${loginLink}" style="display:inline-block;background:linear-gradient(135deg,#00C3FF 0%,#00ffaa 100%);color:#0a0a1a;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:16px;font-weight:700;box-shadow:0 4px 15px rgba(0,255,170,0.4);">
                  Vote Now
                </a>
              </div>
              
              <!-- Info -->
              <div style="background:rgba(0,195,255,0.1);border-left:4px solid #00C3FF;border-radius:4px;padding:15px;margin:0 0 30px;">
                <p style="margin:0;color:#00C3FF;font-size:14px;">
                  ℹ️ Your vote is <strong>confidential and secure</strong>. Cast your vote only once.
                </p>
              </div>
              
              <!-- Next Steps -->
              <div style="border-top:1px solid rgba(0,255,170,0.2);padding-top:25px;">
                <h3 style="margin:0 0 15px;color:#00ffaa;font-size:18px;">How to Vote:</h3>
                <ol style="margin:0;padding-left:25px;color:#b0b0b0;font-size:14px;line-height:1.8;">
                  <li>Click the "Vote Now" button above or visit the link manually</li>
                  <li>Enter your Organization ID: <strong style="color:#00ffaa;">${orgId}</strong></li>
                  <li>Enter your registered email address</li>
                  <li>Review the candidates and make your selections</li>
                  <li>Submit your ballot securely</li>
                </ol>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:25px 30px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(0,255,170,0.2);border-radius:0 0 10px 10px;">
              <p style="margin:0;color:#666;font-size:13px;text-align:center;">
                Need help? Visit <a href="${appUrl}" style="color:#00ffaa;text-decoration:none;">${appUrl}</a>
              </p>
              <p style="margin:10px 0 0;color:#555;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} Neon Voting System. Secure. Simple. Transparent.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: subject,
    body: body,
    html: body
  };
}

export function buildECInviteTemplate({ ecName, orgName, orgId, password, appUrl }) {
  const loginLink = `${appUrl}?role=ec&org=${orgId}`;
  
  const subject = `🔐 Election Commissioner Access - ${orgName}`;
  
  const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EC Login Credentials</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#0a0a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a0033 0%, #0d1b2a 100%);min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0d1b2a;border-radius:12px;border:2px solid #00ffaa;box-shadow:0 8px 32px rgba(0,255,170,0.2);">
          <!-- Header -->
          <tr>
            <td style="padding:30px;text-align:center;border-bottom:1px solid rgba(0,255,170,0.2);">
              <h1 style="margin:0;color:#00ffaa;font-size:28px;font-weight:700;text-shadow:0 0 20px rgba(0,255,170,0.5);">
                ⚡ Neon Voting System
              </h1>
              <p style="margin:10px 0 0;color:#888;font-size:14px;">
                Organization ID: ${orgId}
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="margin:0 0 25px;color:#ff6b9d;font-size:22px;font-weight:600;">
                Your EC Login Credentials:
              </h2>
              
              <!-- Credentials Box -->
              <div style="background:rgba(0,20,40,0.6);border:1px solid rgba(0,255,170,0.3);border-radius:8px;padding:25px;margin:0 0 25px;">
                <p style="margin:0 0 15px;color:#00d4ff;font-size:16px;line-height:1.6;">
                  <strong>Organization ID:</strong> <span style="color:#00ffaa;font-family:monospace;font-size:18px;">${orgId}</span>
                </p>
                <p style="margin:0;color:#00d4ff;font-size:16px;line-height:1.6;">
                  <strong>Password:</strong> <span style="color:#00ffaa;font-family:monospace;font-size:18px;">${password}</span>
                </p>
              </div>
              
              <!-- Warning -->
              <div style="background:rgba(255,193,7,0.1);border-left:4px solid #ffc107;border-radius:4px;padding:15px;margin:0 0 30px;">
                <p style="margin:0;color:#ffc107;font-size:14px;">
                  ⚠️ <strong>Keep this password safe and change it after first login.</strong>
                </p>
              </div>
              
              <!-- Button -->
              <div style="text-align:center;margin:0 0 30px;">
                <a href="${loginLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 15px rgba(102,126,234,0.4);">
                  Log In to Dashboard
                </a>
              </div>
              
              <!-- Next Steps -->
              <div style="border-top:1px solid rgba(0,255,170,0.2);padding-top:25px;">
                <h3 style="margin:0 0 15px;color:#00ffaa;font-size:18px;">Next Steps:</h3>
                <ol style="margin:0;padding-left:25px;color:#b0b0b0;font-size:14px;line-height:1.8;">
                  <li>Log in with your Organization ID and the password provided above</li>
                  <li>Add voters for your organization</li>
                  <li>Configure positions and candidates</li>
                  <li>Submit your election setup for approval</li>
                  <li>Once approved, voters can start voting!</li>
                </ol>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:25px 30px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(0,255,170,0.2);border-radius:0 0 10px 10px;">
              <p style="margin:0;color:#666;font-size:13px;text-align:center;">
                Need help? Visit <a href="${appUrl}" style="color:#00ffaa;text-decoration:none;">${appUrl}</a>
              </p>
              <p style="margin:10px 0 0;color:#555;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} Neon Voting System. Secure. Simple. Transparent.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: subject,
    body: body,
    html: body
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
