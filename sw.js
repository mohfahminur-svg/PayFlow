/* ============================================================
   PayFlow — Service Worker v15.0
   Strategi: Cache-First untuk aset statis, Network-First untuk navigasi HTML
   ============================================================ */

const CACHE_NAME    = 'payflow-v15';
const OFFLINE_URL   = './';

/* Semua aset lokal yang di-cache saat install */
const PRECACHE_URLS = [
  './',
  './index.html',
  './pembukaan.html',
  './Profile.jpg',
  './Profile.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-192.svg',
  './icon-512.svg',
  './manifest.json',
  './manifest.webmanifest'
];

/* -- INSTALL: Pre-cache semua aset dengan toleransi kegagalan -- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Cache item skipped:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* -- ACTIVATE: Hapus cache lama -- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* -- FETCH: Network-first untuk navigasi HTML, Cache-first untuk aset -- */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Hanya handle GET
  if (req.method !== 'GET') return;

  // Abaikan scheme non-http (chrome-extension, file dll)
  if (!req.url.startsWith('http')) return;

  // Navigasi halaman HTML: Network-first, fallback ke cache offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
          return response;
        })
        .catch(() => caches.match('./') || caches.match('./index.html') || caches.match('/index.html'))
    );
    return;
  }

  // Aset lain (gambar, icons, js, css): Cache-first, fallback ke network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return response;
      });
    })
  );
});

/* -- PUSH & LOCAL NOTIFICATIONS -- */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PayFlow 💰';
  const opts  = {
    body:   data.body  || 'Saatnya mencatat keuanganmu hari ini!',
    icon:   data.icon  || './icon-192.png',
    badge:  data.badge || './icon-192.png',
    tag:    'payflow-reminder-alert',
    vibrate: [200, 100, 200],
    data:   { url: './' }
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

/* -- NOTIFICATION CLICK: Buka / fokus app -- */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
