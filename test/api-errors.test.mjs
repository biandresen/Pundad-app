import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeApiError } from "../src/lib/normalizeApiError.ts";

test("rate-limit responses preserve the API message, code, and retry countdown", () => {
  const error = normalizeApiError({ response: {
    status: 429,
    data: { message: "Please wait", retryAfter: 120, code: "RATE_LIMITED" },
  } });
  assert.equal(error.message, "Please wait");
  assert.equal(error.status, 429);
  assert.equal(error.retryAfter, 120);
  assert.equal(error.code, "RATE_LIMITED");
  assert.equal(error.isNetworkError, false);
});

test("Retry-After headers are converted from strings to seconds", () => {
  const error = normalizeApiError({ response: {
    status: 429, data: {}, headers: { "retry-after": "30" },
  } });
  assert.equal(error.retryAfter, 30);
});

test("invalid retry countdowns do not expose NaN to the UI", () => {
  const error = normalizeApiError({ response: {
    status: 429, data: { retryAfter: "invalid" },
  } });
  assert.equal(error.retryAfter, undefined);
});

test("body-only API status codes still represent server responses", () => {
  const error = normalizeApiError({ response: {
    data: { statusCode: 403, message: "Email not verified", code: "EMAIL_NOT_VERIFIED" },
  } });
  assert.equal(error.statusCode, 403);
  assert.equal(error.code, "EMAIL_NOT_VERIFIED");
  assert.equal(error.isNetworkError, false);
});

test("network errors keep their message and are distinguishable from API rejections", () => {
  const error = normalizeApiError(new Error("Network Error"));
  assert.equal(error.message, "Network Error");
  assert.equal(error.isNetworkError, true);
  assert.equal(error.status, undefined);
});
