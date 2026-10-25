import assert from "node:assert/strict";
import { test } from "node:test";
import { moderateFields } from "../src/lib/moderation.ts";

test("clean joke text is not blocked by a term embedded inside a word", () => {
  const moderation = moderateFields(
    { title: "En faglig pappavits", body: "Denne handler om arbeidsdagen." },
    ["fag"],
  );

  assert.equal(moderation.blocked, false);
  assert.deepEqual(moderation.matches, {});
});

test("standalone and deliberately obfuscated blocked terms are still blocked", () => {
  assert.equal(moderateFields({ body: "Ikke skriv fag her" }, ["fag"]).blocked, true);
  assert.equal(moderateFields({ body: "Ikke skriv f.a.g her" }, ["fag"]).blocked, true);
});
