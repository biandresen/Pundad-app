import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

const user = { id: 202, username: "body-fixture", email: "body@example.test", role: "ADMIN", preferredLanguage: "NO" };
const baseJoke = { id: 202, authorId: 202, title: "Legacy tall fixture", body: Array(49).fill("a").join("\n"),
  published: true, createdAt: "2026-10-26T12:00:00Z", changedAt: "2026-10-26T12:00:00Z", user, likes: [], comments: [], tags: [] };

test("collapsed legacy previews contain logical and wrapped lines with accessible expansion", { timeout: 180_000 }, async t => {
  const output = path.resolve("output/playwright/body-limits");
  await mkdir(output, { recursive: true });
  const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? chromium.executablePath(), args: ["--no-sandbox"] });
  t.after(async () => { await browser.close(); await server.close(); });
  const errors = [], results = [];
  const origin = server.resolvedUrls.local[0];
  for (const language of ["no", "en"]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: "block" });
    await context.addInitScript(theme => { localStorage.setItem("color-theme", theme); localStorage.setItem("dadjokes_seen_nav_hint", "1"); }, theme);
    let joke = { ...baseJoke };
    await context.route("**/api/v1/**", route => {
      const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
      const data = endpoint === "/auth/refresh" ? "fixture-token" : endpoint === "/user/me" ? user
        : endpoint === "/jokes/202" ? joke : endpoint === "/jokes" || endpoint === "/jokes/drafts" ? [joke]
        : endpoint === "/moderation/cache" ? { count: 0, termsLoaded: true } : [];
      return route.fulfill({ json: { statusCode: 200, data, count: Array.isArray(data) ? data.length : 1 } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", dialog => dialog.accept());
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, body] of [["legacy", baseJoke.body], ["blank-lines", "Setup" + "\n".repeat(80) + "Punchline"], ["wrapped", "A long wrapped joke sentence. ".repeat(30)], ["short-wrapped", "A long wrapped joke sentence. ".repeat(12)]]) {
        joke = { ...baseJoke, body };
        await page.goto(`${origin}jokes/202?lang=${language}`);
        await page.getByText(joke.title, { exact: true }).waitFor();
        await page.evaluate(async () => { await document.fonts.load('16px "Inter"'); await document.fonts.load('16px "Baloo 2"'); await document.fonts.ready; });
        const more = page.getByRole("button", { name: language === "no" ? "Les mer" : "Read more", exact: true });
        if (name === "short-wrapped" && width === 1280 && !await more.count()) {
          const full = page.locator("p.whitespace-pre-wrap");
          assert.equal(await full.textContent(), body);
          assert.ok(await full.evaluate(el => el.scrollHeight <= el.clientHeight + 1), "Fitting text stays readable without expansion");
          continue;
        }
        await more.waitFor();
        assert.equal(await more.count(), 1, "Short but tall posts offer expansion");
        const paragraph = page.locator("p.whitespace-pre-wrap");
        const collapsed = await paragraph.evaluate(el => ({ height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight) }));
        assert.ok(collapsed.height <= collapsed.lineHeight * 6 + 1, "Collapsed body is at most six rendered lines");
        await more.click();
        const less = page.getByRole("button", { name: language === "no" ? "Vis mindre" : "Show less", exact: true });
        await less.waitFor();
        assert.equal(await paragraph.textContent(), body);
        assert.ok(await paragraph.evaluate(el => el.getBoundingClientRect().height) > collapsed.height, "Expand reveals the complete body");
        await less.click();
        assert.equal(await more.getAttribute("aria-expanded"), "false");
        assert.equal(await paragraph.evaluate(el => el.getBoundingClientRect().height), collapsed.height);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (name === "legacy") await page.screenshot({ path: path.join(output, `after-preview-${language}-${theme}-${width}.png`), fullPage: true });
        results.push({ language, theme, width, name, collapsed });
      }
    }
    // Feeds and saved draft cards use the same protected body renderer.
    for (const route of ["jokes/all-jokes", "dashboard/drafts"]) {
      joke = { ...baseJoke, published: route !== "dashboard/drafts" };
      await page.goto(`${origin}${route}?lang=${language}`);
      const more = page.getByRole("button", { name: language === "no" ? "Les mer" : "Read more", exact: true });
      await more.waitFor();
      const height = await page.locator("p.whitespace-pre-wrap").evaluate(el => el.getBoundingClientRect().height);
      assert.ok(height <= 168, "Collapsed feed and draft body stays bounded");
    }
    joke = { ...baseJoke, body: "Setup\n\nPunchline" };
    await page.goto(`${origin}jokes/202?lang=${language}`);
    await page.getByText(joke.title, { exact: true }).waitFor();
    assert.equal(await page.locator("p.whitespace-pre-wrap").textContent(), "Setup\n\nPunchline");
    assert.equal(await page.getByRole("button", { name: language === "no" ? "Les mer" : "Read more", exact: true }).count(), 0);
    await context.close();
  }
  await writeFile(path.join(output, "preview-results.json"), JSON.stringify({ results, errors }, null, 2));
  assert.deepEqual(errors, []);
});

