import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePostBody, getPostBodyError } from "../src/lib/postBody.ts";

test("body validation preserves formatting while normalizing CRLF and CR", () => {
  assert.equal(normalizePostBody("\r\nSetup\r\n\rPunchline\r"), "\nSetup\n\nPunchline\n");
  assert.equal(getPostBodyError("\r\nSetup\r\n\rPunchline\r"), null);
});

for (const ending of ["\n", "\r\n", "\r"]) {
  test(`body limits count normalized boundaries ${JSON.stringify(ending)}`, () => {
    assert.equal(getPostBodyError(Array(50).fill("x").join(ending)), null);
    assert.equal(getPostBodyError(Array(51).fill("x").join(ending)), "lines");
    assert.equal(getPostBodyError(`Setup${ending}${ending}Punchline`), null);
    assert.equal(getPostBodyError(`Setup${ending}${ending}${ending}Punchline`), "newlines");
  });
}
test("leading/trailing newlines and character boundaries are evaluated without trimming", () => {
  assert.equal(getPostBodyError("\n\nSetup\n\n"), null);
  assert.equal(getPostBodyError("\n\n\nSetup"), "newlines");
  assert.equal(getPostBodyError("Setup\r\n\r\r\n"), "newlines");
  assert.equal(getPostBodyError(Array(50).fill("x").join("\n") + "\n"), "lines");
  assert.equal(getPostBodyError("x".repeat(10000)), null);
  assert.equal(getPostBodyError("x".repeat(10001)), "characters");
  assert.equal(getPostBodyError("x".repeat(9998) + "\r\n\r\n"), null);
  assert.equal(getPostBodyError(" \r\n"), "required");
});

test("structured API body errors map to translation keys and retain unknown body errors", async () => {
  const { getPostBodyApiError } = await import("../src/lib/postBody.ts");
  assert.equal(getPostBodyApiError({ response: { data: { errors: [{ field: "body", message: "Body must have at most 50 logical lines" }] } } }), "lines");
  assert.equal(getPostBodyApiError({ response: { data: { errors: [{ field: "body", message: "Future rule" }] } } }), "invalid");
  assert.equal(getPostBodyApiError({ response: { data: { errors: [{ field: "title", message: "Title invalid" }] } } }), null);
  assert.equal(getPostBodyApiError(null), null);
});
