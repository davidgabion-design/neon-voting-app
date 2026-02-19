// Neon Voting Platform - Service Worker
// Provides offline functionality and caching for improved performance

const CACHE_VERSION = 'neon-voting-v2-20260219';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/neon-logo.png',
  
  // CSS files
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/dashboard.css',
  '/css/voter.css',
  '/css/responsive.css',
  
  // Core JavaScript
  '/js/app.js',
  
  // Config modules
  '/js/config/firebase.js',
  '/js/config/constants.js',
  '/js/config/admin-roles.js',
  '/js/config/credential-types.js',
  
  // Utility modules
  '/js/utils/i18n.js',
  '/js/utils/ui-helpers.js',
  '/js/utils/offline.js',
  
  // Language files
  '/lang/eng.json',
  '/lang/spa.json',
  '/lang/fre.json',
  '/lang/por.json',
  '/lang/twi.json',
  
  // HTML components - Gateway and shared
  '/html/gateway.html',
  '/html/shared/guidance.html',
  '/html/shared/guidance-voter.html',
  '/html/shared/guidance-ec.html',
  '/html/shared/toasts.html',
  
  // Libraries
  '/libs/fontawesome/all.min.css',
  '/libs/xlsx.full.min.js',
  '/libs/jspdf.umd.min.js',
  '/libs/jspdf.plugin.autotable.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Static assets cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[Service Worker] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches that don't match current version
            if (cacheName.startsWith('neon-voting-') && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activated successfully');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for:
  // 1. Firebase API calls
  // 2. Netlify functions
  // 3. External APIs (Twilio, etc.)
  // 4. Chrome extensions
  // 5. Firebase CDN (gstatic.com) - includes Firebase SDK modules
  // 6. ES modules (JavaScript imports)
  if (
    url.origin.includes('firebaseio.com') ||
    url.origin.includes('googleapis.com') ||
    url.origin.includes('firebase.com') ||
    url.origin.includes('gstatic.com') ||
    url.pathname.startsWith('/.netlify/functions/') ||
    url.origin.includes('twilio.com') ||
    url.protocol === 'chrome-extension:' ||
    request.destination === 'script' && url.pathname.includes('firebase') ||
    url.pathname.endsWith('.mjs') // ES module files
  ) {
    // Network only for API calls, CDN, and modules - never cache
    event.respondWith(
      fetch(request, { mode: 'cors', credentials: 'omit' })
        .catch((error) => {
          console.error('[Service Worker] Failed to fetch:', url.href, error);
          throw error;
        })
    );
    return;
  }
  
  // Cache strategy for static assets
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          // Update cache in background for static assets
          if (STATIC_ASSETS.includes(url.pathname)) {
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  caches.open(STATIC_CACHE).then((cache) => {
                    cache.put(request, networkResponse);
                  });
                }
              })
              .catch(() => {
                // Network failed, but we have cache - no action needed
              });
          }
          
          return cachedResponse;
        }
        
        // No cache - fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse.ok && request.method === 'GET') {
              // Determine cache type based on URL
              const cacheName = STATIC_ASSETS.includes(url.pathname) 
                ? STATIC_CACHE 
                : DYNAMIC_CACHE;
              
              // Clone response before caching
              const responseToCache = networkResponse.clone();
              
              caches.open(cacheName).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            
            return networkResponse;
          })
          .catch((error) => {
            console.log('[Service Worker] Fetch failed for:', request.url);
            
            // Offline fallback for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Return offline response for other requests
            return new Response(
              JSON.stringify({
                error: 'offline',
                message: 'You are currently offline. Please check your internet connection.'
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'application/json'
                })
              }
            );
          });
      })
  );
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('[Service Worker] Script loaded');
