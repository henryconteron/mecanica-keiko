const CACHE = "keiko-panel-v3";
const SHELL = ["./admin-estado.html", "./assets/admin-estado.js", "./assets/config.js", "./assets/marca/logo/logo.png"];

const shellUrls = new Set(SHELL.map((path) => new URL(path, self.location.href).href));
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("keiko-panel-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !shellUrls.has(event.request.url)) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => await caches.match(event.request) || new Response("Sin conexión. Vuelve a intentar cuando tengas internet.", { status: 503 })));
});
