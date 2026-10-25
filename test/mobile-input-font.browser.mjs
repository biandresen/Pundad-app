import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

// API fixtures isolate every account and content operation from real services.
const user = { id: 202, username: "font-tester", email: "font@example.test", role: "ADMIN", preferredLanguage: "NO", points: 0 };
const joke = { id: 202, authorId: 202, title: "Typography fixture", body: "A fixture joke for checking form layout.",
  published: true, createdAt: "2026-10-25T12:00:00Z", changedAt: "2026-10-25T12:00:00Z",
  user, likes: [], comments: [], tags: [] };
const comment = { id: 203, authorId: 202, jokeId: 202, body: "Fixture comment", user,
  createdAt: joke.createdAt, changedAt: joke.changedAt };
const scenarios = [
  ["login", "/login", "#password", ["userInput", "password"]],
  ["register", "/register", "#username", ["username", "email", "password", "passwordConfirmation"]],
  ["forgot-password", "/forgotPassword", "#email", ["email"]],
  ["reset-password", "/reset-password/fixture-token", "input[type=password]", ["password", "passwordConfirmation"]],
  ["resend-verification", "/resend-verification", "#email", ["email"]],
  ["contact", "/contact", "textarea", ["contactName", "contactEmail"]],
  ["new-joke", "/dashboard/new-joke", "#body", ["jokeTitle", "body", "tags"]],
  ["profile", "/dashboard/profile", "#newPassword", ["username", "email", "newPassword"]],
  ["admin", "/dashboard/admin", "#userInput", ["userInput"]],
  ["moderation", "/dashboard/admin", "#moderation-search", ["moderation-search"]],
  ["joke-edit", "/jokes/202", "textarea"],
  ["comments", "/jokes/202", "textarea"],
  ["comment-edit", "/jokes/202", "textarea"],
  ["search", "/jokes/search", "input[type=text]"],
  ["leaderboard", "/jokes/leaderboard", "select"],
];

