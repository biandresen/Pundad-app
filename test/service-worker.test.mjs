import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function loadServiceWorker({ cacheNames, clients }) {
  const listeners = new Map();
  const deletedCaches = [];
  const networkRequests = [];
  let claimed = false;

  const context = {
    URL,
    caches: {
      keys: async () => cacheNames,
      delete: async (cacheName) => {
        deletedCaches.push(cacheName);
        return true;
      },
    },
    fetch: async (request) => {
      networkRequests.push(request);
      return new Response(null, { status: 204 });
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

  vm.runInNewContext(source, context);

  return {
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
      });
      return response ? response : undefined;
    },
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
