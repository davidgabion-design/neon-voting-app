/**
 * Super Admin Module - Helpers
 * Helper functions for SuperAdmin operations
 */

import { db } from '../config/firebase.js';
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showScreen, showToast, createModal, getDefaultLogo } from '../utils/ui-helpers.js';
import { escapeHtml, validateEmail } from '../utils/validation.js';
import { logActivity } from '../utils/activity.js';

/**
 * Open organization as EC (one-click direct access)
 * @param {string} orgId - Organization ID
 */
export async function openOrgAsEC(orgId) {
  try {
    showToast('Accessing organization as EC...', 'info');
    
    // Fetch organization data
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      showToast("Organization not found", "error");
      return;
    }
    
    const org = orgSnap.data();
    
    // Import required modules
    const { getSession, saveSession } = await import('../utils/session.js');
    const { openECPanel } = await import('../ec/login.js');
    
    // Set up EC session (SuperAdmin has override access)
    const session = getSession();
    session.role = 'ec';
    session.orgId = orgId;
    session.superAdminOverride = true; // Flag for audit logs
    
    window.currentOrgId = orgId;
    window.signatureState = window.signatureState || { ec: null, superAdmin: null };
    window.signatureState.ec = {
      name: org.ecName || 'Election Commissioner',
      role: 'Election Commissioner (SuperAdmin Access)',
      signedAt: new Date().toLocaleString(),
      image: null
    };
    
    saveSession();
    
    // Navigate to EC panel
    showScreen('ecPanel');
    await openECPanel(orgId);
    
    // Start automatic alert scheduler if available
    if (typeof window.startAlertScheduler === 'function') {
      window.startAlertScheduler();
    }
    
    showToast(`✅ Logged in as EC for ${org.name || orgId}`, 'success');
    
  } catch (e) {
    console.error('Error opening org as EC:', e);
    showToast('Failed to access organization: ' + e.message, 'error');
  }
}

/**
 * Show EC invite modal for sending email/SMS/WhatsApp
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name
 * @param {string} ecPassword - EC password
 */
