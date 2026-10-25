import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function loadServiceWorker({ cacheNames, clients }) {
  const listeners = new Map();
  const deletedCaches = [];
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
    self: {
      addEventListener: (eventName, listener) => listeners.set(eventName, listener),
      clients: {
        claim: async () => {
          claimed = true;
        },
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
    deletedCaches,
    wasClaimed: () => claimed,
  };
}

test("service worker removes only old PunDad caches and refreshes stale registration pages", async () => {
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
  assert.deepEqual(navigations, ["https://pundad.app/register"]);
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