test("mobile placeholders grow without reducing entered text or changing desktop typography", { timeout: 600_000 }, async (t) => {
  const before = process.env.PUNDAD_FONT_BASELINE === "1";
  const phase = before ? "before" : "after";
  const output = path.resolve("output/playwright/mobile-input-font");
  await mkdir(output, { recursive: true });
  const server = await createServer({ server: { host: "127.0.0.1", port: 0, strictPort: false } });
  let browser, activePage, completed = false;
  t.after(async () => {
    if (!completed && activePage && !activePage.isClosed()) {
      await activePage.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
      await writeFile(path.join(output, "failure.html"), await activePage.content()).catch(() => {});
    }
    await browser?.close();
    await server.close();
  });
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? chromium.executablePath(),
    headless: true, args: ["--no-sandbox"],
  });
  const results = [], errors = [];
  for (const language of ["no", "en"]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: "block" });
      await context.addInitScript(theme => {
        localStorage.setItem("color-theme", theme);
        localStorage.setItem("dadjokes_seen_nav_hint", "1");
      }, theme);
      let signedIn = false;
      await context.route("**/api/v1/**", route => {
        const url = new URL(route.request().url());
        const endpoint = url.pathname.replace("/api/v1", "");
        let data = [];
        if (endpoint === "/auth/refresh") data = signedIn ? "font-fixture-token" : null;
        else if (endpoint === "/user/me") data = user;
        else if (endpoint === "/jokes/202") data = joke;
        else if (endpoint.includes("comments")) data = [comment];
        else if (endpoint === "/moderation/cache") data = { count: 0, termsLoaded: true, lastLoadedAt: null };
        return route.fulfill({ json: { statusCode: endpoint === "/auth/refresh" && !signedIn ? 204 : 200, data, count: Array.isArray(data) ? data.length : 0 } });
      });
      // Registration's external anti-bot widget is outside this typography seam.
      await context.route("https://challenges.cloudflare.com/**", route => route.fulfill({ body: "", contentType: "application/javascript" }));
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      page.on("dialog", dialog => dialog.accept());
      activePage = page;
      completed = false;
      for (const width of [320, 390, 767, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [name, route, ready, targets = []] of scenarios) {
          if (process.env.PUNDAD_FONT_FOCUS && !process.env.PUNDAD_FONT_FOCUS.split(",").includes(name)) continue;
          signedIn = route.startsWith("/dashboard") || route === "/jokes/202";
          await page.goto(`${origin}${route}?lang=${language}`);
          if (name === "moderation") await page.getByRole("button", { name: language === "no" ? "Moderering" : "Moderation", exact: true }).click();
          if (name === "joke-edit") {
            const edit = page.getByTitle(language === "no" ? "Rediger vits" : "Edit joke", { exact: true });
            await edit.click();
            await edit.last().click();
          }
          if (name === "comments" || name === "comment-edit") {
            await page.getByTitle("Toggle comments").click();
            if (name === "comment-edit") {
              await page.getByText("Fixture comment", { exact: true }).waitFor();
              await page.getByTitle(language === "no" ? "Rediger kommentar" : "Edit comment", { exact: true }).click();
            }
          }
          await page.locator(ready).first().waitFor();
          await page.evaluate(async () => {
            await document.fonts.load('16px "Baloo 2"');
            await document.fonts.load('16px "Inter"');
            await document.fonts.ready;
          });
          const layout = await page.evaluate(() => {
            const controls = [...document.querySelectorAll("main input, main textarea, main select")]
              .filter(el => el.getBoundingClientRect().width && !["checkbox", "file", "hidden"].includes(el.type));
            return {
              controls: controls.map(el => {
                const s = getComputedStyle(el), p = getComputedStyle(el, "::placeholder"), b = el.getBoundingClientRect();
                return { id: el.id, tag: el.tagName, type: el.type, placeholder: el.getAttribute("placeholder"),
                  text: parseFloat(s.fontSize), hint: parseFloat(p.fontSize), lineHeight: s.lineHeight,
                  padding: s.padding, width: b.width, height: b.height, clientHeight: el.clientHeight,
                  x: b.x, right: b.right, value: el.value };
              }),
              overflow: document.documentElement.scrollWidth > innerWidth,
              fonts: [...document.fonts].filter(font => font.status === "loaded").map(font => font.family),
              dark: document.documentElement.classList.contains("dark"),
            };
          });
          assert.ok(layout.fonts.includes("Baloo 2") && layout.fonts.includes("Inter"), "Load the actual application fonts");
          assert.equal(layout.dark, theme === "dark");
          assert.ok(layout.controls.length, `${name} must expose controls`);
          assert.equal(layout.overflow, false, `${name} at ${width}px: no horizontal page scrolling`);
          for (const id of targets) {
            const control = layout.controls.find(c => c.id === id);
            assert.ok(control, `${name}: missing ${id}`);
            const enteredSize = id === "body" ? (width < 768 ? 16 : 24)
              : id === "tags" ? (width < 768 ? 14 : 20)
              : id === "jokeTitle" && width >= 768 ? 24 : width < 768 ? 18 : 20;
            assert.equal(control.text, enteredSize, `${name} ${id}: preserve entered text size`);
            const expected = width < 768 ? (before ? 11.2 : 14.4) : 16;
            assert.ok(Math.abs(control.hint - expected) < 0.01, `${name} ${id} at ${width}px: placeholder ${control.hint}px, expected ${expected}px`);
          }
          // Literal existing sizes keep preservation checks effective without local artifacts.
          const unchangedSizes = {
            contact: width < 768 ? [18, 18, 12, 18] : [20, 20, 14, 18],
            moderation: width < 768 ? [18, 16, 18, 16, 16] : [20, 16, 20, 16, 16],
            "joke-edit": width < 768 ? [20, 14, 14] : [30, 18, 18],
            comments: [width < 768 ? 14 : 18],
            "comment-edit": width < 768 ? [14, 14] : [18, 18],
            search: [width < 1024 ? 18 : 24],
            leaderboard: [16],
          };
          for (const [index, control] of layout.controls.entries()) {
            if (!targets.includes(control.id)) {
              const expected = unchangedSizes[name]?.[index];
              assert.equal(control.text, expected, `${name}: preserve entered text size`);
              assert.equal(control.hint, control.id === "contactMessage" ? 14.4 : expected, `${name}: preserve larger placeholder size`);
            }
            assert.ok(control.text > 11.2, `${name}: preserve larger entered text`);
            if (control.tag !== "SELECT") {
              const verticalPadding = control.padding.split(" ").map(parseFloat);
              assert.ok(control.clientHeight >= control.text + verticalPadding[0], `${name}: text must fit vertically`);
            }
          }
          const key = `${name}-${language}-${theme}-${width}`;
          results.push({ key, ...layout });
          if (["login", "register", "new-joke", "profile", "moderation", "joke-edit", "comments"].includes(name) && [320, 390, 768].includes(width)) {
            await page.locator(ready).first().scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, `${phase}-${key}.png`) });
          }
          if (name === "profile") {
            await page.locator("#newPassword").fill("Fixture-password-202!");
            const currentPassword = page.locator("#currentPassword");
            await currentPassword.waitFor();
            const style = await currentPassword.evaluate(el => ({ text: parseFloat(getComputedStyle(el).fontSize),
              hint: parseFloat(getComputedStyle(el, "::placeholder").fontSize), paddingRight: getComputedStyle(el).paddingRight }));
            assert.equal(style.text, width < 768 ? 18 : 20);
            assert.equal(style.paddingRight, width < 768 ? "8px" : "52px");
            assert.ok(Math.abs(style.hint - (width < 768 ? (before ? 11.2 : 14.4) : 16)) < 0.01);
            const placeholderFits = await currentPassword.evaluate(el => {
              const style = getComputedStyle(el), hint = getComputedStyle(el, "::placeholder");
              const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
              context.font = `${hint.fontWeight} ${hint.fontSize} ${hint.fontFamily}`;
              return { measured: context.measureText(el.placeholder).width, available: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), padding: style.padding };
            });
            if (width < 768) assert.ok(placeholderFits.measured <= placeholderFits.available + 1, `Full current-password placeholder must fit at ${width}px: ${JSON.stringify(placeholderFits)}`);
            const toggle = page.getByRole("button", { name: language === "no" ? "Vis passord" : "Show password", exact: true }).first();
            await toggle.click();
            assert.equal(await currentPassword.getAttribute("type"), "text");
            await page.getByRole("button", { name: language === "no" ? "Skjul passord" : "Hide password", exact: true }).first().click();
            assert.equal(await currentPassword.getAttribute("type"), "password");
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            if ([320, 390, 768].includes(width)) {
              await currentPassword.scrollIntoViewIfNeeded();
              await page.screenshot({ path: path.join(output, `${phase}-${key}-current-password.png`) });
            }
          }
          if (name === "profile") {
            await page.locator("#currentPassword").fill("Fixture-current-202!");
            assert.equal(await page.locator("#currentPassword").evaluate(el => getComputedStyle(el).paddingRight), "52px",
              "Populated profile field preserves validation-icon space");
          }
          if (name === "login" && [320, 390].includes(width)) {
            await page.locator("#userInput").fill("font-tester");
            await page.locator("#password").fill("Fixture-password-202!");
            for (const id of ["userInput", "password"]) {
              const spacing = await page.locator(`#${id}`).evaluate(el => {
                const icon = el.parentElement.querySelector("svg");
                const bounds = el.getBoundingClientRect(), style = getComputedStyle(el);
                return { text: parseFloat(style.fontSize), contentRight: bounds.right - parseFloat(style.paddingRight),
                  iconLeft: icon?.getBoundingClientRect().left };
              });
              assert.equal(spacing.text, 18);
              assert.ok(spacing.iconLeft && spacing.contentRight < spacing.iconLeft, "Entered text leaves room for validation icons");
            }
            await page.locator("#password").scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, `${phase}-${key}-populated.png`) });
          }
        }
      }
      console.log(`Verified ${language} ${theme}: ${results.length} cumulative form/viewport checks`);
      completed = true;
      await context.close();
    }
  }
  await writeFile(path.join(output, `${phase}${process.env.PUNDAD_FONT_FOCUS ? "-focused" : ""}.json`), JSON.stringify({ browser: browser.version(), results, errors }, null, 2));
  assert.deepEqual(errors, [], "No application errors");
  if (!before && !process.env.PUNDAD_FONT_FOCUS) {
    const baseline = await readFile(path.join(output, "before.json"), "utf8").then(JSON.parse).catch(error => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (baseline) {
      for (const current of results) {
        const previous = baseline.results.find(row => row.key === current.key);
        assert.ok(previous, `Baseline contains ${current.key}`);
        assert.equal(current.overflow, previous.overflow, `${current.key}: no new page overflow`);
        assert.equal(current.controls.length, previous.controls.length);
        current.controls.forEach((control, index) => {
          const old = previous.controls[index];
          const expected = old.hint === 11.2 ? 14.4 : old.hint;
          assert.ok(Math.abs(control.hint - expected) < 0.01, `${current.key}: only matching placeholders change`);
          assert.equal(control.padding, old.padding, `${current.key}: preserve padding`);
          for (const property of ["text", "lineHeight", "width", "height", "x", "right"]) {
            assert.equal(control[property], old[property], `${current.key}: preserve ${property}`);
          }
        });
      }
    }
  }
});
