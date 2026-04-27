const CACHE = "punch-v1";
const PRECACHE = ["/", "/index.html", "/manifest.webmanifest"];

// ── Install: pre-cache shell ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ──────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ─
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API: sempre network, sem cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Ativos estáticos: cache-first, fallback para network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (
          !response ||
          response.status !== 200 ||
          response.type !== "basic"
        ) {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
