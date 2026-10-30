/* ============================================================
   PayFlow — Service Worker v1.0
   Strategi: Cache-First untuk aset statis, Network-First untuk HTML
   ============================================================ */

const CACHE_NAME    = 'payflow-v10';
const OFFLINE_URL   = '/';

/* Semua aset yang di-cache saat install */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/pembukaan.html',
  '/192 x 192.png',
  '/512 x 512.png',
  '/192 x 192.svg',
  '/512 x 512.svg',
  '/192 x 192.jpg',
  '/512 x 512.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/logo 192 x 192.svg',
  '/logo 512 x 512.svg',
  '/manifest.webmanifest',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries'
];

/* -- INSTALL: Pre-cache semua aset -- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Gagal cache beberapa aset:', err);
      });
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

/* -- FETCH: Network-first untuk navigasi, Cache-first untuk aset -- */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Hanya handle GET
  if (req.method !== 'GET') return;

  // Abaikan chrome-extension dll
  if (!req.url.startsWith('http')) return;

  // Navigasi (HTML) ? Network-first, fallback ke cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // Aset lain ? Cache-first, fallback ke network
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

/* -- PUSH NOTIFICATION (jika digunakan di masa depan) -- */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PayFlow 💰';
  const opts  = {
    body:   data.body  || 'Saatnya mencatat keuanganmu hari ini!',
    icon:   data.icon  || '/192 x 192.png',
    badge:  data.badge || '/192 x 192.png',
    tag:    'keuanganku-daily-reminder',
    vibrate: [200, 100, 200],
    data:   { url: '/' }
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
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