test("forms validate typing and real clipboard paste, preserve paragraphs, and display translated API body errors", { timeout: 240_000 }, async t => {
  const output = path.resolve("output/playwright/body-limits");
  await mkdir(output, { recursive: true });
  const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? chromium.executablePath(), args: ["--no-sandbox"] });
  t.after(async () => { await browser.close(); await server.close(); });
  const origin = server.resolvedUrls.local[0];
  const results = [];
  for (const language of ["no", "en"]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: "block" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    await context.addInitScript(theme => { localStorage.setItem("color-theme", theme); localStorage.setItem("dadjokes_seen_nav_hint", "1"); }, theme);
    let joke = { ...baseJoke, body: "Setup\n\nPunchline" }, rejectBody = false;
    const writes = [], appErrors = [];
    await context.route("**/api/v1/**", route => {
      const req = route.request(), endpoint = new URL(req.url()).pathname.replace("/api/v1", "");
      if (["POST", "PATCH"].includes(req.method()) && /^\/jokes(?:\/202)?$/.test(endpoint)) {
        const payload = req.postDataJSON();
        writes.push({ method: req.method(), payload, language: req.headers()["x-app-language"] });
        if (rejectBody) return route.fulfill({ status: 400, json: { statusCode: 400, message: "Validation failed", errors: [{ field: "body", message: "Body must not contain three consecutive newlines" }] } });
        joke = { ...joke, ...payload, tags: (payload.tags ?? []).filter(Boolean).map((name, id) => ({ id, name })) };
        return route.fulfill({ json: { statusCode: 200, data: joke } });
      }
      const data = endpoint === "/auth/refresh" ? "fixture-token" : endpoint === "/user/me" ? user : endpoint === "/jokes/202" ? joke
        : endpoint === "/jokes" || endpoint === "/jokes/drafts" ? [joke] : endpoint === "/moderation/cache" ? { count: 0, termsLoaded: true } : [];
      return route.fulfill({ json: { statusCode: 200, data, count: Array.isArray(data) ? data.length : 1 } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("dialog", dialog => dialog.accept());
    page.on("pageerror", error => appErrors.push(error.message));
    const newlineMessage = language === "no" ? "Teksten kan ikke inneholde tre linjeskift på rad. Bruk høyst én tom linje mellom avsnitt." : "Body cannot contain three consecutive newlines. Use at most one blank line between paragraphs.";
    const lineMessage = language === "no" ? "Teksten kan ha høyst 50 linjer, inkludert tomme linjer." : "Body can have at most 50 lines, including empty lines.";
    async function paste(locator, text) {
      await locator.focus();
      await page.evaluate(text => navigator.clipboard.writeText(text), text);
      await locator.press("Control+V");
      assert.equal(await locator.inputValue(), text.replace(/\r\n?/g, "\n"));
    }
    async function noOverflow() {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}dashboard/new-joke?lang=${language}`);
      await page.locator("#jokeTitle").fill("Form fixture");
      const body = page.locator("#body"), publish = page.locator("button[type=submit]");
      const save = page.getByRole("button", { name: language === "no" ? "LAGRE SOM UTKAST" : "SAVE AS DRAFT", exact: true });
      await body.fill("Setup");
      await body.press("End");
      await body.press("Enter"); await body.press("Enter");
      assert.equal(await publish.isEnabled(), true);
      await body.press("Enter");
      await page.getByText(newlineMessage, { exact: true }).waitFor();
      assert.equal(await body.inputValue(), "Setup\n\n\n");
      assert.equal(await publish.isEnabled(), false);
      assert.equal(await save.isEnabled(), false);
      await page.locator("#jokeTitle").press("Enter");
      const previousWrites = writes.length;
      await body.fill("");
      await paste(body, Array(51).fill("x").join("\n"));
      await page.getByText(lineMessage, { exact: true }).waitFor();
      assert.equal(await publish.isEnabled(), false);
      assert.equal(writes.length, previousWrites);
      await noOverflow();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(output, `after-form-${language}-${theme}-${width}.png`), fullPage: true });
      await body.fill("x".repeat(10000));
      assert.equal(await publish.isEnabled(), true);
      assert.equal(await page.getByLabel(language === "no" ? "Tegn" : "Characters", { exact: true }).textContent(), "10000 / 10000");
      await body.press("End"); await body.press("x");
      await page.getByText(language === "no" ? "Teksten kan ha høyst 10 000 tegn." : "Body can have at most 10,000 characters.", { exact: true }).waitFor();
      assert.equal(await publish.isEnabled(), false);
      await body.fill("");
      await paste(body, "\nSetup\r\n\rPunchline\r");
      assert.equal(await publish.isEnabled(), true);
      rejectBody = true;
      await publish.click();
      await page.getByText(newlineMessage, { exact: true }).waitFor();
      assert.equal(await body.inputValue(), "\nSetup\n\nPunchline\n");
      rejectBody = false;
      await body.fill("");
      await body.fill("\nSetup\n\nPunchline\n");
      await save.click();
      await page.waitForURL(/\/dashboard\/drafts/);
      assert.equal(writes.at(-1).payload.published, false);
      assert.equal(writes.at(-1).payload.body, "\nSetup\n\nPunchline\n");
      assert.equal(writes.at(-1).language, language.toUpperCase());

      // The same editor serves saved drafts and existing published posts.
      for (const published of [false, true]) {
        joke = { ...joke, published, body: "Setup\n\nPunchline" };
        await page.goto(`${origin}jokes/202?lang=${language}`);
        const edit = page.getByTitle(language === "no" ? "Rediger vits" : "Edit joke", { exact: true });
        await edit.click({ timeout: 5000 }).catch(async error => {
          await page.screenshot({ path: path.join(output, "form-failure.png"), fullPage: true });
          await writeFile(path.join(output, "form-failure.txt"), await page.content());
          console.log({ joke, writes, url: page.url() });
          throw error;
        });
        await edit.last().click();
        const editor = page.locator("textarea"), submit = page.getByRole("button", { name: language === "no" ? "Rediger melding" : "Edit Message", exact: true });
        await editor.fill("Setup"); await editor.press("End");
        await editor.press("Enter"); await editor.press("Enter"); await editor.press("Enter");
        await page.getByText(newlineMessage, { exact: true }).waitFor();
        assert.equal(await submit.isEnabled(), false);
        await editor.fill(""); await paste(editor, Array(51).fill("x").join("\n"));
        const errorMessage = page.getByText(lineMessage, { exact: true });
        await errorMessage.waitFor();
        assert.equal(await submit.isEnabled(), false);
        const messageBounds = await errorMessage.boundingBox(), submitBounds = await submit.boundingBox();
        assert.ok(messageBounds.y + messageBounds.height <= submitBounds.y || submitBounds.y + submitBounds.height <= messageBounds.y, "Body error and submit control do not overlap");
        if (!published) {
          await errorMessage.scrollIntoViewIfNeeded();
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: path.join(output, `after-edit-${language}-${theme}-${width}.png`), fullPage: true });
        }
        await editor.fill("\nSetup\n\nPunchline\n");
        rejectBody = true;
        await submit.click();
        await page.getByText(newlineMessage, { exact: true }).waitFor();
        rejectBody = false;
        await editor.fill("\nEdited setup\n\nPunchline\n");
        await noOverflow();
        await submit.click();
        await editor.waitFor({ state: "detached" });
        assert.equal(writes.at(-1).method, "PATCH");
        assert.equal(writes.at(-1).payload.body, "\nEdited setup\n\nPunchline\n");
        assert.equal(writes.at(-1).payload.published, published);
      }
      await page.goto(`${origin}dashboard/new-joke?lang=${language}`);
      await page.locator("#jokeTitle").fill("Publish fixture");
      await page.locator("#body").fill(Array(50).fill("x").join("\n"));
      await page.locator("button[type=submit]").click();
      await page.waitForURL(/\/jokes\?/);
      assert.equal(writes.at(-1).payload.published, true);
      results.push({ language, theme, width, writes: writes.length });
    }
    assert.deepEqual(appErrors, []);
    await context.close();
  }
  await writeFile(path.join(output, "form-results.json"), JSON.stringify(results, null, 2));
});
