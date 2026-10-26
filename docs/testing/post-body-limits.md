# Post body limits — issue #201

Prepared on 2026-10-26 for review. Commits, pushes and paired pull requests
were subsequently authorized by the user.

## Baseline and reproduction

Both clean dev worktrees refreshed remote refs before creating
`fix/post-body-newline-limits` from `origin/main`. Frontend baseline:
`39aa4e91aa519595096cdf4d8a6310d39433fea4`; backend baseline:
`4ef25e420d7503004241c03b3dee0b421b9693bb`. GitHub confirmed frontend PRs
#207, #209 and #210 are merged and included. Existing branches and worktrees
were preserved. Issue #201 had no comments or linked implementation work.

Before source changes, real Chromium with intercepted API fixtures rendered a
97-character, 49-line joke body at 980px tall on a 390px viewport, without
Read more. A create form containing three consecutive newlines still enabled
publishing. Evidence: `output/playwright/body-limits/before.json`,
`before-legacy-390.png`, and `before-form-390.png`.

## Contract and exact semantics

Public users can read collapsed/expanded jokes. Authenticated owners create,
save, edit and publish posts/drafts through `/api/v1/jokes` (POST),
`/api/v1/jokes/:id` (PATCH), and `/api/v1/jokes/:id/publish` (PATCH).
The existing auth/ownership and language rules remain in place. Frontend
requests carry the access token and `X-App-Language`.

Replace CRLF with LF and standalone CR with LF before evaluating any limit.
Do not trim or flatten body text. Preserve leading/trailing spaces and valid
newlines in requests and storage. A nonempty body must contain non-whitespace
text; an empty/whitespace-only body is invalid.

The character limit remains 10,000, measured in JavaScript UTF-16 code units,
matching the existing frontend counter. CRLF counts as one normalized character.
Logical lines equal the number of LF characters plus one. Empty lines at either
edge count: `x\n` has two lines, and a 50-line body followed by LF has 51.
Exactly 50 lines pass; 51 fail. Two consecutive LF characters pass; three fail,
including at either edge and when formed by mixed CRLF/CR/LF input. Whitespace
inside a line does not turn it into an additional newline. Errors are reported
in order: required body, character overflow, line overflow, consecutive newlines.

Both route validation and the service write boundary enforce these rules.
The separate draft-publish endpoint validates the stored body before publishing,
so legacy invalid drafts must first be repaired. It conditions publication on
the inspected stored body to avoid publishing a concurrently changed draft.
Rejected requests return HTTP 400 with `errors: [{ field: "body", message }]`
and do not write content, tags or publish state. No schema migration is needed.

Create and edit forms show inline NO/EN body errors, associate them with the
textarea, retain invalid text for correction and disable server submission while
invalid or saving. Body Enter presses insert line breaks; title/tag Enter
shortcuts still submit through validation. Real clipboard paste follows the
same rules. Over-limit character input is retained with an error instead of
silently truncated; the existing counter remains and is labelled Characters/Tegn.
Known API body messages map to translated errors; unknown body errors use a
translated body-specific fallback. Local browser recovery autosave still
preserves unsent text, including invalid text, so users can recover and correct
it. It does not persist a server draft.

All full joke cards use `Joke.tsx`, including feeds, single posts and drafts.
Title-only `JokePreviewCard` never renders a body. There was a 600-character
preview threshold but no existing line limit. Collapsed full cards now use six
rendered lines to keep mobile cards bounded, while retaining that character
threshold. Logical line count also enables Read more; ResizeObserver detects
wrapped text overflow below 600 characters. Expand shows the complete normalized
body, and Show less restores containment. Normal paragraphs retain their line
breaks. No comment limits or comment behavior changed.

## File map

| Repository/file | Responsibility |
| --- | --- |
| Frontend `src/lib/postBody.ts` | Normalization, public validation and API body-error translation keys. |
| Frontend `src/routes/pages/dashboard/NewJoke.tsx` | Create/publish/save eligibility, inline errors and preserved body formatting. |
| Frontend `src/components/organisms/Joke.tsx` | Draft/post editing, body errors and bounded previews with expansion. |
| Frontend `src/i18n/translations.ts` | NO/EN body-specific messages and character counter labels. |
| Frontend `test/post-body.test.mjs` | Public validation and API-error mapping boundaries. |
| Frontend `test/post-body.browser.mjs` | Fixture-backed real Chromium form and rendering regressions. |
| Frontend `docs/testing/post-body-limits.md` | Contract, evidence and handoff. |
| Backend `src/utils/postBody.js` | Shared body rules and structured service validation. |
| Backend `src/validation/postBodyValidator.js` | Express body validation followed by normalization. |
| Backend `src/validation/newJokeValidator.js`, `updateJokeValidator.js` | Shared validator for all create/update requests. |
| Backend `src/services/jokeService.js` | Authoritative create, update and stored-draft publication checks. |
| Backend `test/post-body.test.js` | Public normalization and limit boundaries. |
| Backend `test/post-body.integration.test.js` | Real HTTP responses and persistence readback in disposable schemas. |

