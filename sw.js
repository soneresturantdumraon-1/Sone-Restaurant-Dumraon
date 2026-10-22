// Sone customer - network-first (hamesha naya code), offline par cache se
const CACHE = 'sone-customer-v2';
const ASSETS = ["./", "index.html", "app.js", "app.css", "ios.css", "sone.js", "config.js", "manifest.json", "sonelogo.png", "icon-192.png", "img/bread.jpg", "img/breakfast.jpg", "img/chicken.jpg", "img/chinese.jpg", "img/dal.jpg", "img/fish.jpg", "img/front_night.jpg", "img/kabab.jpg", "img/mutton.jpg", "img/noodles.jpg", "img/paneer.jpg", "img/pg_back.jpg", "img/pg_cover.jpg", "img/pg_delivery.jpg", "img/pg_lunch.jpg", "img/pg_mutton.jpg", "img/pg_rice.jpg", "img/pg_snacks.jpg", "img/pg_veg.jpg", "img/qr.jpg", "img/rice.jpg", "img/salad.jpg", "img/soup.jpg", "img/thali1.jpg", "img/thali2.jpg", "img/veg.jpg", "partyhall.jpg", "sonefront1.jpg", "partyhall1.jpg", "sonein.jpg", "sonein1.jpg"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('./'))));
});
