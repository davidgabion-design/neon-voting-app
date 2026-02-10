/**
 * Invites Module - Tracking & Analytics
 * Handles invite tracking dashboard, filtering, and analytics
 */

import { db } from '../config/firebase.js';
import { collection, doc, getDocs, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showQuickLoading, renderError } from '../utils/ui-helpers.js';
import { escapeHtml } from '../utils/validation.js';

/**
 * Load invites tracking dashboard
 */
export async function loadInvitesTracking() {
  const el = document.getElementById("ecContent-invites-list") || document.getElementById("ecContent-invites");
  if (!el || !window.currentOrgId) return;
  
  showQuickLoading(el.id, "Loading Invites");
  
  try {
    const invitesSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "invites"));
    const invites = [];
    invitesSnap.forEach(doc => {
      const data = doc.data();
      invites.push({
        id: doc.id,
        ...data,
        sentAt: data.sentAt ? new Date(data.sentAt.toDate ? data.sentAt.toDate() : data.sentAt) : new Date()
      });
    });
    
    // Sort by most recent first
    invites.sort((a, b) => b.sentAt - a.sentAt);
    
    // Calculate stats
    const totalSent = invites.length;
    const ecInvites = invites.filter(i => i.type === 'ec').length;
    const voterInvites = invites.filter(i => i.type === 'voter' || i.type === 'voter_sms').length;
    const openedInvites = invites.filter(i => i.status === 'opened').length;
    const clickedInvites = invites.filter(i => i.status === 'clicked').length;
    
    let html = `
      <div class="card info-card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-around;text-align:center;gap:20px;flex-wrap:wrap">
          <div>
            <div class="label">Total Sent</div>
            <div style="font-weight:bold;font-size:24px;color:#00eaff">${totalSent}</div>
          </div>
          <div>
            <div class="label">EC Invites</div>
            <div style="font-weight:bold;font-size:24px;color:#9D00FF">${ecInvites}</div>
          </div>
          <div>
            <div class="label">Voter Invites</div>
            <div style="font-weight:bold;font-size:24px;color:#00ffaa">${voterInvites}</div>
          </div>
          <div>
            <div class="label">Opened</div>
            <div style="font-weight:bold;font-size:24px;color:#ffc107">${openedInvites}</div>
          </div>
          <div>
            <div class="label">Clicked</div>
            <div style="font-weight:bold;font-size:24px;color:#00C3FF">${clickedInvites}</div>
          </div>
        </div>
      </div>
    `;
    
    if (invites.length === 0) {
      html += `
        <div class="card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-envelope" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Invites Sent Yet</h3>
          <p class="subtext">Send invites to voters from the Voters tab</p>
        </div>
      `;
    } else {
      html += `
        <div style="margin-top:15px">
          <div style="display:flex;gap:8px;margin-bottom:15px;flex-wrap:wrap">
            <input type="text" id="inviteSearch" class="input" placeholder="Filter by email or name..." style="flex:1;min-width:200px" onkeyup="filterInvites()">
            <select id="inviteTypeFilter" class="input" style="flex:0 0 150px" onchange="filterInvites()">
              <option value="">All Types</option>
              <option value="ec">EC Invites</option>
              <option value="voter">Voter Invites</option>
            </select>
            <select id="inviteStatusFilter" class="input" style="flex:0 0 150px" onchange="filterInvites()">
              <option value="">All Status</option>
              <option value="sent">Sent</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
            </select>
          </div>
        </div>
      `;
      
      invites.forEach(invite => {
        const timeAgo = getTimeAgo(invite.sentAt);
        const typeIcon = invite.type === 'ec' ? '<i class="fas fa-user-tie" style="color:#9D00FF"></i>' : '<i class="fas fa-user" style="color:#00ffaa"></i>';
        const statusColor = invite.status === 'sent' ? '#888' : invite.status === 'opened' ? '#ffc107' : '#00C3FF';
        const statusIcon = invite.status === 'sent' ? '📤' : invite.status === 'opened' ? '📖' : '🔗';
        
        html += `
          <div class="list-item invite-item" style="margin-bottom:10px;border-left:4px solid ${statusColor}" data-type="${invite.type}" data-status="${invite.status}" data-email="${(invite.email || '').toLowerCase()}">
            <div style="display:flex;gap:12px;align-items:center;flex:1">
              <div style="font-size:20px">${typeIcon}</div>
              <div style="flex:1">
                <div><strong>${escapeHtml(invite.name || invite.email)}</strong></div>
                <div class="subtext" style="margin-top:2px">${escapeHtml(invite.email || invite.phone || '')}</div>
                <div class="subtext" style="margin-top:4px;font-size:12px">
                  Sent ${timeAgo} • <span style="color:${statusColor}">${statusIcon} ${invite.status}</span>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="resendInvite('${escapeHtml(invite.id)}', '${escapeHtml(invite.type)}')" title="Resend">
                <i class="fas fa-redo"></i>
              </button>
              <button class="btn btn-danger" onclick="deleteInvite('${escapeHtml(invite.id)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
    
    el.innerHTML = html;
    
  } catch(e) {
    console.error("Error loading invites:", e);
    renderError(el.id, "Error loading invites", "loadInvitesTracking()");
  }
}

/**
 * Filter invites based on search and filters
 */
export function filterInvites() {
  const searchTerm = (document.getElementById('inviteSearch')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('inviteTypeFilter')?.value || '';
  const statusFilter = document.getElementById('inviteStatusFilter')?.value || '';
  
  const items = document.querySelectorAll('.invite-item');
  
  items.forEach(item => {
    const email = item.getAttribute('data-email') || '';
    const type = item.getAttribute('data-type') || '';
    const status = item.getAttribute('data-status') || '';
    
    const matchesSearch = email.includes(searchTerm) || item.textContent.toLowerCase().includes(searchTerm);
    const matchesType = !typeFilter || type.includes(typeFilter);
    const matchesStatus = !statusFilter || status === statusFilter;
    
    item.style.display = (matchesSearch && matchesType && matchesStatus) ? 'flex' : 'none';
  });
}

/**
 * Resend an invitation
 */
export async function resendInvite(inviteId, inviteType) {
  try {
    if (!window.currentOrgId) return;
    
    const inviteSnap = await getDoc(doc(db, "organizations", window.currentOrgId, "invites", inviteId));
    if (!inviteSnap.exists()) {
      showToast("Invite not found", "error");
      return;
    }
    
    const invite = inviteSnap.data();
    showToast("Resending invite...", "info");
    
    const response = await fetch("/.netlify/functions/send-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: invite.email,
        recipientType: inviteType,
        orgName: window.currentOrgData?.name || window.currentOrgId,
        orgId: window.currentOrgId,
        recipientName: invite.name || invite.email,
        credentials: inviteType === 'ec' ? 
          { password: "Check original invite" } :
          { credential: invite.email, type: 'email' }
      })
    });
    
    if (!response.ok) {
      if (response.status === 405 || response.status === 404) {
        showToast("⚠️ Netlify Functions not available. Please run 'netlify dev' instead of Live Server.", "error", 5000);
        console.error("Netlify Functions Error: Make sure to run 'netlify dev' in terminal.");
        return;
      }
      const errorText = await response.text();
      showToast(`Failed to resend: ${response.status} ${errorText}`, "error");
      return;
    }
    
    const text = await response.text();
    const result = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
    
    if (result.ok) {
      await updateDoc(doc(db, "organizations", window.currentOrgId, "invites", inviteId), {
        resendAt: serverTimestamp()
      });
      showToast(`✅ Invite resent to ${invite.email}`, "success");
      loadInvitesTracking();
    } else {
      showToast("Failed to resend: " + result.error, "error");
    }
  } catch (e) {
    console.error("Error resending invite:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Delete an invite record
 */
export async function deleteInvite(inviteId) {
  try {
    if (!window.currentOrgId || !confirm("Delete this invite record?")) return;
    
    await deleteDoc(doc(db, "organizations", window.currentOrgId, "invites", inviteId));
    showToast("Invite deleted", "success");
    loadInvitesTracking();
  } catch (e) {
    console.error("Error deleting invite:", e);
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Get time ago from date
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadInvitesTracking = loadInvitesTracking;
  window.filterInvites = filterInvites;
  window.resendInvite = resendInvite;
  window.deleteInvite = deleteInvite;
}
