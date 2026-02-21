/**
 * Offline Utility Module
 * Provides offline detection, connection monitoring, and offline-aware feature guards
 */

import { showNotification } from './ui-helpers.js';

/**
 * Check if the browser is currently online
 * @returns {boolean} True if online, false if offline
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Check if the browser is currently offline
 * @returns {boolean} True if offline, false if online
 */
export function isOffline() {
  return !navigator.onLine;
}

/**
 * Guard function - checks if user is online before allowing an action
 * Shows notification if offline
 * @param {string} actionName - Name of the action being attempted (for user message)
 * @returns {boolean} True if online (action can proceed), false if offline
 */
export function requiresOnline(actionName = 'perform this action') {
  if (isOffline()) {
    showNotification(
      `⚠️ You need an internet connection to ${actionName}`,
      'warning'
    );
    return false;
  }
  return true;
}

/**
 * Initialize connection status monitoring
 * Sets up event listeners for online/offline events
 */
export function initializeConnectionMonitoring() {
  // Update connection status indicator on load
  updateConnectionStatus();
  
  // Listen for online event
  window.addEventListener('online', () => {
    console.log('✓ Connection restored');
    updateConnectionStatus();
    showNotification('✓ Back online - All features available', 'success');
    
    // Trigger custom event for other parts of the app
    window.dispatchEvent(new CustomEvent('connection-restored'));
  });
  
  // Listen for offline event
  window.addEventListener('offline', () => {
    console.log('⚠️ Connection lost');
    updateConnectionStatus();
    showNotification('⚠️ You are offline - Limited features available', 'warning');
    
    // Trigger custom event for other parts of the app
    window.dispatchEvent(new CustomEvent('connection-lost'));
  });
  
  // Periodic connection check (every 30 seconds)
  setInterval(() => {
    updateConnectionStatus();
  }, 30000);
  
  console.log('✓ Connection monitoring initialized');
}

/**
 * Update the connection status indicator in the UI
 */
export function updateConnectionStatus() {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;
  
  if (isOnline()) {
    statusEl.innerHTML = '<i class="fas fa-wifi"></i> Online';
    statusEl.className = 'connection-status status-online';
    statusEl.title = 'Connected to the internet';
  } else {
    statusEl.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
    statusEl.className = 'connection-status status-offline';
    statusEl.title = 'No internet connection - Limited features available';
  }
}

/**
 * Check if Service Worker is supported and registered
 * DEPRECATED: Service Worker removed for voting stability
 * @returns {Promise<boolean>} Always returns false
 */
export async function isServiceWorkerActive() {
  // PATCH START — Service Worker permanently disabled
  // Always return false since SW has been removed from the system
  return false;
  // PATCH END
  
  /* ORIGINAL CODE DISABLED
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration && registration.active !== null;
  } catch (error) {
    console.error('Error checking Service Worker:', error);
    return false;
  }
  */
}

/**
 * Get the cache status (how many items are cached)
 * @returns {Promise<object>} Cache statistics
 */
export async function getCacheStatus() {
  if (!('caches' in window)) {
    return { supported: false, count: 0, size: 0 };
  }
  
  try {
    const cacheNames = await caches.keys();
    let totalCount = 0;
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      totalCount += keys.length;
    }
    
    return {
      supported: true,
      cacheCount: cacheNames.length,
      itemCount: totalCount
    };
  } catch (error) {
    console.error('Error getting cache status:', error);
    return { supported: true, count: 0, error: error.message };
  }
}

/**
 * Clear all caches (for troubleshooting)
 * @returns {Promise<void>}
 */
export async function clearAllCaches() {
  if (!('caches' in window)) {
    console.warn('Cache API not supported');
    return;
  }
  
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('✓ All caches cleared');
    showNotification('✓ Cache cleared successfully', 'success');
  } catch (error) {
    console.error('Error clearing caches:', error);
    showNotification('✗ Failed to clear cache', 'error');
  }
}

/**
 * Show offline mode banner
 */
export function showOfflineBanner() {
  const banner = document.createElement('div');
  banner.id = 'offlineBanner';
  banner.className = 'offline-banner';
  banner.innerHTML = `
    <i class="fas fa-wifi-slash"></i>
    <span>You are currently offline. Some features may be limited.</span>
  `;
  
  // Insert at top of body
  document.body.insertBefore(banner, document.body.firstChild);
}

/**
 * Hide offline mode banner
 */
export function hideOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (banner) {
    banner.remove();
  }
}

/**
 * Wrapper for fetch with offline handling
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function offlineAwareFetch(url, options = {}) {
  if (isOffline()) {
    throw new Error('Cannot make network request while offline');
  }
  
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    if (isOffline()) {
      throw new Error('Connection lost during request');
    }
    throw error;
  }
}

// Auto-initialize connection monitoring when module loads
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeConnectionMonitoring, 1000);
    });
  } else {
    setTimeout(initializeConnectionMonitoring, 1000);
  }
}
