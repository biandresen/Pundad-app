# Frontend release continuity — issue #199

## Baseline and evidence

Both dev worktrees use `fix/frontend-release-asset-recovery`. Remote refs were
refreshed before implementation. Frontend main
`0928c849d2eec5d1d5f3eb0d825e55deae3fec6f` has an empty tree diff against the
supplied feature tip `9a9aeb3bda2727c7ee85fb7c6b60620eb6840ec0`; backend main
`75bb57188087b6e5b37d083513de41b32811ce5a` likewise matches
`11ad9f99cf957cebc7aa29ef5502ac25f2993d7e`. The badge, leaderboard, Top Creator,
streak-bonus, and points-guide work is already present on main.

Before fixing delivery, Chromium held a real production build A open while an
isolated Nginx activated build B. Dashboard remained unloaded until navigation.
`DashboardLayout-Bb3r9iEm.js` then returned 404 and Chromium reported
`Failed to fetch dynamically imported module`. Keeping the previous directory
did not expose its files through the current release's asset root. Separate
real Nginx tests reproduced the same lookup gap in both original templates.

The service-worker fetch test also reproduced a successful HTML response being
cached at a script URL and returned for a later script request. This is a
verified cache-poisoning risk, not proof of the historical CSS response's source.
The readable installed production and staging virtual hosts already contained
`try_files $uri =404`, matching their source templates. Production's private
Nginx source template matched too; the private staging directory was unreadable.
No historical edge response or CDN cache configuration was available to establish
the original CSS-as-HTML cause. Live infrastructure was not changed.

## Behavior and limits

The deployers prepare one previous generation of native hashed assets inside
each new release, then switch `current` atomically. Nginx checks current assets,
then retained assets, then returns 404 with no-store. HTML and the worker require
revalidation; release/build metadata is no-store; successful hashed assets are
immutable. HTML, metadata, and other prior release files are never inherited.
The backend master deployment guide documents copy limits, protected cleanup,
environment isolation, installation, and rollback.

Each Vite artifact gets a unique build ID in its entry code, HTML metadata,
`__build.json`, and worker cache names. Recovery compares fresh build metadata
after a recognized dynamic-import or CSS preload failure. It reloads the same
URL only for a different artifact, with an online connection, no unsaved edits,
and a successfully persisted session-storage guard. The guard permits one
automatic recovery per tab session and is not cleared on reload or remount.
Blocked storage, offline operation, unchanged/invalid metadata, and repeated
failure show a translated fallback. Ordinary application exceptions never
trigger automatic deployment recovery.

Delivery failures keep the lazy component pending instead of rejecting through
an error boundary, allowing Suspense to retain the preceding mounted editor.
Existing unsaved-draft warnings also register dirty state. Changed connected
form controls conservatively suppress automatic reload, including editors
without that hook. Go back to save edits; retry or explicitly reload afterward.
Browser module failures may remain cached in a tab, so retry can still require
an explicit reload. A new tab has a separate automatic recovery allowance.

The worker precaches the matching entry dependencies and PWA shell without
eagerly downloading lazy dashboard code. It serves fresh network HTML online,
validates status/MIME before caching, keeps the current and one previous valid
build cache, and leaves ordinary activation free of page reloads.
Hashed assets use cache-first delivery; mutable static URLs revalidate online
and use validated cached responses offline, so same-URL avatar updates remain
visible. Offline navigation can use cached HTML and previously downloaded routes. A never-loaded
lazy route still requires connectivity. Legacy v1/v2 caches are discarded to
avoid retaining potentially poisoned responses. HTTP error pages do not replace
the offline shell. The existing Turnstile registration safeguard is preserved.

Retention is deliberately finite: clients older than the previous release and
clients from a failed candidate after rollback may need bounded recovery.
Rollback keeps the restored release's own asset generation and retained assets;
it does not mutate that release to absorb the failed candidate's files.

## Changed files

| Frontend file | Purpose |
| --- | --- |
| `vite.config.ts` | Generate artifact identity, HTML marker, worker entry precache list. |
| `src/vite-env.d.ts` | Type the build identity. |
| `public/sw.js` | Validate shell/assets, bound build caches, maintain offline support. |
| `src/registerServiceWorker.ts` | Bypass HTTP cache during worker update checks. |
| `src/lib/releaseRecovery.ts` | Classify delivery failures, check metadata, guard reloads, retain pending imports and dirty state. |
| `src/components/molecules/ReleaseRecoveryNotice.tsx` | Non-destructive translated retry/back/reload fallback. |
| `src/components/molecules/RouteErrorBoundary.tsx` | Contain ordinary route exceptions without automatic recovery or healthy-route remounts. |
| `src/components/molecules/LanguageRouteGate.tsx` | Keep editors mounted while adding the current language query parameter. |
| `src/App.tsx` | Apply recovery to lazy routes and mount fallbacks. |
| `src/main.tsx` | Track edited form fields before rendering. |
| `src/hooks/useUnsavedChangesWarning.ts` | Share draft dirty state with recovery. |
| `src/i18n/translations.ts` | NO/EN recovery text. |
| `test/service-worker.test.mjs` | Install, activate, fetch, offline, poison rejection, and Turnstile regressions. |
| `test/deployment.browser.mjs` | Two real production builds, isolated Nginx, retained assets and forced recovery. |
| `package.json`, `package-lock.json` | Browser command, pinned Playwright, Node types. |
| `.github/workflows/ci.yml` | Run the paired deployment/browser regression in CI. |
| `docs/testing/testing-strategy.md` | Repeatable browser invocation and dev/staging checklist. |
| `docs/testing/frontend-release-recovery.md` | Evidence, design, file map, and review record. |

