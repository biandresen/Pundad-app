# Mobile form placeholder typography — issue #202

Date: 2026-10-25 (Europe/Oslo)
Branch: `fix/mobile-input-font-size`, based on `origin/main` at `0e47cc4`.

## Contract and audit

Only form text or placeholders rendering at 0.7rem below 768px should grow to
0.9rem. Larger entered text and all typography at 768px and above must remain
unchanged. This is presentation only: public, user, and admin forms keep their
existing requests, validation, authorization, and language behavior.

The complete `src` audit found three matching placeholder declarations:

- `components/atoms/Input.tsx`: shared account, recovery, verification, contact,
  profile, new-joke title/tags, and admin controls.
- `routes/pages/Login.tsx`: the separate password input.
- `routes/pages/dashboard/NewJoke.tsx`: the body textarea.

These rules use `md:placeholder:text-[1rem]`; retain that override. Shared inputs
have larger entered text (typically 18px mobile, 20px desktop), and the new-joke
body uses 16px mobile, 24px desktop. Keep those sizes. Inputs without a placeholder
attribute do not render a placeholder. The admin user lookup and profile identity
fields use empty placeholders. Joke/comment editing, comment creation, search,
contact textareas/selects, and moderation/leaderboard selects use larger sizes.

The other 0.7rem occurrences belong to joke/comment dates and avatar badges;
leave them unchanged. There is no global font-size override to change.

`routes/pages/dashboard/Profile.tsx` adds a spacing adjustment because the
larger Norwegian current-password placeholder needed more horizontal room at
320px. Only the empty profile current-password input now uses 8px trailing padding
below 768px, freeing unused validation-icon space. Entering text restores
the existing 52px trailing padding. Desktop padding is unchanged. This preserves
control dimensions and prevents newly introduced truncation in that field.

## Reproduce and verify

Use Node from `.nvmrc` (24.12.0). The browser regression starts its own loopback
Vite server and intercepts `/api/v1/**`. It supplies synthetic authentication,
admin, joke, and comment data; it never writes real accounts or content.
Cloudflare's registration widget is stubbed outside the typography seam.
Navigation onboarding is marked as seen so it cannot cover the forms.

```bash
PUNDAD_FONT_BASELINE=1 npm run test:mobile-input-font # before changing source
npm run test:mobile-input-font                       # after changing source
npm test
npm run lint
npm run build
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an installed Chromium. Minimal hosts
may need `LD_LIBRARY_PATH` and `FONTCONFIG_FILE` pointing to extracted browser
libraries and fonts under `/tmp`. The browser context allows the host HTTPS
proxy certificate for loading Google Fonts; application configuration is unchanged.

The regression checks rendered controls and `::placeholder` computed styles,
never CSS class names. It loads Baloo 2 and Inter before measuring or taking
screenshots. It covers NO/EN, light/dark, and 320/390/767/768/1280px, with account,
password recovery, verification, contact, joke creation/editing, comment
creation/editing, profile (including conditional current-password and visibility buttons), admin user lookup/moderation, search, and leaderboard
forms. Optional before/after comparison checks every observed control's text,
placeholder, line height, dimensions, position, and page overflow. All originally
observed controls retain their padding. The conditional profile current-password
input has an explicit mobile-only empty-state padding check. Literal existing
font sizes also protect unchanged controls when baseline files are absent. A
canvas measurement using the actual placeholder font checks that the full mobile
current-password hint fits. Populated controls retain validation-icon space.

Artifacts are ignored under `output/playwright/mobile-input-font/`:
`before.json`, `after.json`, and representative `before-*.png` / `after-*.png`
screenshots at 320, 390, and 768px. To run only one scenario during TDD, set
`PUNDAD_FONT_FOCUS=login` (or comma-separated scenario names from the test).
Focused runs write `before-focused.json` / `after-focused.json`.

## Results

- Baseline: 300 form/viewport/language/theme combinations passed before edits.
- TDD: login placeholder assertion failed at 320px (11.2px instead of 14.4px).
  The conditional current-password width assertion also failed before the spacing
  adjustment. Focused profile verification then passed all 20 combinations.
- `npm test`: passed all five test files.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript project checking.
- Generated Tailwind CSS contains a 0.9rem placeholder rule, the unchanged 1rem
  override inside `min-width:48rem`, and mobile-only current-password placeholder padding.
- Fixture smoke: public home/header/navigation, protected-route redirect, login,
  session restore after reload, and logout passed in NO and EN without browser
  console or page errors. Evidence: `smoke.json`.
- Independent standards review: no remaining findings.
- Independent specification review: no remaining findings.
- Final full browser matrix: passed all 300 combinations, including strict
  baseline comparison of every originally observed control. No browser console
  or page errors and no horizontal page overflow occurred.

The baseline and final comparison preserve larger entered text, all observed
control sizes and positions, line heights, and all desktop typography/padding.
The only padding exception is unused trailing space in the empty mobile
profile current-password input. Populated login/profile inputs restore icon space.

## Limits and existing behavior

Verification uses Chromium and isolated API responses. Real authentication,
anti-bot services, account writes, backend error handling, and deployments were
not exercised or modified. The original revision remains the branch base;
asset-recovery and home-hero zoom history is preserved.

At 320px the Norwegian profile current-password label and its visibility icon
already overlap. This is unchanged by the typography fix; the icon remains
clickable. The moderation search's long single-line hint already truncates at
320px. Existing tablet profile fields also have limited room for long hints;
their typography and geometry are preserved. The newly introduced mobile
current-password hint truncation is fixed.

The conditional profile's before screenshots were additionally captured from an
isolated archive of `0e47cc4`, using the same test harness and fixtures. Evidence:
`before-profile-conditional.json` and `before-*-current-password.png`.
