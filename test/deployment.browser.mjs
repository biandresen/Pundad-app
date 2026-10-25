import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const project = fileURLToPath(new URL("..", import.meta.url));
const source = process.env.PUNDAD_FRONTEND_SOURCE ?? project;
const deployment = path.resolve(process.env.PUNDAD_DEPLOY_ROOT ?? path.join(project, "../../backend/pundad-api-dev"));
const reproduce = process.env.PUNDAD_REPRODUCE === "1";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

function python(code, ...args) {
  execFileSync("python3", ["-c", code, path.join(deployment, "ops/deploy"), ...args], { stdio: "inherit" });
}

async function build(root, name) {
  const input = path.join(root, `source-${name}`);
  await mkdir(input);
  for (const item of ["src", "public", "index.html", "vite.config.ts"]) {
    await cp(path.join(source, item), path.join(input, item), { recursive: true });
  }
  await symlink(path.join(project, "node_modules"), path.join(input, "node_modules"));
  // Change a real lazy layout and stylesheet so both releases have distinct hashes.
  const layout = path.join(input, "src/routes/layouts/DashboardLayout.tsx");
  await writeFile(layout, (await readFile(layout, "utf8")).replace('className="layout-container"', `className="layout-container" data-browser-release="${name}"`));
  const css = path.join(input, "src/index.css");
  await writeFile(css, `${await readFile(css, "utf8")}\n:root { --browser-release: ${name}; }\n`);
  const frontend = path.join(root, "production/releases", name, "frontend");
  execFileSync(process.execPath, [path.join(project, "node_modules/vite/bin/vite.js"), "build", "--outDir", frontend], {
    cwd: input,
    env: { ...process.env, VITE_BUILD_ID: name.repeat(40) },
    stdio: "pipe",
  });
  await writeFile(path.join(frontend, "__version.json"), JSON.stringify({ environment: "production", release: name, frontendSha: name.repeat(40) }));
  const assets = await readdir(path.join(frontend, "assets"));
  return { frontend, dashboard: assets.find((asset) => /^DashboardLayout-.*\.js$/.test(asset)), profile: assets.find((asset) => /^Profile-.*\.js$/.test(asset)), css: assets.find((asset) => /^index-.*\.css$/.test(asset)) };
}