| Backend file | Purpose |
| --- | --- |
| `ops/deploy/common.py` | Prepare bounded previous native assets, switch release links atomically, protect cleanup targets. |
| `ops/deploy/production.py`, `ops/staging/deploy.py` | Prepare retained assets before freezing and activating a release. |
| `ops/deploy/controller.py` | Use the tested cleanup helper with existing limits. |
| `ops/deploy/nginx.conf`, `ops/staging/nginx.conf` | Retained lookup, headers, missing-asset errors, explicit manifest MIME. |
| `ops/staging/provision.py` | Install staging's shared deployment-helper dependency. |
| `ops/deploy/tests/test_frontend_assets.py` | Retention, collision rejection, isolation, cleanup, activation and rollback. |
| `ops/deploy/tests/test_nginx_assets.py` | Real HTTP behavior using both Nginx templates. |
| `docs/development-deployment-guide.md` | Reviewed installation steps, rollback/cleanup policy and verified limits. |

## Standards

Independent review found no documented-standard violations and one minor
Duplicated Code judgment call: both fallbacks repeated translated messages.
Resolved through the existing translation catalog.

## Spec

Independent review found one defect against “Preserve unsaved work”: an
error-boundary key would remount healthy routes. The stable boundary now resets
only its failed state on navigation. The browser then found that the existing
language gate also unmounted routes when normalizing a missing language query
parameter. That URL-only correction now keeps the route tree mounted. Switching
to a different language retains the existing content-isolation gate. The
dirty-editor browser regression checks the real profile link, including query
normalization, and verifies that the preceding form and its text survive.

Review totals: Standards — 0 hard violations, 1 minor smell resolved;
Spec — 1 review defect resolved, no remaining blocking findings. Browser testing
also found and resolved the existing language-gate teardown described above.

A minor UI limitation remains: after returning from a failed route, its recovery
notice can briefly appear while another lazy route loads. It does not trigger
automatic navigation or remove the editor.

## Verification

Final results on 2026-10-25:

| Check | Result |
| --- | --- |
| Frontend `npm test` | All five test files passed, including 13 service-worker cases. |
| Frontend `npm run lint` | Passed. |
| Frontend `npm run build` | TypeScript and production Vite build passed. |
| Frontend `npm run test:deployment` | 8/8 real Chromium tests passed, 28.7 seconds. |
| Backend deployment suite | 22/22 passed, including both real isolated Nginx templates. |
| Backend `npm run lint` and changed Python compilation | Passed. |
| Both worktrees `git diff --check` | Passed. |

The browser run verified retained A assets without reloading, fresh B delivery,
JS/CSS status/MIME/cache policies, missing CSS rejection without cache poisoning,
one automatic recovery preserving the URL, repeated failure across explicit
reloads, blocked session storage, query/hash changes with an already pending
import, NO/EN fallbacks, ordinary module errors, dirty editor preservation and
Go back restoration, and visited Home rendering offline. It uses fixture API
responses; real authentication, Turnstile, authoring/moderation and badge/streak
smokes remain on the dev/staging checklist, not claimed as completed here.

On this minimal host, Chromium's missing runtime libraries and fonts were
extracted under `/tmp` without system installation. The final local invocation
used these environment overrides (temporary paths may need recreating later):

```bash
PATH=/opt/pundad/node-v24.12.0/bin:$PATH \
LD_LIBRARY_PATH=/tmp/pundad-browser-libs/extracted/usr/lib/aarch64-linux-gnu \
FONTCONFIG_FILE=/tmp/pundad-browser-libs/fonts.conf \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/pi/.cache/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux-arm64/chrome-headless-shell \
npm run test:deployment
```

The test required sandbox permission for temporary loopback listeners. It used
an isolated Nginx process and left no fixture processes running. CI installs its
own matching Playwright Chromium and dependencies; CI itself has not run for
these uncommitted changes.

Run the frontend checks with Node 24.12.0: `npm test`, `npm run lint`,
`npm run build`, and `npm run test:deployment`. The browser command needs the
paired backend checkout, Nginx, Chromium, and its runtime libraries; see the
testing strategy. Deployment-policy/retention/HTTP checks run with
`python3 -m unittest discover -s ops/deploy/tests` in the backend worktree.
Application runtime behavior is untouched, so the full backend application
suite is not required for this deployment-only change.

This change is prepared for dev review only. Installed helpers, private Nginx
source configuration, and both actual virtual hosts must be updated together
through a separately authorized operator step. Validate `nginx -t` before a
graceful reload. Deliver the new frontend via the existing verified artifact
path after the tooling is installed. Confirm public edge headers separately;
isolated tests cannot establish live edge caching. No deployment, restart,
commit, push, PR, merge, or issue closure is part of this implementation.
