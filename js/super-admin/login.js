/**
 * Super Admin Module - Login
 * Handles SuperAdmin authentication
 */

import { db } from '../config/firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, showScreen } from '../utils/ui-helpers.js';
import { updateSession } from '../utils/session.js';
import { showSuperTab } from './dashboard.js';

/**
 * SuperAdmin login handler
 */
export async function loginSuperAdmin() {
  const pass = document.getElementById("super-admin-pass").value.trim();
  if (!pass) { 
    showToast("Enter password", "error"); 
    return; 
  }
  
  // Check if Firebase is initialized
  if (!db) {
    showToast("Firebase not initialized. Please refresh the page.", "error");
    console.error("Firebase db is not initialized");
    return;
  }
  
  try {
    const ref = doc(db, "meta", "superAdmin");
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      showToast("SuperAdmin not initialized. Contact administrator.", "error");
      return;
    } else {
      const cfg = snap.data();
      if (cfg.password === pass) {
        updateSession({ role: 'superAdmin' });
        
        // Set global SuperAdmin object for permission checks
        window.currentSuperAdmin = {
          role: 'super_admin',
          permissions: ['*'],  // Full access
          userId: 'superadmin',
          loginTime: new Date().toISOString()
        };
        window.currentAdmin = window.currentSuperAdmin;  // Alias for admin-guard.js
        
        showScreen("superAdminPanel");
        // Auto-load dashboard tab on login
        setTimeout(() => showSuperTab('dashboard'), 100);
        document.getElementById("super-admin-pass").value = "";
        showToast("SuperAdmin logged in", "success");
      } else {
        showToast("Wrong password", "error");
      }
    }
  } catch(e) { 
    console.error(e); 
    showToast("Login error", "error"); 
  }
}

/**
 * Restore SuperAdmin session from localStorage
 * Called on app initialization to maintain login state across page refreshes
 * @returns {Promise<boolean>} True if session was restored, false otherwise
 */
export async function restoreSuperAdminSession() {
  try {
    const { getSession } = await import('../utils/session.js');
    const session = getSession();
    
    // Check if SuperAdmin session exists
    if (session && session.role === 'superAdmin') {
      console.log('Restoring SuperAdmin session');
      
      // Verify SuperAdmin credentials still exist
      const ref = doc(db, "meta", "superAdmin");
      const snap = await getDoc(ref);
      
      if (!snap.exists()) {
        console.warn('SuperAdmin config no longer exists, clearing session');
        const { clearSession } = await import('../utils/session.js');
        clearSession();
        return false;
      }
      
      // Set global SuperAdmin object for permission checks
      window.currentSuperAdmin = {
        role: 'super_admin',
        permissions: ['*'],  // Full access
        userId: 'superadmin',
        loginTime: new Date().toISOString()
      };
      window.currentAdmin = window.currentSuperAdmin;  // Alias for admin-guard.js
      
      // Restore SuperAdmin panel
      showScreen("superAdminPanel");
      
      // Auto-load dashboard tab
      setTimeout(() => showSuperTab('dashboard'), 100);
      
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error restoring SuperAdmin session:', e);
    return false;
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loginSuperAdmin = loginSuperAdmin;
  window.restoreSuperAdminSession = restoreSuperAdminSession;
}