test("open production clients cross an atomic frontend release", { timeout: 180_000 }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pundad-browser-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const envRoot = path.join(root, "production");
  const a = await build(root, "a");
  const b = await build(root, "b");
  assert.notEqual(a.dashboard, b.dashboard);
  assert.notEqual(a.css, b.css);
  const api = http.createServer((request, response) => {
    const data = request.url.endsWith("/auth/refresh") ? "browser-fixture-token"
      : request.url.endsWith("/user/me") ? { id: 1, username: "release-tester", role: "USER", preferredLanguage: "NO", points: 0 }
      : [];
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ statusCode: 200, success: true, data, count: 0, totalPages: 0 }));
  });
  const apiPort = await listen(api);
  t.after(() => api.close());
  const portServer = http.createServer();
  const port = await listen(portServer);
  await new Promise((resolve) => portServer.close(resolve));
  const template = await readFile(path.join(deployment, "ops/deploy/nginx.conf"), "utf8");
  const server = template.replaceAll("/srv/pundad/production", envRoot)
    .replace("listen 80;", `listen 127.0.0.1:${port};`)
    .replace("http://127.0.0.1:4000", `http://127.0.0.1:${apiPort}`);
  const config = path.join(root, "nginx.conf");
  await writeFile(config, `pid ${root}/nginx.pid;\nerror_log ${root}/error.log;\nevents {}\nhttp {\ninclude /etc/nginx/mime.types;\naccess_log off;\nclient_body_temp_path ${root}/body;\nproxy_temp_path ${root}/proxy;\n${server}\n}\n`);
  const prepared = new Set();
  async function activate(name, previous, retain = true) {
    const target = path.join(envRoot, "releases", name);
    if (reproduce) {
      const next = path.join(envRoot, ".current-next");
      await symlink(target, next);
      const { rename } = await import("node:fs/promises");
      await rename(next, path.join(envRoot, "current"));
      return;
    }
    if (!prepared.has(name)) {
      python("import sys; from pathlib import Path; sys.path.insert(0, sys.argv[1]); from common import prepare_frontend_assets; prepare_frontend_assets(Path(sys.argv[2]),Path(sys.argv[3])/'frontend',Path(sys.argv[4]) if sys.argv[4] else None)", envRoot, target, retain && previous ? path.join(envRoot, "releases", previous) : "");
      prepared.add(name);
    }
    python("import sys; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from common import switch_current; switch_current(Path(sys.argv[2]),Path(sys.argv[3]))", envRoot, target);
  }
  await activate("a");
  const nginx = spawn(process.env.NGINX_BIN ?? "/usr/sbin/nginx", ["-c", config, "-p", root, "-g", "daemon off;"], { stdio: ["ignore", "ignore", "pipe"] });
  let nginxError = "";
  nginx.stderr.on("data", (chunk) => { nginxError += chunk; });
  t.after(async () => {
    nginx.kill("SIGQUIT");
    if (nginx.exitCode === null) await once(nginx, "exit");
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempts = 0; ; attempts++) {
    try { if ((await fetch(origin)).ok) break; } catch {}
    assert.ok(attempts < 100, `Isolated nginx did not start: ${nginxError}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, headless: true, args: ["--no-sandbox"] });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") t.diagnostic(message.text()); });
  await page.goto(`${origin}/?lang=no`);
  await page.locator('a[href="/dashboard"]').first().waitFor();
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active), undefined, { timeout: 15_000 });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  assert.ok(!requests.some((url) => url.includes(a.dashboard)), "release A dashboard must remain lazy");
  let documents = 0;
  page.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await activate("b", "a");
  await page.locator('a[href="/dashboard"]').first().click();
  if (reproduce) {
    await page.waitForEvent("pageerror", { timeout: 15_000 }).catch(() => {});
    const missing = await fetch(`${origin}/assets/${a.dashboard}`);
    assert.equal(missing.status, 404);
    assert.ok(errors.some((error) => /dynamically imported|Loading chunk|module script/.test(error)), JSON.stringify(errors));
    t.diagnostic(`Reproduced: old dashboard ${a.dashboard} returned 404; browser: ${errors.join("; ")}`);
    return;
  }
  await page.locator('[data-browser-release="a"] #jokeTitle').waitFor();
  assert.equal(documents, 0, "retained assets avoid a document reload");
  const retainedCss = await fetch(`${origin}/assets/${a.css}`);
  assert.equal(retainedCss.status, 200);
  assert.match(retainedCss.headers.get("content-type"), /text\/css/);
  assert.match(retainedCss.headers.get("cache-control"), /immutable/);
  for (const resource of ["/index.html", "/dashboard?lang=en", "/sw.js"]) {
    assert.match((await fetch(origin + resource)).headers.get("cache-control"), /no-cache/);
  }
  for (const resource of ["/__build.json", "/__version.json"]) {
    assert.match((await fetch(origin + resource)).headers.get("cache-control"), /no-store/);
  }
  const missingCss = await fetch(`${origin}/assets/missing-release.css`);
  assert.equal(missingCss.status, 404);
  assert.doesNotMatch(await missingCss.text(), /<div id="root"/);
  const fresh = await context.newPage();
  await fresh.goto(`${origin}/dashboard?lang=en`);
  await fresh.locator('[data-browser-release="b"] #jokeTitle').waitFor();
  assert.equal((await (await fetch(`${origin}/__version.json`)).json()).release, "b");
  const cssFailure = await page.evaluate(() => new Promise((resolve) => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/assets/browser-missing.css";
    stylesheet.onload = () => resolve("loaded");
    stylesheet.onerror = () => resolve("rejected");
    document.head.append(stylesheet);
  }));
  assert.equal(cssFailure, "rejected");
  assert.equal(await page.evaluate(async () => Boolean(await caches.match("/assets/browser-missing.css"))), false);
  assert.equal(documents, 0, "ordinary service-worker updates never reload the old tab");
  assert.deepEqual(errors, []);
  await context.close();

  async function openA({ blockStorage = false } = {}) {
    await activate("a");
    const client = await browser.newContext();
    t.after(() => client.close());
    if (blockStorage) {
      await client.addInitScript(() => {
        Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
      });
    }
    const tab = await client.newPage();
    await tab.goto(`${origin}/?lang=en`);
    await tab.locator('a[href="/dashboard"]').first().waitFor();
    await tab.locator('img[alt="stack of books"]').waitFor();
    await tab.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active), undefined, { timeout: 15_000 });
    await tab.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    let reloads = 0;
    tab.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === tab.mainFrame()) reloads++; });
    return { client, tab, reloads: () => reloads };
  }
  async function navigate(tab, route) {
    // Exercise BrowserRouter's public History API without triggering a document load.
    await tab.evaluate((url) => {
      history.pushState({}, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    }, route);
  }
  async function missing(file, action) {
    const target = path.join(b.frontend, ".retained-assets/assets", file);
    const bytes = await readFile(target);
    await rm(target);
    try { await action(); } finally { await writeFile(target, bytes); }
  }
  async function retry(tab, name = "Try again") {
    await tab.getByRole("button", { name, exact: true }).click({ timeout: 5000 });
  }

  await t.test("a missing old chunk reloads once, preserving route, query and hash", async () => {
    const old = await openA();
    await activate("b");
    await missing(a.dashboard, async () => {
      const route = "/dashboard?lang=en&from=recovery#draft";
      await navigate(old.tab, route);
      await old.tab.locator('[data-browser-release="b"] #jokeTitle').waitFor();
      assert.equal(old.tab.url(), origin + route);
      assert.equal(old.reloads(), 1);
      assert.ok(await old.tab.evaluate(() => sessionStorage.getItem("pundad:chunk-recovery")));
    });
  });

  await t.test("repeated chunk failure shows a fallback without a reload loop", async () => {
    const old = await openA();
    await activate("b");
    const native = path.join(b.frontend, "assets", b.dashboard);
    const bytes = await readFile(native);
    await rm(native);
    try {
      await missing(a.dashboard, async () => {
        await navigate(old.tab, "/dashboard?lang=en#repeat");
        await old.tab.getByRole("alert").filter({ hasText: "This page could not be loaded." }).waitFor();
        // Wait for both metadata checks, then retry the rejected lazy import repeatedly.
        await old.tab.waitForFunction(() => Boolean(sessionStorage.getItem("pundad:chunk-recovery")));
        await retry(old.tab);
        await retry(old.tab);
        await old.tab.waitForTimeout(300);
        assert.equal(old.reloads(), 1);
        await old.tab.reload();
        await old.tab.getByRole("alert").filter({ hasText: "This page could not be loaded." }).waitFor();
        await retry(old.tab);
        await old.tab.waitForTimeout(300);
        assert.equal(old.reloads(), 2, "only the explicit test reload may add a second navigation");
      });
    } finally { await writeFile(native, bytes); }
  });

  await t.test("blocked session storage keeps the current page and offers recovery", async () => {
    const old = await openA({ blockStorage: true });
    await activate("b");
    await missing(a.dashboard, async () => {
      await navigate(old.tab, "/dashboard?lang=en#storage");
      await old.tab.getByRole("alert").filter({ hasText: "This page could not be loaded." }).waitFor();
      await retry(old.tab);
      await navigate(old.tab, "/dashboard?lang=en&retry=1#changed");
      await old.tab.getByRole("alert").filter({ hasText: "This page could not be loaded." }).waitFor();
      await retry(old.tab);
      await old.tab.waitForTimeout(300);
      assert.equal(old.reloads(), 0);
    });
  });

  await t.test("the recovery fallback follows Norwegian language selection", async () => {
    const old = await openA({ blockStorage: true });
    await activate("b");
    await missing(a.dashboard, async () => {
      await navigate(old.tab, "/dashboard?lang=no#norsk");
      await old.tab.getByRole("alert").filter({ hasText: "Siden kunne ikke lastes." }).waitFor();
      await retry(old.tab, "Prøv igjen");
      assert.equal(old.reloads(), 0);
    });
  });

  await t.test("ordinary module exceptions never consume deployment recovery", async () => {
    const old = await openA();
    await activate("b");
    const target = path.join(b.frontend, ".retained-assets/assets", a.dashboard);
    const bytes = await readFile(target);
    await writeFile(target, 'throw new Error("ordinary application failure");');
    try {
      await navigate(old.tab, "/dashboard?lang=en#application-error");
      await old.tab.getByRole("alert").filter({ hasText: "This page could not be loaded." }).waitFor();
      assert.equal(old.reloads(), 0);
      assert.equal(await old.tab.getByRole("button", { name: "Try again", exact: true }).count(), 0);
      assert.equal(await old.tab.evaluate(() => sessionStorage.getItem("pundad:chunk-recovery")), null);
    } finally { await writeFile(target, bytes); }
  });

  await t.test("unsaved editor remains available when a new lazy route fails", async () => {
    const old = await openA();
    await navigate(old.tab, "/dashboard?lang=en");
    await old.tab.locator("#jokeTitle").fill("Do not lose this draft");
    await activate("b");
    await missing(a.profile, async () => {
      await old.tab.locator('a[href="/dashboard/profile"]').first().click();
      await old.tab.getByRole("alert").filter({ hasText: "Your edits are still open." }).waitFor();
      assert.equal(old.reloads(), 0);
      assert.equal(await old.tab.locator("#jokeTitle").inputValue(), "Do not lose this draft");
      assert.equal(await old.tab.getByRole("button", { name: "Reload page", exact: true }).count(), 0);
      await old.tab.getByRole("button", { name: "Go back", exact: true }).click();
      await old.tab.locator("#jokeTitle").waitFor();
      assert.equal(await old.tab.locator("#jokeTitle").inputValue(), "Do not lose this draft");
      assert.equal(old.reloads(), 0);
    });
  });

  await t.test("offline lazy failures never trigger deployment recovery", async () => {
    const old = await openA();
    await old.client.setOffline(true);
    await navigate(old.tab, "/dashboard?lang=en#offline");
    await old.tab.getByRole("alert").filter({ hasText: "You are offline." }).waitFor();
    assert.equal(old.reloads(), 0);
    await old.client.setOffline(false);
    await retry(old.tab);
    // Browser module maps may remember a failed import; either the route loads or
    // the fallback remains usable, without consuming a deployment reload budget.
    await old.tab.waitForTimeout(300);
    assert.equal(old.reloads(), 0);
    assert.equal(await old.tab.evaluate(() => sessionStorage.getItem("pundad:chunk-recovery")), null);
    await navigate(old.tab, "/?lang=en#visited-home");
    await old.tab.locator('img[alt="stack of books"]').waitFor();
    // Visit under worker control: the very first Home import can precede the
    // initial worker installation and is therefore not yet in its runtime cache.
    await old.tab.reload();
    await old.tab.locator('img[alt="stack of books"]').waitFor();
    const beforeOfflineReload = old.reloads();
    await old.client.setOffline(true);
    await old.tab.reload();
    await old.tab.locator('img[alt="stack of books"]').waitFor();
    assert.equal(old.reloads(), beforeOfflineReload + 1, "the visited PWA shell remains available offline");
  });
});
