import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function loadServiceWorker({ cacheNames = [], clients = [], network, buildId = "build-a", stores = new Map(), entryAssets = [] } = {}) {
  const listeners = new Map();
  const deletedCaches = [];
  const networkRequests = [];
  let claimed = false;

  const context = {
    URL,
    Request,
    caches: {
      keys: async () => [...new Set([...cacheNames, ...stores.keys()])],
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name);
        const key = (request) => new URL(typeof request === "string" ? request : request.url, "https://pundad.app").href;
        return {
          match: async (request) => entries.get(key(request))?.clone(),
          put: async (request, response) => entries.set(key(request), response.clone()),
          delete: async (request) => entries.delete(key(request)),
        };
      },
      delete: async (cacheName) => {
        deletedCaches.push(cacheName);
        stores.delete(cacheName);
        return true;
      },
    },
    fetch: async (request, options) => {
      networkRequests.push({ request, options });
      return network ? network(request, options) : new Response(null, { status: 204 });
    },
    Response,
    self: {
      addEventListener: (eventName, listener) => listeners.set(eventName, listener),
      clients: {
        claim: async () => {
          claimed = true;
        },
        get: async (clientId) => clients.find((client) => client.id === clientId),
        matchAll: async () => clients,
      },
      location: { origin: "https://pundad.app" },
      skipWaiting: async () => {},
    },
  };

  vm.runInNewContext(source.replaceAll("__PUNDAD_BUILD_ID__", buildId).replace('"__PUNDAD_ENTRY_ASSETS__"', JSON.stringify(JSON.stringify(entryAssets))), context);

  return {
    install: async () => {
      let installation;
      listeners.get("install")({ waitUntil: (promise) => { installation = promise; } });
      await installation;
    },
    activate: async () => {
      let activation;
      listeners.get("activate")({ waitUntil: (promise) => { activation = promise; } });
      await activation;
    },
    fetch: async (request, clientId = "") => {
      let response;
      listeners.get("fetch")({
        clientId,
        request,
        respondWith: (promise) => { response = promise; },
        waitUntil: () => {},
      });
      return response ? response : undefined;
    },
    stores,
    deletedCaches,
    networkRequests,
    wasClaimed: () => claimed,
  };
}

test("service worker removes only old PunDad caches without reloading open pages", async () => {
  const navigations = [];
  const registrationClient = {
    url: "https://pundad.app/register",
    navigate: async (url) => navigations.push(url),
  };
  const dashboardClient = {
    url: "https://pundad.app/dashboard/new-joke",
    navigate: async (url) => navigations.push(url),
  };
  const worker = loadServiceWorker({
    cacheNames: ["pundad-shell-v1", "pundad-static-v1", "unrelated-cache"],
    clients: [registrationClient, dashboardClient],
  });

  await worker.activate();

  assert.deepEqual(worker.deletedCaches.sort(), ["pundad-shell-v1", "pundad-static-v1"]);
  assert.equal(worker.wasClaimed(), true);
  assert.deepEqual(navigations, []);
});

test("fresh service-worker installs do not reload registration pages", async () => {
  const navigations = [];
  const worker = loadServiceWorker({
    cacheNames: [],
    clients: [{
      url: "https://pundad.app/register",
      navigate: async (url) => navigations.push(url),
    }],
  });

  await worker.activate();

  assert.deepEqual(navigations, []);
});

test("legacy registration submissions trigger a safe client refresh instead of reaching the API", async () => {
  const navigations = [];
  const worker = loadServiceWorker({
    cacheNames: ["pundad-shell-v1"],
    clients: [{
      id: "legacy-client",
      url: "https://pundad.app/register",
      navigate: async (url) => navigations.push(url),
    }],
  });
  const request = new Request("https://pundad.app/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "stale-client" }),
  });

  const response = await worker.fetch(request, "legacy-client");

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "CLIENT_UPDATE_REQUIRED");
  assert.deepEqual(navigations, ["https://pundad.app/register"]);
  assert.equal(worker.networkRequests.length, 0);
});