export function showECInviteModal(orgId, orgName, ecPassword) {
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
          <label class="label">EC Name</label>
          <input id="ecInviteName" class="input" placeholder="Election Commissioner" value="Election Commissioner">
        </div>
        <div>
          <label class="label">Email Address</label>
          <input id="ecInviteEmail" class="input" placeholder="ec@example.com" type="email">
        </div>
        <div>
          <label class="label">Phone Number</label>
          <input id="ecInvitePhone" class="input" placeholder="+233XXXXXXXXX or 0XXXXXXXXX" type="tel">
          <small style="color: #888; font-size: 11px;">For SMS/WhatsApp invites</small>
        </div>
        <div>
          <label class="label">Message (Optional)</label>
          <textarea id="ecInviteMessage" class="input" rows="2" placeholder="Add a personal message..."></textarea>
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-link"></i> EC Login Link:
          </div>
          <div style="font-size: 12px; color: #9beaff; word-break: break-all;">
            ${window.location.origin}${window.location.pathname}?org=${orgId}&role=ec
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="window.sendECInvite('${orgId}', '${escapeHtml(orgName)}', '${ecPassword}')" title="Send via Email">
        <i class="fas fa-envelope"></i> Email
      </button>
      <button class="btn neon-btn" onclick="window.sendECInviteSMS('${orgId}', '${escapeHtml(orgName)}', '${ecPassword}')" style="background: linear-gradient(135deg, #00C3FF, #00eaff);" title="Send via SMS">
        <i class="fas fa-sms"></i> SMS
      </button>
      <button class="btn neon-btn" onclick="window.sendECInviteWhatsApp('${orgId}', '${escapeHtml(orgName)}', '${ecPassword}')" style="background: linear-gradient(135deg, #25D366, #128C7E);" title="Send via WhatsApp">
        <i class="fab fa-whatsapp"></i> WhatsApp
      </button>
    `
  );
}

/**
 * Send EC invite via email
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name
 * @param {string} ecPassword - EC password
 */
export async function sendECInvite(orgId, orgName, ecPassword) {
  const email = document.getElementById('ecInviteEmail')?.value.trim();
  const message = document.getElementById('ecInviteMessage')?.value.trim();
  const ecName = document.getElementById('ecInviteName')?.value.trim() || 'Election Commissioner';
  
  if (!email || !validateEmail(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  try {
    showToast(`Sending credentials to ${email}...`, 'info');
    
    const response = await fetch('/.netlify/functions/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        recipientType: 'ec',
        orgName: orgName,
        orgId: orgId,
        recipientName: ecName,
        credentials: {
          password: ecPassword,
          type: 'password'
        }
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      showToast(`✅ EC invite sent to ${email}`, 'success');
      
      // Log invite sent in organization's invites collection
      const inviteRef = doc(db, "organizations", orgId, "invites", `ec_${Date.now()}`);
      await setDoc(inviteRef, {
        type: 'ec',
        email: email,
        name: ecName,
        sentAt: serverTimestamp(),
        sentBy: 'Super Admin',
        status: 'sent',
        method: 'email'
      });
      
      await logActivity({
        type: 'ec_invited',
        message: `EC credentials sent to ${email}`,
        orgId,
        actor: 'Super Admin',
        role: 'superadmin'
      });
      
      document.querySelector('.modal-overlay')?.remove();
    } else {
      throw new Error(result.error || 'Failed to send email');
    }
  } catch (e) {
    console.error('Error sending EC invite:', e);
    showToast(`Failed to send invite: ${e.message}`, 'error');
  }
}

/**
 * Send EC invite via SMS
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name
 * @param {string} ecPassword - EC password
 */
export async function sendECInviteSMS(orgId, orgName, ecPassword) {
  console.log('sendECInviteSMS called with:', { orgId, orgName, ecPassword });
  
  const phone = document.getElementById('ecInvitePhone')?.value.trim();
  const ecName = document.getElementById('ecInviteName')?.value.trim() || 'Election Commissioner';
  const customMessage = document.getElementById('ecInviteMessage')?.value.trim();
  
  console.log('Phone field value:', phone);
  console.log('EC Name:', ecName);
  
  if (!phone) {
    showToast('Please enter a phone number for SMS', 'error');
    return;
  }
  
  try {
    // Format phone to E.164
    let formattedPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('233')) {
        formattedPhone = '+' + formattedPhone;
      } else if (formattedPhone.startsWith('0')) {
        formattedPhone = '+233' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+233' + formattedPhone;
      }
    }
    
    console.log('Formatted phone:', formattedPhone);
    
    showToast(`Sending SMS to ${formattedPhone}...`, 'info');
    
    const appUrl = window.location.origin + window.location.pathname;
    const message = `Hi ${ecName}! You've been assigned as Election Commissioner for ${orgName}. Login: ${appUrl}?org=${orgId}&role=ec | Org ID: ${orgId} | Password: ${ecPassword}${customMessage ? ' | ' + customMessage : ''}`;
    
    console.log('SMS message:', message);
    console.log('Calling SMS function at: /.netlify/functions/send-invite-sms');
    
    const response = await fetch('/.netlify/functions/send-invite-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
        recipientType: 'ec',
        orgId: orgId,
        recipientName: ecName
      })
    });
    
    console.log('SMS Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SMS Error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('SMS Result:', result);
    
    if (result.ok) {
      showToast(`✅ SMS invite sent to ${formattedPhone}`, 'success');
      
      // Log invite in Firestore (non-blocking)
      try {
        const inviteRef = doc(db, "organizations", orgId, "invites", `ec_sms_${Date.now()}`);
        await setDoc(inviteRef, {
          type: 'ec_sms',
          phone: formattedPhone,
          name: ecName,
          sentAt: serverTimestamp(),
          sentBy: 'Super Admin',
          status: 'sent',
          method: 'sms',
          messageId: result.messageId
        });
      } catch (logErr) {
        console.warn('Failed to log invite in Firestore:', logErr.message);
      }
      
      // Log activity (non-blocking)
      try {
        await logActivity({
          type: 'ec_invited_sms',
          message: `EC credentials sent via SMS to ${formattedPhone}`,
          orgId,
          actor: 'Super Admin',
          role: 'superadmin'
        });
      } catch (logErr) {
        console.warn('Failed to log activity:', logErr.message);
      }
      
      document.querySelector('.modal-overlay')?.remove();
    } else {
      throw new Error(result.error || 'Failed to send SMS');
    }
  } catch (e) {
    console.error('Error sending EC SMS invite:', e);
    showToast(`Failed to send SMS: ${e.message}`, 'error');
  }
}

