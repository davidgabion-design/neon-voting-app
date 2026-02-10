// js/utils/ui-helpers.js - UI Helper Functions

/**
 * Show toast notification
 * @param {string} msg - Message to display
 * @param {string} type - Toast type: 'info', 'success', 'error', 'warning'
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(msg, type = "info", duration = 3000) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);padding:12px 18px;border-radius:12px;z-index:1001;display:none;backdrop-filter:blur(10px);font-size:13px;max-width:400px;';
    document.body.appendChild(t);
  }
  
  t.textContent = msg;
  
  // Subtle styling with left border accent
  if (type === "error") {
    t.style.background = "rgba(20,10,10,0.95)";
    t.style.border = "1px solid rgba(255,68,68,0.3)";
    t.style.borderLeft = "4px solid #ff4444";
    t.style.color = "#ffb3b3";
  } else if (type === "success") {
    t.style.background = "rgba(0,20,15,0.95)";
    t.style.border = "1px solid rgba(0,255,170,0.2)";
    t.style.borderLeft = "4px solid #00ffaa";
    t.style.color = "#00ffaa";
  } else if (type === "warning") {
    t.style.background = "rgba(25,20,0,0.95)";
    t.style.border = "1px solid rgba(255,193,7,0.2)";
    t.style.borderLeft = "4px solid #ffc107";
    t.style.color = "#ffc832";
  } else {
    t.style.background = "rgba(0,15,25,0.95)";
    t.style.border = "1px solid rgba(0,234,255,0.2)";
    t.style.borderLeft = "4px solid #00eaff";
    t.style.color = "#00eaff";
  }
  
  t.classList.add("show");
  
  setTimeout(() => {
    t.classList.remove("show");
  }, duration);
}

/**
 * Show specific screen and hide others
 * @param {string} screenId - ID of screen element to show
 */
export function showScreen(screenId) {
  // Clear any active intervals
  if (window.countdownInterval) {
    clearInterval(window.countdownInterval);
    window.countdownInterval = null;
  }
  if (window.voterCountdownInterval) {
    clearInterval(window.voterCountdownInterval);
    window.voterCountdownInterval = null;
  }
  
  if (window.refreshIntervals) {
    Object.values(window.refreshIntervals).forEach(interval => {
      clearInterval(interval);
    });
    window.refreshIntervals = {};
  }
  
  // Stop alert scheduler when switching screens
  if (screenId !== 'ecPanel') {
    if (window.alertSchedulerInterval) {
      clearInterval(window.alertSchedulerInterval);
      window.alertSchedulerInterval = null;
    }
    // Clean up outcomes real-time listener when leaving EC panel
    if (typeof window.cleanupOutcomesListener === 'function') {
      window.cleanupOutcomesListener();
    }
  }
  
  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  
  // Show target screen
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Screen-specific initialization
    if (screenId === 'votingScreen' && window.currentOrgData) {
      if (typeof window.startVoterCountdown === 'function') {
        window.startVoterCountdown();
      }
    } else if (screenId === 'voterLoginScreen') {
      if (typeof window.updateVoterLoginScreen === 'function') {
        window.updateVoterLoginScreen();
      }
    } else if (screenId.includes('guidance') || screenId.includes('Guidance')) {
      // Initialize language support for guidance screens
      if (typeof window.setupLanguageSelector === 'function') {
        window.setupLanguageSelector();
      }
    }
  }
}

/**
 * Create modal overlay with custom content
 * @param {string} title - Modal title
 * @param {string} content - Modal body content (HTML)
 * @param {string} buttons - Modal footer buttons (HTML)
 * @returns {HTMLElement} Modal overlay element
 */
