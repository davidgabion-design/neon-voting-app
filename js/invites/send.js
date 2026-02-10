/**
 * Invites Module - Send Operations
 * Handles sending individual email and SMS invitations
 */

import { db } from '../config/firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast } from '../utils/ui-helpers.js';
import { validateEmail } from '../utils/validation.js';

/**
 * Send email invitation to voter
 */
export async function sendVoterInvite(voterEmail, voterName, voterPhone) {
  try {
    if (!window.currentOrgId || !window.currentOrgData) {
      showToast("No organization selected", "error");
      return;
    }
    
    const credentialType = validateEmail(voterEmail) ? 'email' : 'phone';
    const credential = credentialType === 'email' ? voterEmail : voterPhone;
    
    if (!credential) {
      showToast("Voter has no email or phone to send invite", "error");
      return;
    }
    
    showToast("Sending voter invitation...", "info");
    
    const response = await fetch("/.netlify/functions/send-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: credential,
        recipientType: "voter",
        orgName: window.currentOrgData.name || window.currentOrgId,
        orgId: window.currentOrgId,
        recipientName: voterName || "Voter",
        credentials: { credential: credential, type: credentialType }
      })
    });
    
    if (!response.ok) {
      if (response.status === 405 || response.status === 404) {
        showToast("⚠️ Netlify Functions not available. Please run 'netlify dev' instead of Live Server.", "error", 5000);
        console.error("Netlify Functions Error: Make sure to run 'netlify dev' in terminal, not a regular web server.");
        return;
      }
      const errorText = await response.text();
      showToast(`Failed to send invitation: ${response.status} ${errorText}`, "error");
      return;
    }
    
    const text = await response.text();
    const result = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
    
    if (!result.ok) {
      showToast("Failed to send invitation: " + (result.error || "Unknown error"), "error");
      return;
    }
    
    // Store invite record
    const inviteRef = collection(db, "organizations", window.currentOrgId, "invites");
    const newInvite = {
      type: "voter",
      email: credential,
      name: voterName || "Voter",
      sentAt: serverTimestamp(),
      status: "sent",
      sentBy: "ec"
    };
    await addDoc(inviteRef, newInvite);
    
    showToast(`✅ Invitation sent to ${credential}`, "success");
  } catch (e) {
    console.error("Error sending voter invite:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Send SMS invitation to voter
 */
export async function sendVoterInviteSMS(voterPhone, voterName) {
  try {
    if (!window.currentOrgId || !window.currentOrgData || !voterPhone) {
      showToast("Voter phone or organization not available", "error");
      return;
    }
    
    // Format phone to E.164 for Twilio
    let formattedPhone = voterPhone.trim();
    
    console.log("📱 SMS Formatting - Original:", voterPhone);
    
    // Remove any spaces or special characters
    formattedPhone = formattedPhone.replace(/[\s\-\(\)]/g, '');
    console.log("📱 SMS Formatting - After cleanup:", formattedPhone);
    
    if (!formattedPhone.startsWith('+')) {
      // If starts with 233 (country code), just add +
      if (formattedPhone.startsWith('233')) {
        formattedPhone = '+' + formattedPhone;
      }
      // If starts with 0, replace with +233
      else if (formattedPhone.startsWith('0')) {
        formattedPhone = '+233' + formattedPhone.substring(1);
      }
      // Otherwise assume it's local number, add +233
      else {
        formattedPhone = '+233' + formattedPhone;
      }
    }
    
    console.log("📱 SMS Formatting - Final E.164:", formattedPhone);
    console.log("📱 Phone length (should be 13):", formattedPhone.length);
    
    const appUrl = (typeof window !== 'undefined' && window.APP_URL) ? window.APP_URL : window.location.origin;
    const message = `Hi ${voterName}! You're invited to vote in ${window.currentOrgData.name || window.currentOrgId} election. Visit: ${appUrl} Use Org ID: ${window.currentOrgId} and your phone to log in. 🗳️`;
    
    console.log("📱 SMS Message:", message);
    console.log("📱 Message length:", message.length);
    
    showToast("Sending SMS invitation...", "info");
    
    const response = await fetch("/.netlify/functions/send-invite-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
        recipientType: "voter",
        orgId: window.currentOrgId,
        recipientName: voterName
      })
    });
    
    if (!response.ok) {
      if (response.status === 405 || response.status === 404) {
        showToast("⚠️ Netlify Functions not available. Please run 'netlify dev' instead of Live Server.", "error", 5000);
        console.error("Netlify Functions Error: Make sure to run 'netlify dev' in terminal.");
        return;
      }
      const errorText = await response.text();
      showToast(`Failed to send SMS: ${response.status} ${errorText}`, "error");
      return;
    }
    
    const text = await response.text();
    const result = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
    
    if (result.ok) {
      const inviteRef = collection(db, "organizations", window.currentOrgId, "invites");
      await addDoc(inviteRef, {
        type: "voter_sms",
        phone: formattedPhone,
        name: voterName || "Voter",
        sentAt: serverTimestamp(),
        status: result.status || "sent",
        twilioStatus: result.details?.twilioStatus,
        messageId: result.messageId,
        sentBy: "ec"
      });
      
      // Show detailed status to user
      const statusMsg = result.status === 'queued' || result.status === 'accepted' 
        ? `✅ SMS queued for delivery to ${formattedPhone}` 
        : `✅ SMS sent to ${formattedPhone} (Status: ${result.status || 'sent'})`;
      
      showToast(statusMsg, "success");
      
      // If status is queued, inform user it may take a moment
      if (result.status === 'queued') {
        setTimeout(() => {
          showToast("📱 SMS is being delivered by Twilio. Check recipient's phone.", "info", 3000);
        }, 1500);
      }
    } else {
      showToast("Failed to send SMS: " + (result.error || "Unknown error"), "error");
    }
  } catch (e) {
    console.error("Error sending SMS invite:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Send WhatsApp invitation to voter
 */
export async function sendVoterInviteWhatsApp(voterPhone, voterName) {
  try {
    if (!window.currentOrgId || !window.currentOrgData) {
      showToast("No organization selected", "error");
      return;
    }
    
    if (!voterPhone) {
      showToast("Voter has no phone number to send WhatsApp", "error");
      return;
    }
    
    // Format phone to E.164 if not already
    let formattedPhone = voterPhone.trim();
    
    // Remove any spaces or special characters
    formattedPhone = formattedPhone.replace(/[\s\-\(\)]/g, '');
    
    if (!formattedPhone.startsWith('+')) {
      // If starts with 233 (country code), just add +
      if (formattedPhone.startsWith('233')) {
        formattedPhone = '+' + formattedPhone;
      }
      // If starts with 0, replace with +233
      else if (formattedPhone.startsWith('0')) {
        formattedPhone = '+233' + formattedPhone.substring(1);
      }
      // Otherwise assume it's local number, add +233
      else {
        formattedPhone = '+233' + formattedPhone;
      }
    }
    
    const appUrl = window.location.origin;
    const message = `Hi ${voterName}! You're invited to vote in ${window.currentOrgData.name || window.currentOrgId} election. Visit: ${appUrl} Use Org ID: ${window.currentOrgId} 🗳️`;
    
    showToast("Sending WhatsApp invitation...", "info");
    
    const response = await fetch("/.netlify/functions/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: formattedPhone,
        message: message,
        voterName: voterName,
        orgId: window.currentOrgId
      })
    });
    
    if (!response.ok) {
      if (response.status === 405 || response.status === 404) {
        showToast("⚠️ Netlify Functions not available. Please run 'netlify dev' instead of Live Server.", "error", 5000);
        console.error("Netlify Functions Error: Make sure to run 'netlify dev' in terminal.");
        return;
      }
      const errorText = await response.text();
      showToast(`Failed to send WhatsApp: ${response.status} ${errorText}`, "error");
      return;
    }
    
    const text = await response.text();
    const result = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
    
    if (result.ok) {
      const inviteRef = collection(db, "organizations", window.currentOrgId, "invites");
      await addDoc(inviteRef, {
        type: "voter_whatsapp",
        phone: formattedPhone,
        name: voterName || "Voter",
        sentAt: serverTimestamp(),
        status: result.status || "sent",
        twilioStatus: result.status,
        messageId: result.sid,
        sentBy: "ec"
      });
      
      // Show detailed status
      const statusMsg = result.status === 'queued' || result.status === 'accepted' 
        ? `✅ WhatsApp queued for ${formattedPhone}` 
        : `✅ WhatsApp sent to ${formattedPhone}`;
      
      showToast(statusMsg, "success");
      
      // Additional info for queued messages
      if (result.status === 'queued') {
        setTimeout(() => {
          showToast("💬 WhatsApp message is being delivered by Twilio.", "info", 3000);
        }, 1500);
      }
    } else {
      // Show user-friendly error messages
      let errorMsg = result.error || "Unknown error";
      if (errorMsg.includes("Channel with the specified From address")) {
        errorMsg = "WhatsApp not configured. Contact admin to set up Twilio WhatsApp sandbox.";
      } else if (errorMsg.includes("opted in")) {
        errorMsg = "Voter needs to opt-in to WhatsApp first. Send them the join code.";
      }
      showToast("Failed to send WhatsApp: " + errorMsg, "error", 5000);
    }
  } catch (e) {
    console.error("Error sending WhatsApp invite:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Send EC invitation
 */
export async function sendECInvite(orgId, orgName, ecPassword) {
  try {
    const email = document.getElementById('ecInviteEmail')?.value.trim();
    const ecName = document.getElementById('ecInviteName')?.value.trim() || 'Election Commissioner';
    
    if (!email) {
      showToast('Please enter EC email address', 'error');
      return;
    }
    
    if (!validateEmail(email)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    
    showToast('Sending EC invitation...', 'info');
    
    const response = await fetch('/.netlify/functions/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        recipientType: 'ec',
        orgName: orgName || orgId,
        orgId: orgId,
        recipientName: ecName,
        credentials: { password: ecPassword }
      })
    });
    
    if (!response.ok) {
      if (response.status === 405 || response.status === 404) {
        showToast("⚠️ Netlify Functions not available. Please run 'netlify dev' instead of Live Server.", "error", 5000);
        console.error("Netlify Functions Error: Make sure to run 'netlify dev' in terminal.");
        return;
      }
      const errorText = await response.text();
      showToast(`Failed to send invitation: ${response.status} ${errorText}`, 'error');
      return;
    }
    
    const text = await response.text();
    const result = text ? JSON.parse(text) : { ok: false, error: 'Empty response' };
    
    if (result.ok) {
      const inviteRef = collection(db, "organizations", orgId, "invites");
      await addDoc(inviteRef, {
        type: "ec",
        email: email,
        name: ecName,
        sentAt: serverTimestamp(),
        status: "sent",
        sentBy: "superadmin"
      });
      
      showToast(`✅ EC invitation sent to ${email}`, 'success');
      document.getElementById('ecInviteEmail').value = '';
      document.getElementById('ecInviteName').value = '';
    } else {
      showToast('Failed to send invitation: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    console.error('Error sending EC invite:', e);
    showToast('Error: ' + e.message, 'error');
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.sendVoterInvite = sendVoterInvite;
  window.sendVoterInviteSMS = sendVoterInviteSMS;
  window.sendVoterInviteWhatsApp = sendVoterInviteWhatsApp;
  window.sendECInvite = sendECInvite;
}
