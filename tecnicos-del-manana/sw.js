/* Service worker: la app funciona sin conexión (cache-first del shell) */
const CACHE = 'tdm-v13';
const ASSETS = ['./', './index.html', './css/styles.css', './js/data.js', './js/data-taller.js', './js/data-sims.js', './js/data-senala.js', './js/data-equipo.js', './js/data-modelos.js', './js/engine3d.js', './js/charts.js', './js/app.js', './manifest.json', './icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('./index.html'))));
});