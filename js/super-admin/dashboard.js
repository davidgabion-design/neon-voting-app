/**
 * Super Admin Module - Dashboard
 * Handles SuperAdmin panel tab switching and navigation
 */

import { loadSuperOrganizationsEnhanced, loadSuperDeleteEnhanced } from './organizations.js';
import { loadSuperApprovals } from './approvals.js';
import { loadAdministrators } from './administrators.js';
import { loadSuperSettings } from './settings.js';
import { initializeDashboard } from './stats.js';

/**
 * Show Super Admin tab
 * @param {string} tabId - Tab ID to show (orgs, approvals, delete, settings, dashboard)
 */
export function showSuperTab(tabId) {
  console.log("Showing super tab:", tabId);

  // Highlight active button
  document.querySelectorAll('[data-super-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.superTab === tabId);
  });

  // Hard switch Super Admin content panels
  document.querySelectorAll('[id^="superContent-"]').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });

  const tabContent = document.getElementById(`superContent-${tabId}`);
  if (!tabContent) {
    console.warn("Super tab content missing:", `superContent-${tabId}`);
    return;
  }

  tabContent.classList.add('active');
  tabContent.style.display = 'block';

  // Lazy-load content only when needed (prevents repeated re-renders)
  const shouldLoad = tabContent.innerHTML.includes('Loading') ||
                    tabContent.innerHTML.trim() === '' ||
                    tabContent.dataset.loaded !== "true";

  if (shouldLoad) {
    try {
      if (tabId === 'orgs') {
        loadSuperOrganizationsEnhanced?.();
      } else if (tabId === 'settings') {
        loadSuperSettings?.();
      } else if (tabId === 'danger' || tabId === 'delete') {
        loadSuperDeleteEnhanced?.();
      } else if (tabId === 'approvals') {
        loadSuperApprovals?.();
      } else if (tabId === 'admins') {
        loadAdministrators?.();
      } else if (tabId === 'dashboard') {
        // ✅ PATCH: always refresh dashboard for live accuracy
        initializeDashboard();
      }
      // ✅ Mark loaded but allow approvals/dashboard to reload
      if (tabId !== 'approvals' && tabId !== 'dashboard') {
        tabContent.dataset.loaded = "true";
      }
    } catch (e) {
      console.error("Error loading super tab content:", tabId, e);
    }
  }
}

/**
 * Show all organizations (helper for navigation)
 */
export function showAllOrganizations() {
  try {
    if (typeof showSuperTab === 'function') {
      showSuperTab('orgs');
    } else if (typeof window.showScreen === 'function') {
      window.showScreen('superAdminScreen');
    }
  } catch(e) {
    console.error('Error showing organizations:', e);
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.showSuperTab = showSuperTab;
  window.showAllOrganizations = showAllOrganizations;
}
