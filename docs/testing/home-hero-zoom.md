# Home hero zoom regression (#208)

Date: 2026-10-25. Branch: `fix/home-hero-zoom`. Base: `6faa5e1` (`origin/main`).
Scope: public home route, including the signed-in CTA. No API contract, stored
data, backend, shared utility, or deployment changes.

## Confirmed cause and fix

Actual page zoom changes the CSS viewport. In a fixed 1817 × 1043 Chromium
window (1817 × 956 page area at 100%), reducing zoom to 50% changes `innerWidth`
from 1817 to 3634. Tailwind's generated `.container` remains capped at 96rem
(1536px); its preceding caps are 40, 48, 64, and 80rem. The custom `.container`
adds 1rem padding and automatic horizontal margins, without removing those caps.

The original illustration and font sizes continued growing with `vw`, inside
that capped container. The image retained its requested width while the flex
text section absorbed the lost space. `md:w-full` did not give the text a full
container alongside the image. Fixed line heights then squeezed the wrapped
heading and paragraph. `.nav-link` continued using rem-based padding and 20px
desktop text, making the proportions diverge further.

| Computed CSS measurement | Before 100% | Before 75% | Before 50% | After 100% | After 75% / 50% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Container width | 1536px | 1536px | 1536px | 1536px | 1536px |
| Illustration width | 438px | 511px | 656px | 438px | 440px |
| Heading font / line height | 56 / 36px | 65 / 36px | 83 / 36px | 56 / 61.6px | 56 / 61.6px |
| Paragraph font / line height | 32.6 / 40px | 38.6 / 40px | 50.7 / 40px | 32.6 / 45.6px | 32.8 / 45.9px |
| Text column width | 1046px | 973px | 828px | 1046px | 1044px |

`Home.tsx` now bounds the fluid font, image, and margin sizes with rem maxima,
uses font-relative line heights, gives the text the remaining flex space with
`min-width: 0`, and preserves the image's intrinsic ratio with automatic height.
The desktop image is also bounded by the container's available width. At 100%,
the illustration dimensions and text-column width are unchanged; the heading
font differs by less than 0.1px. Readable line spacing adds a small amount of
vertical space. At 50%, the image renders about 220px wide on screen, rather
than the original 328px. No zoom detection, transforms, or counter-scaling.

## Browser verification

Chromium 155.0.8059.12 on Linux ARM64, full Chromium in headless mode. Actual
page zoom was set using a temporary local extension's `chrome.tabs.setZoom`,
and read back with `getZoom`. Outer window dimensions stayed at 1817 × 1043
through each desktop comparison. The effective CSS viewport and DPR changed
together; neither viewport resizing nor `deviceScaleFactor` simulated zoom.
Fonts (Baloo 2 and Inter) and decoded images were awaited before measurement.

The focused browser regression first failed on the original 50% heading:
`font: 83.31px, lineHeight: 36px`. It now passes all 38 scenarios (39 Node test
results including the parent):

- Actual 100%, 75%, 50%, 125%, and 200% page zoom, in NO/EN and dark/light.
- Signed-in NO/EN CTA and session restoration; signed-out CTAs throughout.
  `MIN SIDE` / `DASHBOARD` still link to `/dashboard`; `REGISTRER` / `REGISTER`
  link to `/register`; `FINN VITSER` / `FIND JOKES` link to `/jokes/daily-joke`.
- 320, 390, 768, and 1024px responsive widths at 100%, in both languages/themes.
- Font-relative line spacing, text wrapping within bounds, image aspect ratio,
  separation between image/text/CTAs, horizontal overflow, and CTA reachability.
- No browser page or console errors during the matrix.

The testing-strategy core smoke flow also passed with local API fixtures:
login form to daily joke, header/navigation/sidebars, home session restore after
reload, logout, unauthenticated dashboard redirect to login, public About, and
the signed-out home CTA. This flow finished without browser errors.

`npm test` (all 5 existing test files), `npm run lint`, `npm run build` (including
TypeScript), and `git diff --check` pass.

## Reproduction and artifacts

Use Node from `.nvmrc` (24.12.0), install full Playwright Chromium and its runtime
dependencies, then run `npm run test:hero`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
to use an existing full Chromium binary. The test starts an isolated local Vite
server and fixtures every `/api/v1/` request. Google Fonts network access is
required; the test explicitly checks both actual web fonts loaded.

On this Pi, verification used `/opt/pundad/node-v24.12.0/bin` on `PATH`,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/pi/.cache/ms-playwright/chromium-1247/chrome-linux-arm64/chrome`,
`LD_LIBRARY_PATH=/tmp/pundad-browser-libs/extracted/usr/lib/aarch64-linux-gnu`,
and `FONTCONFIG_FILE=/tmp/pundad-fonts.conf`. Extra browser libraries were
extracted under `/tmp`; no system packages or live configuration were changed.

Artifacts are local and Git-ignored under `output/playwright/home-hero-zoom/`:

- `before-no-dark-{100,75,50}.png`: original revision, actual zoom, fixed window.
- `after-{no,en}-{dark,light}-{100,75,50,125,200}.png`: corrected desktop matrix.
- `after-{no,en}-dark-signed-in.png`: signed-in home CTAs.
- `after-{no,en}-{dark,light}-{320,390,768,1024}px.png`: responsive matrix.
- `before.json`, `after.json`, `verification.json`: computed measurements.
- `generated-rules.txt`: inspected generated container and button rules.
- `browser-test.log`: complete focused regression results.
- `smoke-cli.txt`: fixture-based core smoke checks and results.

Baseline screenshots were captured before editing, then recaptured from an
isolated copy of the original revision in the same window to eliminate white
padding from Playwright's CSS-viewport screenshot canvas at reduced zoom. The
regression uses CDP's physical browser-surface capture for the same reason.

## Independent code review

| Standards axis | Specification axis |
| --- | --- |
| No documented-standard violations or actionable code smells. | No implementation or scope findings. |
| Rendered-behavior regression follows the testing strategy. | Baseline theme and hovered-CTA screenshot findings were corrected and independently rechecked. |

Final result: 0 remaining findings on either axis. The affected browser matrix
was rerun after the screenshot corrections: all 38 scenarios passed again.

Limitations: Chromium coverage only; Firefox, Safari, other OS display scaling,
and real mobile devices have not been checked. Authentication uses fixtures;
this does not validate real credentials or backend auth behavior.
