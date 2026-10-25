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
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (isRegistrationRequest(request)) {
    event.respondWith(handleRegistrationRequest(event));
    return;
  }

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

function isRegistrationRequest(request) {
  const requestUrl = new URL(request.url);
  return request.method === "POST" &&
    requestUrl.origin === self.location.origin &&
    requestUrl.pathname === "/api/v1/auth/register";
}

async function handleRegistrationRequest(event) {
  const { request } = event;
  let payload;

  try {
    payload = await request.clone().json();
  } catch {
    return fetch(request);
  }

  if (typeof payload?.turnstileToken === "string" && payload.turnstileToken.trim()) {
    return fetch(request);
  }

  try {
    const client = event.clientId ? await self.clients.get(event.clientId) : null;
    await client?.navigate(client.url);
  } catch {}

  return new Response(JSON.stringify({
    success: false,
    message: "The application was updated. Please try registering again.",
    code: "CLIENT_UPDATE_REQUIRED",
  }), {
    status: 409,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
