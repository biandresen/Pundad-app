import assert from "node:assert/strict";
import { test } from "node:test";
import { getCurrentBadgeValidity, isCurrentBadgeActive, pickPrimaryBadgeFromUser, resolveActiveBadgesFromUser } from "../src/lib/badges.ts";

const START = "2026-10-25T00:00:00.000Z";
const END = "2026-10-26T00:00:00.000Z";
const NOW = Date.parse("2026-10-25T12:00:00.000Z");
const badge = (overrides = {}) => ({ id: "award", badge: "TRENDING_WEEK", since: START, validTo: END, language: "NO", ...overrides });

test("daily badges share a UTC interval even when legacy expiry is absent", () => {
  assert.deepEqual(getCurrentBadgeValidity(badge({ badge: "JOKE_OF_DAY", since: "2026-10-25T23:30:00+02:00", validTo: null })), {
    from: Date.parse("2026-10-25T21:30:00Z"),
    to: Date.parse(END),
  });
});

test("active validity starts inclusively and expires exclusively at the API boundary", () => {
  assert.equal(isCurrentBadgeActive(badge(), "NO", Date.parse(START) - 1), false);
  assert.equal(isCurrentBadgeActive(badge(), "NO", Date.parse(START)), true);
  assert.equal(isCurrentBadgeActive(badge(), "NO", Date.parse(END) - 1), true);
  assert.equal(isCurrentBadgeActive(badge(), "NO", Date.parse(END)), false);
});

test("future validity and malformed dates never appear active", () => {
  assert.equal(isCurrentBadgeActive(badge({ since: END }), "NO", NOW), false);
  assert.equal(isCurrentBadgeActive(badge({ validFrom: END }), "NO", NOW), false);
  assert.equal(isCurrentBadgeActive(badge({ since: "invalid" }), "NO", NOW), false);
  assert.equal(isCurrentBadgeActive(badge({ validTo: "invalid" }), "NO", NOW), false);
});

test("non-expiring awards remain active and language-less legacy metadata is accepted", () => {
  assert.equal(isCurrentBadgeActive(badge({ validTo: null }), "NO", NOW), true);
  assert.equal(isCurrentBadgeActive(badge({ validTo: undefined, language: undefined }), "EN", NOW), true);
  assert.equal(isCurrentBadgeActive(badge({ language: "EN" }), "NO", NOW), false);
});

test("legacy Joke of the Day expires at UTC midnight rather than local midnight", () => {
  const legacy = badge({ badge: "JOKE_OF_DAY", since: "2026-10-25T23:30:00+02:00", validTo: null });
  assert.equal(isCurrentBadgeActive(legacy, "NO", Date.parse("2026-10-25T23:59:59.999Z")), true);
  assert.equal(isCurrentBadgeActive(legacy, "NO", Date.parse(END)), false);
});

test("resolving mixed current badges filters presentation without changing current rows or history", () => {
  const user = {
    role: "USER", dailyJokeStreak: 0,
    currentBadges: [
      badge(), badge({ id: "duplicate" }),
      badge({ id: "expired", badge: "JOKE_OF_DAY", validTo: START }),
      badge({ id: "future", badge: "TOP_CREATOR_MONTH", validFrom: END }),
      badge({ id: "english", badge: "MOST_COMMENTED_WEEK", language: "EN" }),
      badge({ id: "unknown", badge: "UNKNOWN" }),
    ],
    badgeAwards: [{ badge: "JOKE_OF_DAY", validTo: START }],
  };
  const original = structuredClone(user);
  assert.deepEqual(resolveActiveBadgesFromUser(user, "NO", NOW).map((item) => item.key), ["TRENDING_WEEK"]);
  assert.deepEqual(resolveActiveBadgesFromUser(user, "EN", NOW).map((item) => item.key), ["MOST_COMMENTED_WEEK"]);
  assert.deepEqual(user, original);
});

test("admin and established streak badges remain independent of content language", () => {
  const user = { role: "ADMIN", dailyJokeStreak: 7, currentBadges: [badge({ language: "EN" })] };
  assert.deepEqual(resolveActiveBadgesFromUser(user, "NO", NOW).map((item) => item.key), ["ADMIN", "STREAK"]);
  assert.equal(pickPrimaryBadgeFromUser(user, "NO", NOW)?.key, "ADMIN");
  assert.deepEqual(resolveActiveBadgesFromUser({ ...user, role: "USER", dailyJokeStreak: 6 }, "NO", NOW), []);
});

test("primary badge is chosen from valid awards by catalog priority", () => {
  const user = { role: "USER", dailyJokeStreak: 7, currentBadges: [
    badge(), badge({ badge: "TOP_CREATOR_MONTH", validTo: START }), badge({ badge: "JOKE_OF_DAY" }),
  ] };
  assert.equal(pickPrimaryBadgeFromUser(user, "NO", NOW)?.key, "JOKE_OF_DAY");
  assert.equal(pickPrimaryBadgeFromUser(null, "NO", NOW), null);
  assert.deepEqual(resolveActiveBadgesFromUser(undefined, "NO", NOW), []);
});

test("earned streak bonus awards are history-only and never become active avatar badges", () => {
  const bonus = badge({ badge: "STREAK_BONUS", validTo: null });
  assert.equal(isCurrentBadgeActive(bonus, "NO", NOW), false);
  assert.deepEqual(resolveActiveBadgesFromUser({ role: "USER", currentBadges: [bonus] }, "NO", NOW), []);
});
