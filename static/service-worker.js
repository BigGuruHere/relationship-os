// static/service-worker.js
// PURPOSE: basic PWA service worker to make the site installable and control caching

self.addEventListener('install', (event) => {
    // IT: pre-cache important assets if you like
    event.waitUntil(
      caches.open('relish-cache-v1').then((cache) => {
        return cache.addAll(['/','/index.html','/site.webmanifest']);
      })
    );
  });
  
  self.addEventListener('fetch', (event) => {
    // IT: basic network-first strategy
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  });
  