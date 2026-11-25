/* Service worker: la app funciona sin conexión (cache-first del shell) */
const CACHE = 'tdm-v8';
const ASSETS = ['./', './index.html', './css/styles.css', './js/data.js', './js/data-taller.js', './js/data-sims.js', './js/data-senala.js', './js/engine3d.js', './js/charts.js', './js/bridge.js', './js/app.js', './manifest.json', './icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // API del hub (módulos publicados / telemetría): siempre red, nunca caché; bridge.js gestiona el modo offline
  if (new URL(e.request.url).pathname.startsWith('/api/')) return;
  // catálogo público de manuales: red primero (siempre lo más reciente), caché si no hay conexión
  if (new URL(e.request.url).pathname.startsWith('/data/manuales/')) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('./index.html'))));
});