## Verification

Use Node 24.12.0 from each repository's `.nvmrc`.

Final checks passed:

| Check | Result |
| --- | --- |
| Frontend `npm test` | All six test files passed. |
| Frontend lint, TypeScript and production build | Passed. |
| Backend full `npm test` with disposable PostgreSQL | 114 tests passed; no skips. |
| Backend lint, Prisma validate and generate | Passed. |
| New Chromium body regressions | Both tests passed: 48 preview cases, feed/draft cards, and 12 form configurations. |
| Existing mobile typography regression, focused on new-joke/joke-edit | 40 configurations passed across NO/EN, light/dark and 320/390/767/768/1280px. |
| Core browser smoke with isolated auth fixtures | NO/EN Home/public navigation, logged-out protected redirect, login, reload/session restore and logout passed; no page errors. |
| Both worktrees `git diff --check` | Passed. |

Screenshots were visually inspected at representative mobile widths, including
collapsed previews and translated create/edit errors. The edit screenshots scroll
the error and submission controls into view inside the app's scrolling layout.

Frontend: `npm test`, `npm run lint`, `npx tsc -b`, `npm run build`, and
`node --test test/post-body.browser.mjs`.

Backend: `npm test`, `npm run lint`, `npx prisma validate`,
`npx prisma generate`. The backend has no typecheck or build script.
Supply a disposable `TEST_DATABASE_URL` ending in `_test` to run all integration
suites, following `docs/badge-leaderboard-testing.md`. This verification created
a fresh PostgreSQL cluster in `/tmp/pundad-body-pg` on loopback port 55432;
each suite migrated and dropped its own random schema. No application env file,
real database, account, service configuration or shared migration was used.

Browser tests start their own loopback Vite server and intercept every API
request. They assert actual paste with clipboard permissions and Control+V,
keyboard Enter, disabled submissions, normalized payloads, translated backend
errors, draft create/update, published edit, publishing, 50/51-line and
10,000/10,001-character form boundaries. Rendering checks measure visible
geometry and test full expansion/collapse, normal paragraphs, legacy blank-line
spam, character-long and short wrapped bodies, feeds and draft cards. The matrix
covers NO/EN, light/dark, 320px/390px/1280px, font loading, horizontal overflow
and edit error/control separation.

Local Chromium requires these existing host-specific overrides:

```sh
PATH=/opt/pundad/node-v24.12.0/bin:$PATH \
LD_LIBRARY_PATH=/tmp/pundad-browser-libs/extracted/usr/lib/aarch64-linux-gnu \
FONTCONFIG_FILE=/tmp/pundad-browser-libs/fonts.conf \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/pi/.cache/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux-arm64/chrome-headless-shell \
node --test test/post-body.browser.mjs
```

Artifacts are ignored local files under `output/playwright/body-limits/`:
`after-preview-{no,en}-{light,dark}-{320,390,1280}.png`,
`after-form-...png`, `after-edit-...png`, `preview-results.json`,
`form-results.json`, and `smoke-results.json`. Before/after screenshots use the
real app with fixture data.
Failure artifacts from intermediate runs are diagnostic, not final results.

## Review and landing

The code-review skill ran independent Standards and Spec agents over both
working diffs, including untracked files, against the pinned baseline commits.
Standards: no documented-standard violations; the reviewers found an accidental
comment-handler edit and a repeated character-limit literal, both corrected.
An optional browser fixture setup duplication remains localized to two tests.
Spec: the same comment-handler edit was the only implementation finding and was
verified restored to baseline. No remaining implementation findings were found.

Land the backend first so every client is covered immediately, then the frontend
for matching validation and rendering. No API response shape or migration
coordination is needed. Existing invalid posts are contained, not rewritten;
invalid drafts/posts require correction before their next write/publication.

Chromium fixtures cannot establish Safari/Firefox rendering or real staging
login, logout, cookie refresh, email, Turnstile, workers or deployment behavior.
Those unchanged integrations remain normal dev/staging smoke checks. No live
accounts or services were used. Commits, pushes and paired pull requests are
authorized for review. Merging, issue closure, deployment and shared migrations
remain outside this work.
