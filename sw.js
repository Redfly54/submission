// sw.js - Simple Service Worker without syntax errors

const CACHE_NAME = 'story-app-v1';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  // Cache essential icons only
  '/android/android-launchericon-192-192.png',
  '/android/android-launchericon-512-512.png',
  '/ios/180.png',
  '/ios/32.png',
  '/ios/16.png'
];

// Install event - cache static files
self.addEventListener('install', function(event) {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Caching static files');
        return cache.addAll(STATIC_CACHE);
      })
      .catch(function(error) {
        console.error('Failed to cache files:', error);
      })
  );
  // Force activation
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', function(event) {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // Take control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - cache strategy
self.addEventListener('fetch', function(event) {
  // Skip non-HTTP requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Simple cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then(function(response) {
            // Cache successful responses
            if (response.status === 200) {
              var responseToCache = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          })
          .catch(function() {
            // Fallback untuk halaman HTML
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', function(event) {
  console.log('Push event received:', event);
  
  var notificationData = {
    title: 'Story App',
    body: 'Ada story baru yang tersedia!',
    icon: '/android/android-launchericon-192-192.png',
    badge: '/android/android-launchericon-72-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/#/stories',
      timestamp: Date.now()
    },
    requireInteraction: false,
    silent: false
  };

  // Parse data dari push event jika ada
  if (event.data) {
    try {
      var pushData = event.data.json();
      
      if (pushData.title) notificationData.title = pushData.title;
      if (pushData.body) notificationData.body = pushData.body;
      if (pushData.icon) notificationData.icon = pushData.icon;
      if (pushData.url) notificationData.data.url = pushData.url;
      
      console.log('Push data received:', pushData);
    } catch (error) {
      console.error('Error parsing push data:', error);
      if (event.data.text) {
        notificationData.body = event.data.text();
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  var urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/#/stories';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE',
            url: urlToOpen
          });
          return;
        }
      }
      
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// Message event
self.addEventListener('message', function(event) {
  console.log('Message received in SW:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Error handling
self.addEventListener('error', function(event) {
  console.error('Service Worker error:', event.error);
});

console.log('Service Worker loaded successfully');