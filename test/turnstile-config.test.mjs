import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const TEST_SITE_KEY = "1x00000000000000000000AA";

function readEnv(path) {
  return Object.fromEntries(
    readFileSync(new URL(path, import.meta.url), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

test("development uses Cloudflare's public test site key", () => {
  const development = readEnv("../.env.development");
  assert.equal(development.VITE_TURNSTILE_SITE_KEY, TEST_SITE_KEY);
});

test("production builds use a real public site key and never contain a secret", () => {
  const production = readEnv("../.env.production");
  assert.match(production.VITE_TURNSTILE_SITE_KEY, /^0x/);
  assert.notEqual(production.VITE_TURNSTILE_SITE_KEY, TEST_SITE_KEY);
  assert.equal(production.TURNSTILE_SECRET_KEY, undefined);
  assert.equal(production.VITE_TURNSTILE_SECRET_KEY, undefined);
});
