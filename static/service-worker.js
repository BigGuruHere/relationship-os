// Cache only explicit public assets. Authenticated pages always go to the network.
const cacheName = 'relish-cache-v2';
const assets = [
  '/site.webmanifest',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

self.addEventListener('activate', (event) => {
  // The old cache could contain the signed-in home page.
  event.waitUntil(caches.delete('relish-cache-v1'));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !assets.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request, { cacheName })));
});