/**
 * Send EC invite via WhatsApp
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name
 * @param {string} ecPassword - EC password
 */
export async function sendECInviteWhatsApp(orgId, orgName, ecPassword) {
  console.log('sendECInviteWhatsApp called with:', { orgId, orgName, ecPassword });
  
  const phone = document.getElementById('ecInvitePhone')?.value.trim();
  const ecName = document.getElementById('ecInviteName')?.value.trim() || 'Election Commissioner';
  const customMessage = document.getElementById('ecInviteMessage')?.value.trim();
  
  console.log('Phone field value:', phone);
  console.log('EC Name:', ecName);
  
  if (!phone) {
    showToast('Please enter a phone number for WhatsApp', 'error');
    return;
  }
  
  try {
    // Format phone to E.164
    let formattedPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('233')) {
        formattedPhone = '+' + formattedPhone;
      } else if (formattedPhone.startsWith('0')) {
        formattedPhone = '+233' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+233' + formattedPhone;
      }
    }
    
    console.log('Formatted phone:', formattedPhone);
    
    showToast(`Sending WhatsApp to ${formattedPhone}...`, 'info');
    
    const appUrl = window.location.origin + window.location.pathname;
    const message = `Hi ${ecName}! 👋\n\nYou've been assigned as Election Commissioner for *${orgName}*.\n\n📋 *Login Details:*\n🔗 Link: ${appUrl}?org=${orgId}&role=ec\n🆔 Org ID: ${orgId}\n🔑 Password: ${ecPassword}\n${customMessage ? '\n💬 ' + customMessage : ''}\n\n✨ Manage your election from the EC dashboard!`;
    
    console.log('WhatsApp message:', message);
    console.log('Calling WhatsApp function at: /.netlify/functions/send-whatsapp');
    
    const response = await fetch('/.netlify/functions/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: formattedPhone,
        message: message,
        voterName: ecName,
        orgId: orgId
      })
    });
    
    console.log('WhatsApp Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp Error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('WhatsApp Result:', result);
    
    if (result.ok) {
      showToast(`✅ WhatsApp invite sent to ${formattedPhone}`, 'success');
      
      // Log invite in Firestore (non-blocking)
      try {
        const inviteRef = doc(db, "organizations", orgId, "invites", `ec_whatsapp_${Date.now()}`);
        await setDoc(inviteRef, {
          type: 'ec_whatsapp',
          phone: formattedPhone,
          name: ecName,
          sentAt: serverTimestamp(),
          sentBy: 'Super Admin',
          status: 'sent',
          method: 'whatsapp',
          messageId: result.sid
        });
      } catch (logErr) {
        console.warn('Failed to log invite in Firestore:', logErr.message);
      }
      
      // Log activity (non-blocking)
      try {
        await logActivity({
          type: 'ec_invited_whatsapp',
          message: `EC credentials sent via WhatsApp to ${formattedPhone}`,
          orgId,
          actor: 'Super Admin',
          role: 'superadmin'
        });
      } catch (logErr) {
        console.warn('Failed to log activity:', logErr.message);
      }
      
      document.querySelector('.modal-overlay')?.remove();
    } else {
      throw new Error(result.error || 'Failed to send WhatsApp');
    }
  } catch (e) {
    console.error('Error sending EC WhatsApp invite:', e);
    showToast(`Failed to send WhatsApp: ${e.message}`, 'error');
  }
}

