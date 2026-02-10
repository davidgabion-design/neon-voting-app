/**
 * Audit Module
 * Handles audit logging for actions
 */

import { db } from '../config/firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * Write audit log entry
 * @param {string} orgId - Organization ID
 * @param {string} action - Action performed
 * @param {string} actor - Who performed the action
 * @param {Object} meta - Additional metadata
 */
export async function writeAudit(orgId, action, actor, meta) {
  try {
    if (!orgId) return;
    await addDoc(collection(db, "organizations", orgId, "audit_logs"), {
      action: String(action || ""),
      actor: String(actor || ""),
      meta: meta || {},
      at: serverTimestamp()
    });
  } catch (e) {
    console.warn("audit failed", e);
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.writeAudit = writeAudit;
}
