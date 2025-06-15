// sw.js - Service Worker for Dicoding Story PWA
const CACHE_NAME = 'dicoding-story-v1.2.0';
const CACHE_PREFIX = 'dicoding-story';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles/styles.css',
  './styles/pwa-styles.css',
  './utils/pwa-styles.css',
  './scripts/app.js',
  './scripts/utils/IndexedDBManager.js',
  './scripts/utils/storyStorage.js',
  './manifest.json',
  // Icons
  './ios/72.png',
  './ios/144.png',
  './ios/180.png',
  './android/android-launchericon-192-192.png',
  './android/android-launchericon-512-512.png',
  // External libraries (will be cached when fetched)
  'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Caching essential assets');
        
        // Cache assets one by one to handle failures gracefully
        const cachePromises = ASSETS_TO_CACHE.map(async (url) => {
          try {
            await cache.add(url);
            console.log(`✅ Cached: ${url}`);
          } catch (error) {
            console.warn(`⚠️ Failed to cache: ${url}`, error);
          }
        });
        
        return Promise.allSettled(cachePromises);
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete');
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        const deletePromises = cacheNames
          .filter(cacheName => {
            // Delete old versions of our cache
            return cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME;
          })
          .map(cacheName => {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('✅ Service Worker: Activation complete');
        // Take control of all pages immediately
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Activation failed', error);
      })
  );
});

// Fetch event - handle network requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (isAPIRequest(url)) {
    // API requests: Network First with IndexedDB fallback
    event.respondWith(handleAPIRequest(request));
  } else if (isStaticAsset(url)) {
    // Static assets: Cache First
    event.respondWith(handleStaticAsset(request));
  } else if (isNavigationRequest(request)) {
    // Navigation requests: Network First with cache fallback
    event.respondWith(handleNavigation(request));
  } else {
    // Default: Network First
    event.respondWith(handleDefault(request));
  }
});

// Check if request is to API
function isAPIRequest(url) {
  return url.hostname === 'story-api.dicoding.dev' || 
         url.pathname.includes('/api/') ||
         url.pathname.includes('/v1/');
}

// Check if request is for static assets
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
         url.hostname === 'unpkg.com' ||
         url.hostname === 'fonts.googleapis.com' ||
         url.hostname === 'fonts.gstatic.com';
}

// Check if request is for navigation
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

// Handle API requests - Network First with graceful fallback
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  console.log(`🌐 API Request: ${url.pathname}`);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses for short time
      const cache = await caches.open(CACHE_NAME);
      const responseClone = networkResponse.clone();
      
      // Only cache GET requests for stories
      if (request.method === 'GET' && url.pathname.includes('stories')) {
        cache.put(request, responseClone);
      }
      
      return networkResponse;
    } else {
      throw new Error(`API returned ${networkResponse.status}`);
    }
  } catch (error) {
    console.warn(`⚠️ API request failed, trying cache: ${error.message}`);
    
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📱 Serving from cache');
      return cachedResponse;
    }
    
    // If all fails, return a meaningful error response
    if (url.pathname.includes('stories')) {
      return new Response(
        JSON.stringify({
          error: true,
          message: 'No network connection and no cached data available'
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
}

// Handle static assets - Cache First
async function handleStaticAsset(request) {
  const url = new URL(request.url);
  console.log(`📦 Static Asset: ${url.pathname}`);
  
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, fetch and cache
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error(`❌ Static asset failed: ${error.message}`);
    
    // For critical CSS/JS files, return from cache if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Handle navigation requests - Network First with cache fallback
async function handleNavigation(request) {
  console.log('🧭 Navigation request');
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the response
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    } else {
      throw new Error(`Navigation returned ${networkResponse.status}`);
    }
  } catch (error) {
    console.warn(`⚠️ Navigation failed, serving from cache: ${error.message}`);
    
    // Try to serve the main page from cache
    const cachedResponse = await caches.match('./') || await caches.match('./index.html');
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Last resort: return a simple offline page
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dicoding Story - Offline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 2rem;
            background: #f5f5f5;
          }
          .offline-container {
            max-width: 400px;
            margin: 2rem auto;
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .offline-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .retry-btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <div class="offline-icon">📱</div>
          <h1>Dicoding Story</h1>
          <h2>You're Offline</h2>
          <p>Please check your internet connection and try again.</p>
          <button class="retry-btn" onclick="window.location.reload()">
            Try Again
          </button>
        </div>
      </body>
      </html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Handle default requests - Network First
async function handleDefault(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-stories') {
    event.waitUntil(syncStories());
  }
});

// Sync stories when back online
async function syncStories() {
  try {
    console.log('🔄 Syncing stories...');
    
    // Try to fetch latest stories
    const response = await fetch('https://story-api.dicoding.dev/v1/stories');
    
    if (response.ok) {
      const data = await response.json();
      
      // Cache the updated stories
      const cache = await caches.open(CACHE_NAME);
      cache.put('https://story-api.dicoding.dev/v1/stories', response.clone());
      
      // Notify clients about the sync
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          data: data
        });
      });
      
      console.log('✅ Stories synced successfully');
    }
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  console.log('📨 Message received:', type);
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'REFRESH_COMPLETE':
      // Handle refresh completion
      console.log('✅ Refresh completed by client');
      break;
      
    case 'CACHE_STORY':
      // Cache specific story
      if (data && data.url) {
        caches.open(CACHE_NAME).then(cache => {
          cache.add(data.url);
        });
      }
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked');
  
  event.notification.close();
  
  // Handle notification click - open the app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url === self.registration.scope && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise, open new window
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// Periodic sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('🕐 Periodic sync triggered:', event.tag);
  
  if (event.tag === 'periodic-sync-stories') {
    event.waitUntil(syncStories());
  }
});

// Error handler
self.addEventListener('error', (event) => {
  console.error('💥 Service Worker error:', event.error);
});

// Unhandled rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Service Worker unhandled rejection:', event.reason);
  event.preventDefault();
});

// Cache management utilities
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
  );
  
  await Promise.all(oldCaches.map(name => caches.delete(name)));
  console.log(`🧹 Cleaned up ${oldCaches.length} old caches`);
}

// Get cache size
async function getCacheSize() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  
  let totalSize = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const arrayBuffer = await response.arrayBuffer();
      totalSize += arrayBuffer.byteLength;
    }
  }
  
  return {
    count: requests.length,
    size: totalSize,
    sizeFormatted: formatBytes(totalSize)
  };
}

// Format bytes utility
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Debug info for development
async function getDebugInfo() {
  const cacheInfo = await getCacheSize();
  
  return {
    version: CACHE_NAME,
    cache: cacheInfo,
    clients: await self.clients.matchAll(),
    registration: self.registration,
    timestamp: new Date().toISOString()
  };
}

// Make debug functions available
self.cleanupOldCaches = cleanupOldCaches;
self.getCacheSize = getCacheSize;
self.getDebugInfo = getDebugInfo;

console.log(`🚀 Service Worker: ${CACHE_NAME} loaded and ready!`);