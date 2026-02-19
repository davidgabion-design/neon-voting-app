/**
 * EC Support Module
 * Functions for ECs to contact Super Admin
 */

import { showToast } from '../utils/ui-helpers.js';
import { logActivity } from '../utils/activity.js';

// Super Admin contact details (configured for production)
const SUPER_ADMIN_CONTACT = {
  whatsapp: '+233247654381', // Super Admin WhatsApp number
  email: 'neonvotinghq@gmail.com', // Super Admin email
  name: 'Neon Voting Support'
};

/**
 * Contact Super Admin via WhatsApp
 * @param {string} customMessage - Optional pre-filled message
 */
export function contactSuperAdminWhatsApp(customMessage = '') {
  const orgName = document.getElementById('ecOrgName')?.textContent || 'My Organization';
  const orgId = window.currentOrgId || 'Unknown';
  
  // Default message if no custom message provided
  const message = customMessage || 
    `Hello ${SUPER_ADMIN_CONTACT.name},\n\n` +
    `I need assistance with ${orgName} (ID: ${orgId}).\n\n` +
    `Could you please help me with:\n`;
  
  // Format phone number for WhatsApp (remove spaces, dashes, parentheses, plus signs)
  let formattedPhone = SUPER_ADMIN_CONTACT.whatsapp.replace(/[\s\-\(\)\+]/g, '');
  
  // If starts with 0, replace with Ghana country code
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '233' + formattedPhone.substring(1);
  }
  
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  
  // Open in new tab/window
  window.open(whatsappUrl, '_blank');
  showToast('Opening WhatsApp...', 'success');
  
  // Log communication attempt
  logActivity({
    type: 'superadmin_contact_initiated',
    message: `EC initiated WhatsApp contact with Super Admin for ${orgName}`,
    orgId: window.currentOrgId || null,
    actor: 'Election Commissioner',
    role: 'ec'
  }).catch(err => console.warn('Failed to log activity:', err));
}

/**
 * Contact Super Admin via Email
 */
export function contactSuperAdminEmail() {
  const orgName = document.getElementById('ecOrgName')?.textContent || 'My Organization';
  const orgId = window.currentOrgId || 'Unknown';
  
  const subject = encodeURIComponent(`Support Request - ${orgName} (${orgId})`);
  const body = encodeURIComponent(
    `Dear ${SUPER_ADMIN_CONTACT.name},\n\n` +
    `I am writing to request assistance with the following:\n\n` +
    `Organization: ${orgName}\n` +
    `Organization ID: ${orgId}\n\n` +
    `Issue/Question:\n` +
    `[Please describe your issue here]\n\n` +
    `Thank you for your support.\n\n` +
    `Best regards,\n` +
    `Election Commissioner`
  );
  
  // Open email client
  window.location.href = `mailto:${SUPER_ADMIN_CONTACT.email}?subject=${subject}&body=${body}`;
  showToast('Opening email client...', 'success');
  
  // Log communication attempt
  logActivity({
    type: 'superadmin_contact_initiated',
    message: `EC initiated email contact with Super Admin for ${orgName}`,
    orgId: window.currentOrgId || null,
    actor: 'Election Commissioner',
    role: 'ec'
  }).catch(err => console.warn('Failed to log activity:', err));
}

/**
 * Send quick WhatsApp message with pre-filled topic
 * @param {string} topic - The help topic
 */
export function sendQuickWhatsApp(topic) {
  const orgName = document.getElementById('ecOrgName')?.textContent || 'My Organization';
  const orgId = window.currentOrgId || 'Unknown';
  
  const message = 
    `Hello ${SUPER_ADMIN_CONTACT.name},\n\n` +
    `I need help with: ${topic}\n\n` +
    `Organization: ${orgName} (${orgId})\n\n`;
  
  contactSuperAdminWhatsApp(message);
}

/**
 * Open documentation (placeholder for future documentation link)
 */
export function openDocumentation() {
  // TODO: Replace with actual documentation URL
  showToast('Documentation coming soon! Contact support for immediate help.', 'info');
  
  // Optional: Open user guide or README
  // window.open('/user_guide_invites.md', '_blank');
}

// Export to window for HTML onclick handlers
if (typeof window !== 'undefined') {
  window.contactSuperAdminWhatsApp = contactSuperAdminWhatsApp;
  window.contactSuperAdminEmail = contactSuperAdminEmail;
  window.sendQuickWhatsApp = sendQuickWhatsApp;
  window.openDocumentation = openDocumentation;
}
