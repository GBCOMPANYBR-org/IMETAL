const CACHE = "imetal-offline-v3";
const ASSETS = ["/offline.html", "/logo.png", "/login-background.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("imetal-offline-") && key !== CACHE).map(key => caches.delete(key))))]));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (ASSETS.includes(new URL(request.url).pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
    return;
  }
  if (request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || Response.error()));
});
