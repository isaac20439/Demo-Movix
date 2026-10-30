const CACHE='movix-demo-v5';
const ASSETS=['./','./index.html','./data/routes.js','./data/operator-sources.js','./data/route-enrichment.js','./data/planner.js','./js/plan-ui.js','./data/rutas_amb.geojson','./manifest.webmanifest','./movix-icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(event.request.method==='GET'&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match('./index.html')))));