test("current registration submissions continue to the API", async () => {
  const worker = loadServiceWorker({ cacheNames: [], clients: [] });
  const request = new Request("https://pundad.app/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turnstileToken: "verified-browser-token" }),
  });

  const response = await worker.fetch(request);

  assert.equal(response.status, 204);
  assert.equal(worker.networkRequests.length, 1);
});


function assetRequest(path = "/assets/dashboard-abcdefgh.js", destination = "script") {
  return { url: `https://pundad.app${path}`, method: "GET", destination };
}

function html(body = "<html>shell</html>", status = 200, buildId = "build-a") {
  return new Response(`<meta name="pundad-build" content="${buildId}">${body}`, { status, headers: { "Content-Type": "text/html" } });
}

test("static requests never cache HTML fallback responses", async () => {
  let responses = 0;
  const worker = loadServiceWorker({ network: async () => {
    responses++;
    return responses === 1 ? html() : new Response("export default 1", {
      headers: { "Content-Type": "text/javascript" },
    });
  } });
  const first = await worker.fetch(assetRequest());
  assert.equal(first.headers.get("Content-Type"), "text/html");
  const next = await worker.fetch(assetRequest());
  assert.equal(await next.text(), "export default 1");
});

test("navigation fetch bypasses HTTP cache and does not replace offline shell with an error page", async () => {
  let offline = false;
  let failed = false;
  const worker = loadServiceWorker({ network: async (_request, options) => {
    assert.equal(options.cache, "no-store");
    if (offline) throw new TypeError("offline");
    return html(failed ? "maintenance" : "release A", failed ? 503 : 200);
  } });
  const request = { url: "https://pundad.app/dashboard?lang=no", method: "GET", mode: "navigate" };
  assert.match(await (await worker.fetch(request)).text(), /release A/);
  failed = true;
  assert.equal((await worker.fetch(request)).status, 503);
  offline = true;
  assert.match(await (await worker.fetch(request)).text(), /release A/);
});

test("activation retains one validated previous build for offline clients and removes legacy poisoned caches", async () => {
  const stores = new Map([
    ["pundad-shell-v2", new Map()],
    ["pundad-static-v2", new Map()],
  ]);
  const network = async (request) => request.destination === "script"
    ? new Response("release A script", { headers: { "Content-Type": "text/javascript" } })
    : html("release A shell");
  const a = loadServiceWorker({ stores, network });
  await a.fetch({ url: "https://pundad.app/", method: "GET", mode: "navigate" });
  await a.fetch(assetRequest());
  let offline = true;
  const b = loadServiceWorker({ stores, buildId: "build-b", network: async () => {
    if (offline) throw new TypeError("offline");
    return html("release B shell", 200, "build-b");
  } });
  await b.activate();
  assert.equal(await (await b.fetch(assetRequest())).text(), "release A script");
  assert.match(await (await b.fetch({ url: "https://pundad.app/", method: "GET", mode: "navigate" })).text(), /release A shell/);
  assert.deepEqual(b.deletedCaches.sort(), ["pundad-shell-v2", "pundad-static-v2"]);
  offline = false;
  await b.fetch({ url: "https://pundad.app/", method: "GET", mode: "navigate" });
  const c = loadServiceWorker({ stores, buildId: "build-c", network: async () => html("release C", 200, "build-c") });
  await c.fetch({ url: "https://pundad.app/", method: "GET", mode: "navigate" });
  await c.activate();
  assert.ok(c.deletedCaches.includes("pundad-shell-v3-build-a"));
  assert.ok(c.deletedCaches.includes("pundad-static-v3-build-a"));
});


