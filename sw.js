// Movix service worker v5: primero la RED (siempre la versión nueva) y la caché solo si no hay conexión.
const CACHE = 'movix-official-v7';
const ASSETS = ['./', './index.html', './data/routes.js', './data/operator-sources.js', './data/route-enrichment.js', './data/planner.js', './js/plan-ui.js', './manifest.webmanifest', './movix-icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;           // mapas y servicios externos: sin interceptar
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
