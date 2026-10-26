import { MAX_CHARS } from "./constants.ts";

export function normalizePostBody(body: string): string {
  return body.replace(/\r\n?/g, "\n");
}

export type PostBodyError = "required" | "characters" | "lines" | "newlines";

// Every normalized LF starts a logical line, including at the edges.
// Preserve whitespace: trimming must never make an invalid body pass.
export function getPostBodyError(body: string): PostBodyError | null {
  if (!body.trim()) return "required";
  const normalized = normalizePostBody(body);
  if (normalized.length > MAX_CHARS.BODY) return "characters";
  if (normalized.split("\n").length > 50) return "lines";
  if (/\n{3}/.test(normalized)) return "newlines";
  return null;
}

// Existing API validation errors expose a body field and an English message.
// Keep translation at the UI boundary, including unknown future body errors.
export function getPostBodyApiError(error: unknown): PostBodyError | "invalid" | null {
  const errors = (error as { response?: { data?: { errors?: unknown } } })?.response?.data?.errors;
  if (!Array.isArray(errors)) return null;
  const bodyError = errors.find((item: { field?: string }) => item?.field === "body");
  if (!bodyError) return null;
  const messages: Record<string, PostBodyError> = {
    "Body cannot be empty": "required",
    "Text is too long. Max 10000 characters": "characters",
    "Body must have at most 50 logical lines": "lines",
    "Body must not contain three consecutive newlines": "newlines",
  };
  return messages[bodyError.message] ?? "invalid";
}
