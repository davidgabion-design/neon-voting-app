
    import { loadHTMLComponents } from './js/utils/html-loader.js';
    
    // Load all HTML components first (fast), then initialize Firebase
    async function initializeApp() {
      try {
        // Step 1: Load HTML components (fast)
        document.getElementById('loadingText').textContent = 'Loading interface...';
        
        await loadHTMLComponents([
          // Main screens
          { path: 'html/gateway.html', containerId: 'app-screens' },
          { path: 'html/super-admin/login.html', containerId: 'app-screens' },
          { path: 'html/super-admin/panel.html', containerId: 'app-screens' },
          { path: 'html/admin/login.html', containerId: 'app-screens' },
          { path: 'html/admin/panel.html', containerId: 'app-screens' },
          { path: 'html/ec/login.html', containerId: 'app-screens' },
          { path: 'html/ec/panel.html', containerId: 'app-screens' },
          { path: 'html/voter/login.html', containerId: 'app-screens' },
          { path: 'html/voter/voting.html', containerId: 'app-screens' },
          { path: 'html/voter/already-voted.html', containerId: 'app-screens' },
          { path: 'html/public/results.html', containerId: 'app-screens' },
          { path: 'html/guest/screen.html', containerId: 'app-screens' },
          { path: 'html/shared/guidance.html', containerId: 'app-screens' },
          { path: 'html/shared/guidance-ec.html', containerId: 'app-screens' },
          { path: 'html/shared/guidance-voter.html', containerId: 'app-screens' },
          { path: 'html/modals/invite-history.html', containerId: 'app-modals' },
          { path: 'html/shared/toasts.html', containerId: 'app-toasts' }
        ]);
        
        console.log('✅ Components loaded');
        
        // Step 2: Initialize Firebase and app modules (slower - CDN imports)
        document.getElementById('loadingText').textContent = 'Connecting to Firebase...';
        
        // Dynamic import allows us to control when Firebase loads
        await import('./js/app.js');
        
        console.log('✅ App initialized');
        
        // Step 3: Setup gateway button handlers
        document.getElementById('btn-superadmin')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('superAdminLoginScreen');
        });
        document.getElementById('btn-admin')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('adminLoginScreen');
        });
        document.getElementById('btn-ec')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('ecLoginScreen');
        });
        document.getElementById('btn-voter')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('voterLoginScreen');
        });
        document.getElementById('btn-public')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('publicScreen');
        });
        document.getElementById('btn-guest')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('guestScreen');
        });
        
        // Setup back to gateway buttons
        document.getElementById('super-back')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('gatewayScreen');
        });
        document.getElementById('ec-back')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('gatewayScreen');
        });
        document.getElementById('ec-login-back')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('gatewayScreen');
        });
        document.getElementById('voter-back')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('gatewayScreen');
        });
        document.getElementById('public-back')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('gatewayScreen');
        });
        document.getElementById('guidance-back')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('gatewayScreen');
        });
        document.getElementById('guidance-ec-back')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('ecLoginScreen');
        });
        document.getElementById('guidance-voter-back')?.addEventListener('click', () => {
          if (typeof window.showScreen === 'function') window.showScreen('voterLoginScreen');
        });

        // Setup Guidance PDF download buttons
        document.getElementById('downloadGuidancePDF-general')?.addEventListener('click', () => {
          if (typeof window.downloadGuidancePDF === 'function') {
            window.downloadGuidancePDF('super-admin');
          }
        });
        document.getElementById('downloadGuidancePDF-ec')?.addEventListener('click', () => {
          if (typeof window.downloadGuidancePDF === 'function') {
            window.downloadGuidancePDF('ec');
          }
        });
        document.getElementById('downloadGuidancePDF-voter')?.addEventListener('click', () => {
          if (typeof window.downloadGuidancePDF === 'function') {
            window.downloadGuidancePDF('voter');
          }
        });

        // Setup Gateway language selector
        document.getElementById('gatewayLangSelect')?.addEventListener('change', (e) => {
          if (typeof window.loadLanguage === 'function') {
            window.loadLanguage(e.target.value);
          }
        });

        // Setup Guidance language selector (for all guidance screens) using event delegation
        document.addEventListener('change', (e) => {
          // Check if any language selector changed
          const languageSelectors = ['langSelect', 'ecLangSelect', 'superAdminLangSelect', 
                                     'voterLangSelect', 'ecLoginLangSelect', 'voterLoginLangSelect'];
          if (e.target && languageSelectors.includes(e.target.id)) {
            if (typeof window.loadLanguage === 'function') {
              window.loadLanguage(e.target.value);
            }
          }
        });

        // Initialize language on startup
        if (typeof window.initLanguage === 'function') {
          window.initLanguage();
        }
        
        // Setup logout buttons
        document.querySelectorAll('.logout-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            // Clear localStorage session
            const SESSION_KEY = 'neon_voting_session_v8';
            localStorage.removeItem(SESSION_KEY);
            
            // Clear window state
            window.currentOrgId = null;
            window.currentOrgData = null;
            if (window.currentOrgUnsub) {
              window.currentOrgUnsub();
              window.currentOrgUnsub = null;
            }
            
            // Stop alert scheduler
            if (typeof window.stopAlertScheduler === 'function') {
              window.stopAlertScheduler();
            }
            
            // Show gateway and success message
            if (typeof window.showScreen === 'function') {
              window.showScreen('gatewayScreen');
            }
            if (typeof window.showToast === 'function') {
              window.showToast('Logged out successfully', 'success');
            }
          });
        });
        
        // Setup Super Admin tab buttons
        document.querySelectorAll('[data-super-tab]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const tabId = e.currentTarget.dataset.superTab;
            if (typeof window.showSuperTab === 'function') {
              window.showSuperTab(tabId);
            }
          });
        });
        
        // Setup Admin tab buttons
        document.querySelectorAll('[data-admin-tab]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const tabId = e.currentTarget.dataset.adminTab;
            if (typeof window.showAdminTab === 'function') {
              window.showAdminTab(tabId);
            }
          });
        });
        
        // Setup EC tab buttons
        document.querySelectorAll('[data-ec-tab]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const tabId = e.currentTarget.dataset.ecTab;
            if (typeof window.showECTab === 'function') {
              window.showECTab(tabId);
            }
          });
        });
        
        // Setup login buttons
        document.getElementById('ec-login-btn')?.addEventListener('click', () => {
          if (typeof window.loginEC === 'function') window.loginEC();
        });
        
        document.getElementById('admin-login-btn')?.addEventListener('click', () => {
          if (typeof window.loginAdmin === 'function') window.loginAdmin();
        });
        
        document.getElementById('voterLoginBtn')?.addEventListener('click', () => {
          if (typeof window.voterLogin === 'function') window.voterLogin();
        });
        
        // Allow Enter key on all login forms
        document.getElementById('ec-pass')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && typeof window.loginEC === 'function') window.loginEC();
        });
        
        document.getElementById('ec-org-id')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') document.getElementById('ec-pass')?.focus();
        });
        
        document.getElementById('admin-password')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && typeof window.loginAdmin === 'function') window.loginAdmin();
        });
        
        document.getElementById('admin-email')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') document.getElementById('admin-password')?.focus();
        });
        
        document.getElementById('super-admin-pass')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && typeof window.loginSuperAdmin === 'function') window.loginSuperAdmin();
        });
        
        document.getElementById('voterCredentialInput')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && typeof window.voterLogin === 'function') window.voterLogin();
        });
        
        document.getElementById('voterOrgIdInput')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') document.getElementById('voterCredentialInput')?.focus();
        });
        
        // Step 4: Check for invite link parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const role = urlParams.get('role');
        const org = urlParams.get('org');

        if (role && org) {
          console.log(`🔗 Invite link detected - Role: ${role}, Org: ${org}`);
          // Store org in session for login page
          sessionStorage.setItem('inviteOrgId', org);
          
          document.getElementById('loadingOverlay').classList.remove('active');
          
          // Redirect to appropriate login screen
          if (role === 'ec') {
            console.log('🔀 Redirecting to EC login...');
            if (typeof window.showScreen === 'function') {
              window.showScreen('ecLoginScreen');
            }
            return;
          } else if (role === 'voter') {
            console.log('🔀 Redirecting to Voter login...');
            if (typeof window.showScreen === 'function') {
              window.showScreen('voterLoginScreen');
            }
            return;
          }
        }
        
        // Step 5: Restore session (try EC, SuperAdmin, Admin, then Voter) before showing gateway
        setTimeout(async () => {
          document.getElementById('loadingOverlay').classList.remove('active');
          
          let sessionRestored = false;
          
          // Try to restore EC session first
          if (typeof window.restoreECSession === 'function') {
            try {
              sessionRestored = await window.restoreECSession();
              if (sessionRestored) {
                console.log('EC session restored');
                return;
              }
            } catch (e) {
              console.warn('EC session restoration failed:', e);
            }
          }
          
          // Try to restore SuperAdmin session
          if (!sessionRestored && typeof window.restoreSuperAdminSession === 'function') {
            try {
              sessionRestored = await window.restoreSuperAdminSession();
              if (sessionRestored) {
                console.log('SuperAdmin session restored');
                return;
              }
            } catch (e) {
              console.warn('SuperAdmin session restoration failed:', e);
            }
          }
          
          // Try to restore Admin session
          if (!sessionRestored && typeof window.restoreAdminSession === 'function') {
            try {
              sessionRestored = await window.restoreAdminSession();
              if (sessionRestored) {
                console.log('Admin session restored');
                return;
              }
            } catch (e) {
              console.warn('Admin session restoration failed:', e);
            }
          }
          
          // Try to restore voter session
          if (!sessionRestored && typeof window.restoreVoterSession === 'function') {
            try {
              sessionRestored = await window.restoreVoterSession();
              if (sessionRestored) {
                console.log('Voter session restored');
                return;
              }
            } catch (e) {
              console.warn('Voter session restoration failed:', e);
            }
          }
          
          // If no session restored, show gateway
          if (!sessionRestored && typeof window.showScreen === 'function') {
            window.showScreen('gatewayScreen');
          }
        }, 300);
        
      } catch (error) {
        console.error('❌ Initialization failed:', error);
        document.getElementById('loadingText').innerHTML = 
          '<span style="color: #ff4444;">Error: ' + error.message + '</span><br>' +
          '<button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;background:#9d00ff;color:white;border:none;border-radius:4px;cursor:pointer;">Reload</button>';
      }
    }
    
    // Start initialization
    initializeApp();
  
