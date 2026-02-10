/**
 * Activity Feed & Audit Logging System
 * Two-tier logging: Activity (recent, human-readable) + Audit (immutable, compliance)
 */

import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { db } from '../config/firebase.js';

/**
 * Log activity (human-readable, recent actions for dashboard)
 * @param {object} options - Activity details
 * @param {string} options.type - Activity type (e.g., 'approval_submit', 'org_created')
 * @param {string} options.message - Human-readable message
 * @param {string} options.orgId - Organization ID (optional)
 * @param {string} options.actor - Who performed the action (default: 'system')
 * @param {string} options.role - Actor's role (default: 'system')
 */
export async function logActivity({
  type,
  message,
  orgId = null,
  actor = 'system',
  role = 'system'
}) {
  try {
    await addDoc(collection(db, 'meta', 'activity', 'logs'), {
      type,
      message,
      orgId,
      actor,
      role,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Activity log failed:', e);
  }
}

/**
 * Log audit trail (immutable, compliance-grade records)
 * @param {object} options - Audit details
 * @param {string} options.action - Action identifier (e.g., 'EC_SUBMIT_APPROVAL', 'ORG_CREATED')
 * @param {string} options.orgId - Organization ID
 * @param {string} options.actor - Who performed the action
 * @param {string} options.role - Actor's role
 * @param {object} options.before - State before change (optional)
 * @param {object} options.after - State after change (optional)
 */
export async function logAudit({
  action,
  orgId,
  actor,
  role,
  before = null,
  after = null
}) {
  try {
    await addDoc(collection(db, 'meta', 'audit', 'logs'), {
      action,
      orgId,
      actor,
      role,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Audit log failed:', e);
  }
}

/**
 * Load recent activity feed
 * @param {number} limitCount - Number of activities to fetch (default: 10)
 */
export async function loadActivityFeed(limitCount = 10) {
  const el = document.getElementById('activityFeed');
  if (!el) return;

  try {
    const q = query(
      collection(db, 'meta', 'activity', 'logs'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      el.innerHTML = `<div class="subtext">No recent activity.</div>`;
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const a = doc.data();
      const createdDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
      html += `
        <div class="activity-item" style="display:flex;gap:10px;padding:10px;border-bottom:1px solid rgba(255,255,255,0.05)">
          <div class="activity-icon" style="width:30px;min-width:30px;height:30px;border-radius:50%;background:rgba(0,234,255,0.1);display:flex;align-items:center;justify-content:center">
            <i class="fas fa-bolt" style="color:#00eaff;font-size:12px"></i>
          </div>
          <div class="activity-content" style="flex:1">
            <div class="activity-message" style="color:#fff;font-size:14px">${a.message}</div>
            <div class="subtext" style="margin-top:2px;font-size:12px">
              ${a.actor} • ${a.role} • 
              ${createdDate.toLocaleString()}
            </div>
          </div>
        </div>
      `;
    });

    el.innerHTML = html;
  } catch (e) {
    console.error('Activity feed load failed:', e);
    el.innerHTML = `<div class="subtext">Failed to load activity feed</div>`;
  }
}

/**
 * Export audit log as CSV
 */
export async function exportAuditCSV() {
  try {
    const snap = await getDocs(collection(db, 'meta', 'audit', 'logs'));
    let csv = 'Action,Org ID,Actor,Role,Before,After,Timestamp\n';

    snap.forEach(doc => {
      const a = doc.data();
      const timestamp = a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : '';
      csv += `${a.action},${a.orgId || ''},${a.actor},${a.role},${a.before || ''},${a.after || ''},${timestamp}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Audit export failed:', e);
    if (typeof window.showToast === 'function') {
      window.showToast('Failed to export audit log', 'error');
    }
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.logActivity = logActivity;
  window.logAudit = logAudit;
  window.loadActivityFeed = loadActivityFeed;
  window.exportAuditCSV = exportAuditCSV;
}