export function createModal(title, content, buttons = null) {
  // Remove any existing modals
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.3s ease;
  `;
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    background: linear-gradient(135deg, #0a1929 0%, #08102a 100%);
    border-radius: 16px;
    border: 1px solid rgba(0, 255, 255, 0.1);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(157, 0, 255, 0.1);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.4s ease;
  `;
  
  let modalHTML = `
    <div style="padding: 25px; border-bottom: 1px solid rgba(0, 255, 255, 0.1);">
      <h3 style="margin: 0; color: #00eaff; font-size: 20px; display: flex; align-items: center; gap: 10px;">
        ${title}
      </h3>
    </div>
    <div style="padding: 25px;">
      ${content}
    </div>
  `;
  
  if (buttons) {
    modalHTML += `
      <div style="padding: 20px 25px 25px; border-top: 1px solid rgba(0, 255, 255, 0.1); display: flex; gap: 10px; justify-content: flex-end;">
        ${buttons}
      </div>
    `;
  }
  
  modal.innerHTML = modalHTML;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  return overlay;
}

/**
 * Show loading overlay
 * @param {string} message - Loading message
 */
export function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div style="text-align: center;">
        <div class="spinner"></div>
        <div style="color: var(--text); margin-top: 16px;">${message}</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.classList.add('active');
}

/**
 * Hide loading overlay
 */
export function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

/**
 * Show quick loading state in specific container
 * @param {string} containerId - Container element ID
 * @param {string} message - Loading message
 */
export function showQuickLoading(containerId, message = 'Loading...') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div class="spinner"></div>
      <div style="color: var(--muted); margin-top: 16px;">${message}</div>
    </div>
  `;
}

/**
 * Render error message in container
 * @param {string} containerId - Container element ID
 * @param {string} message - Error message
 * @param {Function} retryFn - Optional retry function
 */
export function renderError(containerId, message, retryFn = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const retryButton = retryFn ? `
    <button class="btn neon-btn-outline" style="margin-top: 16px;" onclick="(${retryFn.toString()})()">
      <i class="fas fa-redo"></i> Retry
    </button>
  ` : '';
  
  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger); margin-bottom: 16px;"></i>
      <div style="color: var(--danger); font-weight: 600; margin-bottom: 8px;">Error</div>
      <div style="color: var(--muted); font-size: 14px;">${message}</div>
      ${retryButton}
    </div>
  `;
}

/**
 * Get URL parameter value
 * @param {string} key - Parameter name
 * @returns {string|null} Parameter value or null
 */
export function getUrlParam(key) {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  } catch {
    return null;
  }
}

/**
 * Get default logo SVG data URL
 * @param {string} orgName - Organization name for initials
 * @returns {string} Data URL for SVG logo
 */
export function getDefaultLogo(orgName = '') {
  const initials = orgName ? orgName.substring(0, 2).toUpperCase() : 'NV';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#9D00FF"/>
          <stop offset="100%" style="stop-color:#00C3FF"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="#08102a"/>
      <circle cx="100" cy="80" r="40" fill="url(#grad)"/>
      <text x="100" y="85" font-size="24" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">${initials}</text>
      <text x="100" y="150" font-size="16" text-anchor="middle" fill="#9beaff" font-family="Arial">Voting</text>
    </svg>
  `);
}

/**
 * Get default avatar SVG data URL
 * @param {string} name - Person name for initial
 * @returns {string} Data URL for SVG avatar
 */
export function getDefaultAvatar(name) {
  const initial = name ? name.charAt(0).toUpperCase() : 'U';
  return `data:image/svg+xml;utf8,
    <svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>
      <rect width='100' height='100' fill='%2300ffaa'/>
      <text x='50%' y='55%' font-size='42' text-anchor='middle'
            fill='white' font-family='Arial' dy='.1em'>${initial}</text>
    </svg>`;
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.showScreen = showScreen;
  window.createModal = createModal;
  window.showLoadingOverlay = showLoadingOverlay;
  window.hideLoadingOverlay = hideLoadingOverlay;
  window.showQuickLoading = showQuickLoading;
  window.renderError = renderError;
  window.getUrlParam = getUrlParam;
  window.getDefaultLogo = getDefaultLogo;
  window.getDefaultAvatar = getDefaultAvatar;
}

export default {
  showToast,
  showScreen,
  createModal,
  showLoadingOverlay,
  hideLoadingOverlay,
  showQuickLoading,
  renderError,
  getUrlParam,
  getDefaultLogo,
  getDefaultAvatar
};
