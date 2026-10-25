import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

test("home hero remains readable through actual browser page zoom", { timeout: 120_000 }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pundad-hero-"));
  let context;
  let server;
  t.after(async () => {
    await context?.close();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  });
  // Chrome's tabs API changes real page zoom, including layout and breakpoints.
  // Viewport resizing, deviceScaleFactor and pinch zoom cannot cover this bug.
  await writeFile(path.join(root, "manifest.json"), JSON.stringify({
    manifest_version: 3, name: "Hero zoom verification", version: "1.0",
    permissions: ["tabs"], background: { service_worker: "background.js" },
  }));
  await writeFile(path.join(root, "background.js"), "chrome.runtime.onInstalled.addListener(() => {});");
  server = await createServer({ server: { host: "127.0.0.1", port: 0, strictPort: false } });
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
  context = await chromium.launchPersistentContext(path.join(root, "profile"), {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? chromium.executablePath(),
    headless: true, viewport: null, ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-sandbox", `--disable-extensions-except=${root}`, `--load-extension=${root}`, "--window-size=1817,1043"],
  });
  let signedIn = false;
  await context.route("**/api/v1/**", route => {
    const url = route.request().url();
    const refresh = url.endsWith("/auth/refresh");
    const data = refresh ? "hero-fixture-token" : url.endsWith("/user/me")
      ? { id: 1, username: "hero-tester", role: "USER", preferredLanguage: "NO", points: 0 } : [];
    return route.fulfill({ json: { statusCode: refresh && !signedIn ? 204 : 200, data, count: 0 } });
  });
  const page = context.pages()[0];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${origin}/?lang=no`);
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const cdp = await context.newCDPSession(page);
  const output = path.resolve("output/playwright/home-hero-zoom");
  await mkdir(output, { recursive: true });
  const results = [];

  async function zoomTo(zoom) {
    const actual = await worker.evaluate(async ({ origin, zoom }) => {
      const [tab] = await chrome.tabs.query({ url: `${origin}/*` });
      await chrome.tabs.setZoom(tab.id, zoom);
      return chrome.tabs.getZoom(tab.id);
    }, { origin, zoom });
    assert.equal(actual, zoom);
    await page.waitForFunction(zoom => Math.abs(devicePixelRatio - zoom) < 0.001, zoom);
  }

  async function checkHero(name, language, theme) {
    await page.evaluate(theme => localStorage.setItem("color-theme", theme), theme);
    await page.goto(`${origin}/?lang=${language}`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });
    const layout = await page.getByRole("main").evaluate(main => {
      const heading = main.querySelector("h1"), paragraph = heading.nextElementSibling;
      const section = heading.parentElement, hero = section.parentElement, image = hero.querySelector("img");
      const rect = element => {
        const b = element.getBoundingClientRect(), s = getComputedStyle(element);
        return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height,
          font: parseFloat(s.fontSize), lineHeight: parseFloat(s.lineHeight) };
      };
      const textFits = element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const bounds = element.getBoundingClientRect();
        return [...range.getClientRects()].every(line => line.left >= bounds.left - 1 && line.right <= bounds.right + 1);
      };
      return {
        window: { innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio },
        heading: rect(heading), paragraph: rect(paragraph), image: rect(image), section: rect(section),
        imageRatio: image.naturalWidth / image.naturalHeight,
        textFits: [heading, paragraph, ...section.querySelectorAll("a")].every(textFits),
        links: [...section.querySelectorAll("a")].map(link => ({ text: link.textContent, href: link.getAttribute("href"), ...rect(link) })),
        overflow: document.documentElement.scrollWidth > innerWidth,
        fonts: [...document.fonts].filter(font => font.status === "loaded").map(font => font.family),
        dark: document.documentElement.classList.contains("dark"),
      };
    });
    assert.ok(layout.fonts.includes("Baloo 2") && layout.fonts.includes("Inter"), "Evaluate the actual loaded web fonts");
    assert.equal(layout.dark, theme === "dark");
    assert.ok(layout.heading.lineHeight + 0.01 >= layout.heading.font * 1.1, `Wrapped heading needs readable line spacing: ${JSON.stringify(layout.heading)}`);
    assert.ok(layout.paragraph.lineHeight + 0.01 >= layout.paragraph.font * 1.35, "Paragraph lines need readable spacing");
    assert.ok(layout.heading.bottom <= layout.paragraph.y, "Heading and paragraph must not collide");
    assert.ok(layout.paragraph.bottom <= layout.links[0].y, "Paragraph and CTAs must not collide");
    assert.ok(layout.links[0].right < layout.links[1].x, "CTAs must not collide");
    assert.ok(layout.textFits && !layout.overflow, "Hero text and controls must fit without horizontal overflow");
    assert.ok(Math.abs(layout.image.width / layout.image.height - layout.imageRatio) < 0.01, "Preserve illustration aspect ratio");
    assert.ok(layout.image.right <= layout.section.x || layout.image.bottom <= layout.section.y, "Illustration must not collide with text");
    const primary = signedIn ? (language === "no" ? "MIN SIDE" : "DASHBOARD") : (language === "no" ? "REGISTRER" : "REGISTER");
    assert.deepEqual(layout.links.map(({ text, href }) => ({ text, href })), [
      { text: primary, href: signedIn ? "/dashboard" : "/register" },
      { text: language === "no" ? "FINN VITSER" : "FIND JOKES", href: "/jokes/daily-joke" },
    ]);
    for (const link of await page.getByRole("main").getByRole("link").all()) {
      await link.scrollIntoViewIfNeeded();
      await link.click({ trial: true });
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(0, 0);
    // Capture the physical browser surface; Playwright's CSS viewport screenshot
    // can include a white canvas outside the surface when page zoom is reduced.
    const screenshot = await cdp.send("Page.captureScreenshot", { captureBeyondViewport: false });
    await writeFile(path.join(output, `${name}.png`), Buffer.from(screenshot.data, "base64"));
    results.push({ name, ...layout });
    return layout;
  }

  for (const language of ["no", "en"]) {
    for (const theme of ["dark", "light"]) {
      let baseline;
      for (const zoom of [1, 0.75, 0.5, 1.25, 2]) {
        await t.test(`${language} ${theme} at ${zoom * 100}% page zoom`, async () => {
          await zoomTo(zoom);
          const layout = await checkHero(`after-${language}-${theme}-${zoom * 100}`, language, theme);
          if (zoom === 1) baseline = layout;
          assert.equal(layout.window.outerWidth, baseline.window.outerWidth);
          assert.equal(layout.window.outerHeight, baseline.window.outerHeight);
          assert.ok(Math.abs(layout.window.innerWidth * zoom - baseline.window.innerWidth) < 2, "Real zoom must change the effective CSS viewport");
          if (zoom < 1) {
            for (const element of ["heading", "paragraph", "image"]) {
              const size = element === "image" ? "width" : "font";
              assert.ok(Math.abs(layout[element][size] / baseline[element][size] - 1) < 0.05, `${element} must shrink with browser zoom, within 5% of proportional sizing`);
            }
          }
        });
      }
    }
  }
  await zoomTo(1);
  signedIn = true;
  for (const language of ["no", "en"]) {
    await t.test(`${language} signed-in CTA and session restore`, () => checkHero(`after-${language}-dark-signed-in`, language, "dark"));
  }
  signedIn = false;
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ["no", "en"]) {
      for (const theme of ["dark", "light"]) {
        await t.test(`${language} ${theme} at ${width}px`, () => checkHero(`after-${language}-${theme}-${width}px`, language, theme));
      }
    }
  }
  await writeFile(path.join(output, "verification.json"), JSON.stringify({ browser: context.browser().version(), results, errors }, null, 2));
  assert.deepEqual(errors, [], "App must load without browser errors");
});
