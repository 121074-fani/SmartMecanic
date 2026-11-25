/* Service worker: la app funciona sin conexión.
   Archivos de la app: red primero (siempre la versión vigente) y caché como respaldo offline.
   MediaPipe: caché primero (archivos versionados que no cambian). */
const CACHE = 'tdm-v26';
// MediaPipe (WASM + modelo, ~22 MB): caché propia que sobrevive a los cambios de versión de la app
const MP_CACHE = 'tdm-mediapipe-1.2.2';
const isMediaPipe = url => url.startsWith('https://cdn.jsdelivr.net/npm/@mediapipe/') || url.startsWith('https://storage.googleapis.com/mediapipe-models/');
const ASSETS = ['./', './index.html', './css/styles.css', './js/icons.js', './js/data.js', './js/data-taller.js', './js/data-sims.js', './js/data-senala.js', './js/data-equipo.js', './js/data-modelos.js', './js/engine3d.js', './js/charts.js', './js/hand-tracking.js', './js/app.js', './manifest.json', './icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== MP_CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (isMediaPipe(e.request.url)) {   // archivos versionados e inmutables: caché primero, red la primera vez
    e.respondWith(caches.open(MP_CACHE).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  // red primero: una actualización de la app se ve en la siguiente carga; sin conexión, la copia guardada
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});