/**
 * Send EC invite email automatically (called after org creation)
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name
 * @param {string} ecPassword - EC password
 * @param {string} email - EC email address
 * @param {string} ecName - EC name
 */
export async function sendECInviteEmail(orgId, orgName, ecPassword, email, ecName) {
  try {
    showToast(`Sending credentials to ${email}...`, 'info');
    
    const loginLink = `${window.location.origin}${window.location.pathname}?org=${orgId}&role=ec`;
    
    const response = await fetch('/.netlify/functions/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        recipientType: 'ec',
        orgName: orgName,
        orgId: orgId,
        recipientName: ecName,
        credentials: {
          password: ecPassword,
          type: 'password'
        }
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      showToast(`✅ Credentials sent to ${email}`, 'success');
      
      // Log invite sent in organization's invites collection
      const inviteRef = doc(db, "organizations", orgId, "invites", `ec_${Date.now()}`);
      await setDoc(inviteRef, {
        type: 'ec',
        email: email,
        name: ecName,
        sentAt: serverTimestamp(),
        sentBy: 'Super Admin',
        status: 'sent',
        method: 'email'
      });
      
      await logActivity({
        type: 'ec_invited',
        message: `EC credentials sent to ${email}`,
        orgId,
        actor: 'Super Admin',
        role: 'superadmin'
      });
    } else {
      throw new Error(result.error || 'Failed to send email');
    }
  } catch (e) {
    console.error('Error sending EC invite:', e);
    showToast(`⚠️ Organization created but failed to send email: ${e.message}`, 'warning');
  }
}

/**
 * Show EC WhatsApp invite modal
 * @param {string} orgId - Organization ID
 * @param {string} orgName - Organization name
 * @param {string} ecPassword - EC password
 */
export function showECWhatsAppModal(orgId, orgName, ecPassword) {
  try {
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
        <button class="btn neon-btn-outline" onclick="window.closeModal()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="window.sendECWhatsAppInvite('${escapeHtml(orgId)}')">
          <i class="fab fa-whatsapp"></i> Open WhatsApp
        </button>
      `
    );

    const msg = `🗳 *Neon Voting System*\n\nHello,\nYou have been appointed as the *Election Commissioner (EC)* for:\n*${orgName || orgId}*\n\n🆔 Org ID: ${orgId}\n🔐 EC Password: ${ecPassword || ''}\n\n👉 Login link:\n${loginLink}\n\n⚠️ Keep these credentials secure.`;
    const ta = document.getElementById("ecInviteWAMessage");
    if (ta) ta.value = msg;

  } catch(e) {
    console.error("showECWhatsAppModal error:", e);
    showToast("Failed to open WhatsApp invite modal", "error");
  }
}

/**
 * Send EC WhatsApp invite
 * @param {string} orgId - Organization ID
 */
export function sendECWhatsAppInvite(orgId) {
  try {
    const phoneRaw = String(document.getElementById("ecInviteWAPhone")?.value || "").trim();
    const message = String(document.getElementById("ecInviteWAMessage")?.value || "").trim();
    
    if (!phoneRaw) {
      showToast("Please enter a phone number", "error");
      return;
    }
    if (!message) {
      showToast("Message cannot be empty", "error");
      return;
    }
    
    // Normalize phone number
    let phone = phoneRaw.replace(/\s+/g, '');
    if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }
    
    const waURL = `https://wa.me/${phone.substring(1)}?text=${encodeURIComponent(message)}`;
    window.open(waURL, '_blank');
    showToast("Opening WhatsApp...", "success");
    document.querySelector('.modal-overlay')?.remove();
    
  } catch(e) {
    console.error("sendECWhatsAppInvite error:", e);
    showToast("Failed to send WhatsApp invite", "error");
  }
}

