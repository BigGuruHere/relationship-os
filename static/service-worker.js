// static/service-worker.js
// PURPOSE: basic PWA service worker to make the site installable and control caching

// service-worker.js
// PURPOSE: basic SW that pre-caches only files that actually exist in /static
// SECURITY: no user data cached, only public assets

self.addEventListener('install', (event) => {
    // IT: cache only assets that live in /static
    const urlsToCache = ['/', '/site.webmanifest', '/favicon.ico']; // remove '/index.html'
    event.waitUntil(
      caches.open('relish-cache-v1').then((cache) => cache.addAll(urlsToCache))
    );
  });
  
  
  self.addEventListener('fetch', (event) => {
    // IT: basic network-first strategy
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  });
  