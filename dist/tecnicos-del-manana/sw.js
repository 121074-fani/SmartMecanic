/* Service worker: la app funciona sin conexión.
   Red primero (siempre la versión vigente) y caché como respaldo offline.
   Solo se guardan respuestas válidas: un .css debe llegar como text/css (en desarrollo, Vite puede
   responder un módulo JS si la petición no pide CSS; guardarlo rompía los estilos). */
const CACHE = 'tdm-v9';
const ASSETS = ['./', './index.html', './css/styles.css', './js/data.js', './js/data-taller.js', './js/data-sims.js', './js/data-senala.js', './js/engine3d.js', './js/charts.js', './js/bridge.js', './js/app.js', './manifest.json', './icons/icon.svg'];
const SCOPE = new URL('./', self.location).pathname;

const cacheable = (url, res) => {
  if (!res || !res.ok || res.type === 'opaque') return false;
  const ct = res.headers.get('content-type') || '';
  if (/\.css$/.test(new URL(url).pathname)) return ct.includes('text/css');
  if (/\.js$/.test(new URL(url).pathname)) return ct.includes('javascript');
  return true;
};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => {
    const req = new Request(a, { cache: 'no-cache', headers: a.endsWith('.css') ? { Accept: 'text/css' } : {} });
    return fetch(req).then(res => (cacheable(req.url, res) ? c.put(a, res) : null)).catch(() => null);
  }))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const path = new URL(e.request.url).pathname;
  // API del hub: siempre red; bridge.js gestiona el modo offline
  if (path.startsWith('/api/')) return;
  // catálogo público de manuales y archivos de la app: red primero, caché si no hay conexión
  if (!path.startsWith('/data/manuales/') && !path.startsWith(SCOPE)) return;
  e.respondWith(fetch(e.request).then(res => {
    if (cacheable(e.request.url, res)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
