/**
 * EC Module - Dashboard
 * Handles EC dashboard navigation and tab switching
 */

/**
 * ✅ PATCH 3: Render approval status banner
 * Shows visual lock indicators when election is pending approval or approved
 */
export function renderECApprovalStatus(org) {
  const banner = document.getElementById('ecApprovalBanner');
  if (!banner || !org) return;
  
  const approvalStatus = org.approval?.status;
  
  // Clear banner if no approval status or in draft/rejected (editable states)
  if (!approvalStatus || approvalStatus === 'draft') {
    banner.innerHTML = '';
    banner.style.display = 'none';
    return;
  }
  
  let html = '';
  
  if (approvalStatus === 'pending') {
    const submittedDate = org.approval.submittedAt?.toDate ? org.approval.submittedAt.toDate() : (org.approval.submittedAt?.seconds ? new Date(org.approval.submittedAt.seconds * 1000) : null);
    html = `
      <div class="status-banner pending" style="margin:15px 0;padding:15px 20px;border-radius:12px;background:rgba(255,193,7,0.1);border:2px solid rgba(255,193,7,0.3);display:flex;align-items:center;gap:15px;">
        <div style="font-size:32px;color:#ffc107">
          <i class="fas fa-hourglass-half"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:bold;color:#ffc107;margin-bottom:5px">
            🔒 Election Under Review
          </div>
          <div style="color:#eaf2ff;font-size:14px">
            Your election is being reviewed by a SuperAdmin. Editing is locked until a decision is made.
          </div>
          ${submittedDate ? `
            <div style="color:rgba(234,242,255,0.6);font-size:12px;margin-top:5px">
              Submitted: ${submittedDate.toLocaleString()}
            </div>
          ` : ''}
        </div>
        <button class="btn neon-btn-outline" onclick="showECTab('approval')" style="white-space:nowrap">
          <i class="fas fa-clipboard-check"></i> View Status
        </button>
      </div>
    `;
  } else if (approvalStatus === 'approved') {
    const approvedDate = org.approval.approvedAt?.toDate ? org.approval.approvedAt.toDate() : (org.approval.approvedAt?.seconds ? new Date(org.approval.approvedAt.seconds * 1000) : null);
    html = `
      <div class="status-banner approved" style="margin:15px 0;padding:15px 20px;border-radius:12px;background:rgba(0,255,170,0.1);border:2px solid rgba(0,255,170,0.3);display:flex;align-items:center;gap:15px;">
        <div style="font-size:32px;color:#00ffaa">
          <i class="fas fa-check-circle"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:bold;color:#00ffaa;margin-bottom:5px">
            ✅ Election Approved & Active
          </div>
          <div style="color:#eaf2ff;font-size:14px">
            Your election has been approved. Contact SuperAdmin to make further changes.
          </div>
          ${approvedDate ? `
            <div style="color:rgba(234,242,255,0.6);font-size:12px;margin-top:5px">
              Approved: ${approvedDate.toLocaleString()}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (approvalStatus === 'rejected') {
    html = `
      <div class="status-banner rejected" style="margin:15px 0;padding:15px 20px;border-radius:12px;background:rgba(255,68,68,0.1);border:2px solid rgba(255,68,68,0.3);display:flex;align-items:center;gap:15px;">
        <div style="font-size:32px;color:#ff4444">
          <i class="fas fa-times-circle"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:bold;color:#ff4444;margin-bottom:5px">
            📝 Returned for Correction
          </div>
          <div style="color:#eaf2ff;font-size:14px;margin-bottom:8px">
            Your election submission needs corrections. Please address the feedback and resubmit.
          </div>
          ${org.approval.rejectionReason ? `
            <div style="padding:10px;background:rgba(255,68,68,0.15);border-radius:8px;border-left:3px solid #ff4444;margin-top:8px">
              <div style="color:#ff9999;font-size:12px;font-weight:bold;margin-bottom:4px">Correction Required:</div>
              <div style="color:#eaf2ff;font-size:13px">${org.approval.rejectionReason}</div>
            </div>
          ` : ''}
        </div>
        <button class="btn neon-btn" onclick="showECTab('approval')" style="white-space:nowrap">
          <i class="fas fa-redo"></i> Resubmit
        </button>
      </div>
    `;
  }
  
  banner.innerHTML = html;
  banner.style.display = html ? 'block' : 'none';
}

/**
 * Show EC tab content with lazy loading
 */
export async function showECTab(tabId) {
  try {
    console.log("Showing EC tab:", tabId);
    
    // Clean up outcomes real-time listener when switching away
    if (window.activeTab === 'outcomes' && tabId !== 'outcomes') {
      if (typeof window.cleanupOutcomesListener === 'function') {
        window.cleanupOutcomesListener();
      }
    }
    
    // Store active tab globally
    window.activeTab = tabId;

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
    if (!window.currentOrgId) {
      tabContent.innerHTML = `
        <div class="empty-state">
          <div style="font-size:46px;color:#00eaff;margin-bottom:10px"><i class="fas fa-building"></i></div>
          <h3 style="color:#fff;margin:0 0 8px 0">Organization not selected</h3>
          <p class="subtext">Please log in as EC with a valid Organization ID.</p>
        </div>
      `;
      return;
    }

    if (!window.currentOrgData) {
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
    if (typeof window.applyECFreezeUI === 'function') {
      window.applyECFreezeUI();
    }

    // Load the selected tab content
    if (tabId === 'voters') {
      const { loadECVoters } = await import('./voters.js');
      await loadECVoters();
    } else if (tabId === 'positions') {
      const { loadECPositions } = await import('./positions.js');
      await loadECPositions();
    } else if (tabId === 'candidates') {
      const { loadECCandidates } = await import('./candidates.js');
      await loadECCandidates();
    } else if (tabId === 'outcomes') {
      if (typeof window.loadECOutcomes === 'function') {
        await window.loadECOutcomes();
      }
    } else if (tabId === 'settings') {
      const { loadECSettings } = await import('./settings.js');
      await loadECSettings();
    } else if (tabId === 'approval') {
      if (typeof window.loadECApproval === 'function') {
        await window.loadECApproval();
      }
    } else if (tabId === 'bulk-invite') {
      if (typeof window.showBulkTab === 'function') {
        window.showBulkTab();
      }
    } else if (tabId === 'invites') {
      if (typeof window.loadInvitesTracking === 'function') {
        await window.loadInvitesTracking();
      }
    }
  } catch (e) {
    console.error("Error in showECTab:", e);
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.showECTab = showECTab;
  
  // Listen for language changes and refresh current tab
  window.addEventListener('languageChanged', () => {
    const activeTab = document.querySelector('.tab-btn.active[data-ec-tab]');
    if (activeTab && window.currentOrgId) {
      const tabId = activeTab.dataset.ecTab;
      // Refresh the current tab to update translations
      showECTab(tabId);
    }
  });
}
