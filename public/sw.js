const CACHE_NAME = "pundad-shell-v2";
const STATIC_CACHE_NAME = "pundad-static-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/pwa-icon.svg", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (cacheNames) => {
        const oldPundadCaches = cacheNames.filter(
          (cacheName) => cacheName.startsWith("pundad-") && ![CACHE_NAME, STATIC_CACHE_NAME].includes(cacheName),
        );

        await Promise.all(oldPundadCaches.map((cacheName) => caches.delete(cacheName)));
        await self.clients.claim();

        if (oldPundadCaches.length === 0) {
          return;
        }

        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          clients
            .filter(isRegistrationClient)
            .map((client) => client.navigate(client.url)),
        );
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (requestUrl.origin === self.location.origin && isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const freshResponse = await fetch(request);
    cache.put("/", freshResponse.clone());
    return freshResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    return cachedResponse ?? cache.match("/") ?? Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const freshResponsePromise = fetch(request)
    .then((freshResponse) => {
      if (freshResponse.ok) {
        cache.put(request, freshResponse.clone());
      }

      return freshResponse;
    })
    .catch(() => undefined);

  return cachedResponse ?? (await freshResponsePromise) ?? Response.error();
}

function isStaticAsset(request) {
  return ["style", "script", "worker", "font", "image", "manifest"].includes(request.destination);
}

function isRegistrationClient(client) {
  try {
    const clientUrl = new URL(client.url);
    return clientUrl.origin === self.location.origin && /^\/register\/?$/.test(clientUrl.pathname);
  } catch {
    return false;
  }
}
