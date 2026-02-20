// Neon Voting Platform - Service Worker
// Simplified version - Only caches local assets, never external resources

const CACHE_VERSION = 'neon-voting-v1.2.1-20260220'; // Must match index.html APP_VERSION
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Only cache YOUR OWN static assets - NO external resources
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
  
  // Language files
  '/lang/eng.json',
  '/lang/spa.json',
  '/lang/fre.json',
  '/lang/por.json',
  '/lang/twi.json',
  
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
            // Delete ALL old caches that don't match current version
            if (cacheName.startsWith('neon-voting-') && cacheName !== STATIC_CACHE) {
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

// Fetch event - NEVER intercept external resources
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // CRITICAL: Never intercept external domains or Firebase
  // Let browser handle these directly to avoid CSP violations
  if (
    url.origin !== location.origin ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('googleapis') ||
    url.pathname.startsWith('/.netlify/functions/') ||
    url.pathname.startsWith('/js/') ||  // Don't cache JavaScript modules - always fetch fresh
    url.pathname.startsWith('/html/') ||  // Don't cache HTML components - always fetch fresh
    event.request.url.includes('.mjs') ||
    event.request.url.includes('twilio')
  ) {
    // Don't intercept - let browser fetch directly
    return;
  }
  
  // For local assets only: Cache-first with network fallback
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Not in cache - fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache successful responses for next time
            if (networkResponse && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch failed:', event.request.url, error);
            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            throw error;
          });
      })
  );
});

console.log('[Service Worker] Script loaded');