test("install bypasses HTTP caches and precaches the matching HTML entry assets for offline reload", async () => {
  let offline = false;
  const worker = loadServiceWorker({ entryAssets: ["/assets/index-a.js", "/assets/index-a.css"], network: async (request, options) => {
    assert.equal(options.cache, "no-store");
    if (offline) throw new TypeError("offline");
    const path = new URL(request.url).pathname;
    if (path === "/index.html") return html('<script src="/assets/index-a.js"></script><link href="/assets/index-a.css">');
    if (path.endsWith(".js")) return new Response("entry", { headers: { "Content-Type": "text/javascript" } });
    if (path.endsWith(".css")) return new Response("css", { headers: { "Content-Type": "text/css" } });
    if (path.endsWith(".webmanifest")) return new Response("{}", { headers: { "Content-Type": "application/manifest+json" } });
    return new Response("image", { headers: { "Content-Type": path.endsWith(".svg") ? "image/svg+xml" : "image/png" } });
  } });
  await worker.install();
  offline = true;
  assert.match(await (await worker.fetch({ url: "https://pundad.app/", method: "GET", mode: "navigate" })).text(), /index-a.js/);
  assert.equal(await (await worker.fetch(assetRequest("/assets/index-a.js"))).text(), "entry");
  assert.equal(await (await worker.fetch(assetRequest("/assets/index-a.css", "style"))).text(), "css");
});

test("install rejects a shell from another build instead of caching mismatched offline HTML", async () => {
  const worker = loadServiceWorker({ entryAssets: ["/assets/index-a.js"], network: async () => html('<script src="/assets/index-b.js"></script>', 200, "build-b") });
  await assert.rejects(worker.install(), /build changed/);
});

test("failed stylesheet responses are never reused as offline styles", async () => {
  const worker = loadServiceWorker({ network: async () => new Response("missing", { status: 404, headers: { "Content-Type": "text/css" } }) });
  assert.equal((await worker.fetch(assetRequest("/assets/old.css", "style"))).status, 404);
  assert.equal((await worker.fetch(assetRequest("/assets/old.css", "style"))).status, 404);
  assert.equal(worker.networkRequests.length, 2);
});

test("an interrupted worker install cannot evict the previous usable offline build", async () => {
  const stores = new Map();
  const a = loadServiceWorker({ stores, network: async () => html("usable A") });
  await a.fetch({ url: "https://pundad.app/", method: "GET", mode: "navigate" });
  const interrupted = loadServiceWorker({ stores, buildId: "interrupted", entryAssets: ["/assets/never.js"], network: async () => html("mismatch") });
  await assert.rejects(interrupted.install());
  const b = loadServiceWorker({ stores, buildId: "build-b", network: async () => { throw new TypeError("offline"); } });
  await b.activate();
  assert.match(await (await b.fetch({ url: "https://pundad.app/", method: "GET", mode: "navigate" })).text(), /usable A/);
});

test("a worker keeps its complete offline shell when navigation receives the next build HTML", async () => {
  let release = "a";
  const worker = loadServiceWorker({ entryAssets: ["/assets/entry-a.js"], network: async () => {
    if (release === "offline") throw new TypeError("offline");
    return html(`<script src="/assets/entry-${release}.js"></script>`, 200, `build-${release}`);
  } });
  const navigation = { url: "https://pundad.app/", method: "GET", mode: "navigate" };
  await worker.fetch(navigation);
  release = "b";
  assert.match(await (await worker.fetch(navigation)).text(), /entry-b.js/);
  release = "offline";
  assert.match(await (await worker.fetch(navigation)).text(), /entry-a.js/);
});

test("mutable avatar URLs refresh online and retain the latest validated image offline", async () => {
  let version = "first avatar";
  const worker = loadServiceWorker({ network: async (_request, options) => {
    assert.equal(options.cache, "no-cache");
    if (version === "offline") throw new TypeError("offline");
    return new Response(version, { headers: { "Content-Type": "image/png" } });
  } });
  const avatar = assetRequest("/uploads/avatar.png", "image");
  assert.equal(await (await worker.fetch(avatar)).text(), "first avatar");
  version = "updated avatar";
  assert.equal(await (await worker.fetch(avatar)).text(), "updated avatar");
  version = "offline";
  assert.equal(await (await worker.fetch(avatar)).text(), "updated avatar");
});