/**
 * Close modal helper
 */
export function closeModal() {
  document.querySelector('.modal-overlay')?.remove();
}

/**
 * Show password modal for viewing EC password
 * @param {string} orgId - Organization ID
 * @param {string} ecPassword - EC Password
 */
export function showPasswordModal(orgId, ecPassword) {
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
      <button class="btn neon-btn" onclick="navigator.clipboard.writeText('${ecPassword}').then(() => window.showToast('Password copied!', 'success'))" style="flex: 1">
        <i class="fas fa-copy"></i> Copy Password
      </button>
    `
  );
}

/**
 * View organization details
 * @param {string} orgId - Organization ID
 */
export async function viewOrgDetails(orgId) {
  try {
    const orgDoc = await getDoc(doc(db, "organizations", orgId));
    if (!orgDoc.exists()) {
      showToast("Organization not found", "error");
      return;
    }

    const org = orgDoc.data();
    
    // Fetch related data
    const [votersSnap, positionsSnap, candidatesSnap, votesSnap] = await Promise.all([
      getDocs(collection(db, "organizations", orgId, "voters")),
      getDocs(collection(db, "organizations", orgId, "positions")),
      getDocs(collection(db, "organizations", orgId, "candidates")),
      getDocs(collection(db, "organizations", orgId, "votes"))
    ]);
    
    const activeVoters = votersSnap.docs.filter(d => !d.data().isReplaced);
    const votedCount = activeVoters.filter(d => d.data().hasVoted).length;
    const positions = positionsSnap.docs;
    const candidates = candidatesSnap.docs;
    const votes = votesSnap.docs;
    
    const participation = activeVoters.length > 0 ? Math.round((votedCount / activeVoters.length) * 100) : 0;
    
    // Election type label
    const electionTypeLabels = {
      'single_winner': '🏆 Single Winner',
      'multiple_winner': '👥 Multiple Winners',
      'referendum': '✓ Referendum',
      'custom': '⚙️ Custom'
    };
    
    // Approval status badge
    const approvalStatus = org.approval?.status || 'not_submitted';
    const approvalBadge = {
      'approved': '<span class="badge success"><i class="fas fa-check-circle"></i> Approved</span>',
      'pending': '<span class="badge warning"><i class="fas fa-hourglass-half"></i> Pending</span>',
      'rejected': '<span class="badge danger"><i class="fas fa-times-circle"></i> Rejected</span>',
      'not_submitted': '<span class="badge info"><i class="fas fa-info-circle"></i> Not Submitted</span>'
    }[approvalStatus];
    
    // Election status
    const statusBadge = {
      'active': '<span class="badge success">Active</span>',
      'scheduled': '<span class="badge warning">Scheduled</span>',
      'declared': '<span class="badge info">Results Declared</span>',
      'locked': '<span class="badge warning">Locked</span>'
    }[org.electionStatus || 'active'];
    
    const modal = createModal(
      `<i class="fas fa-building"></i> ${escapeHtml(org.name || orgId)}`,
      `
        <div style="display:flex;flex-direction:column;gap:20px">
          <!-- Organization Header -->
          <div style="display:flex;gap:15px;align-items:start;padding:15px;background:rgba(0,255,255,0.05);border-radius:12px;border:1px solid rgba(0,255,255,0.2)">
            <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                 style="width:80px;height:80px;border-radius:12px;object-fit:cover;border:2px solid rgba(0,255,255,0.3)">
            <div style="flex:1">
              <h3 style="margin:0 0 8px;color:#00eaff">${escapeHtml(org.name || orgId)}</h3>
              <div class="subtext" style="margin-bottom:8px">${escapeHtml(org.description || 'No description')}</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
                ${approvalBadge}
                ${statusBadge}
                <span class="badge info">${electionTypeLabels[org.electionType] || '—'}</span>
              </div>
            </div>
          </div>
          
          <!-- Statistics Grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
            <div style="padding:12px;background:rgba(0,234,255,0.1);border-radius:8px;border:1px solid rgba(0,234,255,0.3)">
              <div style="color:#00eaff;font-size:12px;margin-bottom:4px"><i class="fas fa-users"></i> Total Voters</div>
              <div style="font-size:24px;font-weight:bold;color:#fff">${activeVoters.length}</div>
            </div>
            <div style="padding:12px;background:rgba(0,255,170,0.1);border-radius:8px;border:1px solid rgba(0,255,170,0.3)">
              <div style="color:#00ffaa;font-size:12px;margin-bottom:4px"><i class="fas fa-check-circle"></i> Votes Cast</div>
              <div style="font-size:24px;font-weight:bold;color:#fff">${votedCount}</div>
            </div>
            <div style="padding:12px;background:rgba(255,0,255,0.1);border-radius:8px;border:1px solid rgba(255,0,255,0.3)">
              <div style="color:#ff00ff;font-size:12px;margin-bottom:4px"><i class="fas fa-chart-bar"></i> Participation</div>
              <div style="font-size:24px;font-weight:bold;color:#fff">${participation}%</div>
            </div>
          </div>
          
          <!-- Election Details -->
          <div style="padding:15px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.1)">
            <h4 style="margin:0 0 12px;color:#00eaff"><i class="fas fa-info-circle"></i> Election Details</h4>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
              <div>
                <div class="label">Organization ID</div>
                <div style="font-family:monospace;color:#00eaff">${orgId}</div>
              </div>
              <div>
                <div class="label">EC Email</div>
                <div>${escapeHtml(org.ecEmail || '—')}</div>
              </div>
              <div>
                <div class="label">Positions</div>
                <div>${positions.length} positions</div>
              </div>
              <div>
                <div class="label">Candidates</div>
                <div>${candidates.length} candidates</div>
              </div>
              ${org.electionSettings?.startTime ? `
                <div>
                  <div class="label">Start Time</div>
                  <div>${new Date(org.electionSettings.startTime).toLocaleString()}</div>
                </div>
                <div>
                  <div class="label">End Time</div>
                  <div>${new Date(org.electionSettings.endTime).toLocaleString()}</div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;padding:15px;background:rgba(0,234,255,0.05);border-radius:12px;border:1px solid rgba(0,234,255,0.1)">
            <button class="btn neon-btn-outline" onclick="window.openOrgAsEC('${orgId}')" style="flex:1">
              <i class="fas fa-user-shield"></i> Open as EC
            </button>
            <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove();window.editOrganizationModal('${orgId}')" style="flex:1">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn neon-btn-outline" onclick="window.open('${window.location.origin}/?org=${orgId}', '_blank')" style="flex:1">
              <i class="fas fa-external-link-alt"></i> Public Link
            </button>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Close
        </button>
      `
    );
  } catch (e) {
    console.error('Error loading organization details:', e);
    showToast('Error loading organization: ' + e.message, 'error');
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.openOrgAsEC = openOrgAsEC;
  window.showECInviteModal = showECInviteModal;
  window.sendECInvite = sendECInvite;
  window.sendECInviteSMS = sendECInviteSMS;
  window.sendECInviteWhatsApp = sendECInviteWhatsApp;
  window.sendECInviteEmail = sendECInviteEmail;
  window.showECWhatsAppModal = showECWhatsAppModal;
  window.sendECWhatsAppInvite = sendECWhatsAppInvite;
  window.closeModal = closeModal;
  window.showPasswordModal = showPasswordModal;
  window.viewOrgDetails = viewOrgDetails;
}
