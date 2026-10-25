const BUILD_ID = "__PUNDAD_BUILD_ID__";
const SHELL_PREFIX = "pundad-shell-v3-";
const STATIC_PREFIX = "pundad-static-v3-";
const CACHE_NAME = SHELL_PREFIX + BUILD_ID;
const STATIC_CACHE_NAME = STATIC_PREFIX + BUILD_ID;
const ENTRY_ASSETS = JSON.parse("__PUNDAD_ENTRY_ASSETS__");
const APP_SHELL = ["/manifest.webmanifest", "/pwa-icon.svg", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(installShell().then(() => self.skipWaiting()));
});

async function installShell() {
  const shell = await caches.open(CACHE_NAME);
  const assets = await caches.open(STATIC_CACHE_NAME);
  const request = new Request(new URL("/index.html", self.location.origin));
  const response = await fetch(request, { cache: "no-store" });
  if (!isValidHtml(response)) throw new Error("Invalid offline shell");
  // A deployment may switch between the sw.js and index.html requests. Never
  // install a shell whose entry files do not belong to this worker's build.
  const markup = await response.clone().text();
  if (!matchesBuild(markup)) throw new Error("Offline shell build changed");
  for (const asset of [...APP_SHELL, ...ENTRY_ASSETS]) {
    const assetRequest = new Request(new URL(asset, self.location.origin));
    const result = await fetch(assetRequest, { cache: "no-store" });
    const destination = asset.endsWith(".js") ? "script" : asset.endsWith(".css") ? "style"
      : asset.endsWith(".webmanifest") ? "manifest" : "image";
    if (!isValidStaticResponse({ destination }, result)) throw new Error("Invalid offline asset: " + asset);
    await assets.put(assetRequest, result);
  }
  await shell.put("/", response);
}

function matchesBuild(markup) {
  const marker = markup.match(/<meta\b[^>]*\bname=["\']pundad-build["\'][^>]*\bcontent=["\']([^"\']+)["\'][^>]*>/i);
  return marker?.[1] === BUILD_ID;
}

function isValidHtml(response) {
  return response.ok && !response.redirected && response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() === "text/html";
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (cacheNames) => {
        // CacheStorage keys are in creation order. Keep one previous validated
        // build so an already open tab can still use its downloaded assets offline.
        const previousCandidates = cacheNames.filter((name) => name.startsWith(SHELL_PREFIX) && name !== CACHE_NAME).reverse();
        let previousShell;
        for (const name of previousCandidates) {
          const candidate = await (await caches.open(name)).match("/");
          if (candidate && isValidHtml(candidate)) { previousShell = name; break; }
        }
        const previousBuild = previousShell?.slice(SHELL_PREFIX.length);
        const retained = [CACHE_NAME, STATIC_CACHE_NAME];
        if (previousBuild) retained.push(previousShell, STATIC_PREFIX + previousBuild);
        await Promise.all(cacheNames.filter((name) => name.startsWith("pundad-") && !retained.includes(name))
          .map((name) => caches.delete(name)));
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
    const immutable = /^\/assets\/(?:[^/]+\/)*[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/.test(requestUrl.pathname);
    event.respondWith(staticResponse(request, immutable));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const freshResponse = await fetch(request, { cache: "no-store" });
    if (isValidHtml(freshResponse)) {
      // Keep the already installed, complete offline shell until the next
      // build's worker has installed its own entry assets successfully.
      const markup = await freshResponse.clone().text();
      if (matchesBuild(markup)) {
        try { await cache.put("/", freshResponse.clone()); } catch { /* Storage quota must not break delivery. */ }
      }
    }
    return freshResponse;
  } catch {
    const names = await caches.keys();
    for (const name of [CACHE_NAME, ...names.filter((name) => name.startsWith(SHELL_PREFIX) && name !== CACHE_NAME).reverse()]) {
      const cachedResponse = await (await caches.open(name)).match("/");
      if (cachedResponse) return cachedResponse;
    }
    return Response.error();
  }
}

async function cachedStaticResponse(request) {
  const names = await caches.keys();
  for (const name of [STATIC_CACHE_NAME, ...names.filter((name) => name.startsWith(STATIC_PREFIX) && name !== STATIC_CACHE_NAME).reverse()]) {
    const candidate = await (await caches.open(name)).match(request);
    if (candidate && isValidStaticResponse(request, candidate)) return candidate;
  }
}

async function staticResponse(request, immutable) {
  if (immutable) {
    const cached = await cachedStaticResponse(request);
    if (cached) return cached;
  }
  try {
    // Avatars and other mutable URLs must revalidate their HTTP cache online.
    const response = await fetch(request, immutable ? undefined : { cache: "no-cache" });
    if (isValidStaticResponse(request, response)) {
      try {
        const cache = await caches.open(STATIC_CACHE_NAME);
        await cache.put(request, response.clone());
      } catch { /* Storage quota must not break delivery. */ }
    }
    return response;
  } catch {
    return (await cachedStaticResponse(request)) ?? Response.error();
  }
}

function isValidStaticResponse(request, response) {
  const type = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (!response.ok || response.redirected || type === "text/html") return false;
  if (request.destination === "script" || request.destination === "worker") {
    return ["text/javascript", "application/javascript", "application/x-javascript"].includes(type);
  }
  if (request.destination === "style") return type === "text/css";
  if (request.destination === "image") return type.startsWith("image/");
  if (request.destination === "font") return type.startsWith("font/") || type === "application/font-woff";
  if (request.destination === "manifest") return ["application/manifest+json", "application/json"].includes(type);
  return false;
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
