# Frontend Feature Testing Strategy

Use this checklist whenever a new frontend feature is added or an existing feature is changed. The goal is to catch broken user flows, frontend/backend contract mismatches, language regressions, and UI issues before the change reaches production.

## 1. Start With the Feature Contract

Before testing the UI, write down what the feature is supposed to do.

Answer these questions:

- What user role can use it: public user, logged-in user, admin, or owner only?
- Which route, component, or layout changed?
- Which API endpoint does it call?
- Does it need an access token?
- Does it send `X-App-Language`?
- Does it read or write database-backed data?
- What should happen on success?
- What should happen on validation error, auth error, network error, and empty data?

If the feature touches backend data, compare the frontend request payload with the backend route/controller expectations.

## 2. Always Run the Core Smoke Test

After adding a feature, verify that the app still works at a basic level:

- App loads without console errors
- Header, navigation, and sidebars still render
- Public routes work
- Login still works
- Refresh/session restore still works after a page reload
- Logout still works
- A protected route redirects unauthenticated users to login
- The app still builds with `npm run build`

## 3. Test the New Feature Directly

Test the feature as the intended user.

Cover:

- Default state
- Loading state
- Success state
- Empty state
- Error state
- Form validation, if relevant
- Disabled buttons while submitting
- Duplicate-click protection
- Toasts or inline errors
- Navigation after success
- Whether local UI state updates without requiring a full page refresh

If the feature edits existing data, test create, read, update, and delete behavior where relevant.

## 4. Test Authentication and Authorization

For any feature that depends on auth:

- Logged-out users cannot access protected UI
- Logged-in users can access their allowed actions
- Users cannot edit or delete content they do not own
- Admin-only UI does not expose actions to regular users
- Backend 401 or 403 responses are handled cleanly
- Expired access tokens trigger the safe refresh flow
- If refresh fails, the user is logged out or asked to log in again

Remember that frontend hiding is not security. The backend must still reject unauthorized requests.

## 5. Test Norwegian and English

Language is one of the highest-risk parts of this project. Any feature that reads or writes content should be tested in both `NO` and `EN`.

Check:

- UI text is translated
- No hardcoded English/Norwegian text appears in the wrong language
- API requests send the active language
- New content is created in the selected language
- Switching language updates the displayed data
- Norwegian content does not appear in English views
- English content does not appear in Norwegian views
- Badges, featured jokes, search results, tags, and leaderboards remain language-scoped

For account/profile features, remember that the user account is global, while content is language-scoped.

## 6. Test Forms Carefully

For forms, test:

- Required fields
- Minimum and maximum lengths
- Invalid email/password formats
- Leading/trailing spaces
- Empty strings
- Very long input
- Special characters
- Server-side validation errors
- Submit button disabled while invalid or submitting
- Form reset behavior after success
- Unsaved changes warning, if relevant
- Autosave behavior, if relevant

For joke, comment, tag, username, and profile forms, also test blocked moderation terms.

## 7. Test API Error Handling

Manually simulate or observe these cases:

- 400 validation error
- 401 unauthenticated
- 403 forbidden
- 404 not found
- 429 rate limited
- 500 server error
- Network failure
- Backend returns success with empty `data`

The UI should not crash. Users should see a clear error, empty state, or redirect depending on the situation.

## 8. Test Responsive Layout

Check the feature on:

- Mobile width
- Tablet width
- Desktop width

Verify:

- Text does not overlap
- Buttons remain reachable
- Forms fit the viewport
- Sidebars and mobile navigation still work
- Tables or lists handle narrow screens
- Modals fit small screens
- Long usernames, tags, titles, and error messages do not break layout

## 9. Test Shared State and Cache Behavior

If the feature changes shared data, verify that related UI updates.

Check:

- User context updates after profile changes
- Joke lists refresh after create/edit/delete
- Badge state updates after badge-related actions
- Moderation terms refresh after admin changes
- Language changes reset or refetch language-specific data
- Pagination does not duplicate items
- Stale requests do not overwrite newer state

## 10. Test Regression-Prone Areas

These areas should be checked often because they connect many parts of the app:

- Login, refresh, logout
- Register and email verification
- Reset password
- Create joke
- Save draft
- Publish draft
- Edit joke
- Delete joke
- Like/unlike joke
- Add/edit/delete comment
- Search with all filters
- Daily joke
- Featured pages
- Hall of Fame leaderboard
- Profile update and avatar upload
- Admin user deactivation/reactivation
- Moderation term CRUD

## 11. Decide What Should Be Automated

Automate tests when the behavior is important, repeatable, and easy to break.

Good candidates for automated tests:

- Validation helpers
- Translation helper behavior
- `usePagination` behavior
- API helper request shape
- Auth refresh behavior
- Language header handling
- Form validation
- Route protection
- Critical flows with end-to-end tests:
  - login
  - create joke
  - switch language
  - search
  - profile update

Manual testing is still useful for:

- Responsive layout
- Visual polish
- Copy and translations
- Toasts and perceived UX
- Admin workflows during early development

## 12. Definition of Done for a Frontend Feature

A frontend feature is ready when:

- The main user flow works
- Loading, empty, success, and error states work
- Auth and permissions are handled
- Norwegian and English behavior is checked
- The UI works on mobile and desktop
- Backend validation errors are displayed clearly
- Existing core flows still work
- `npm run build` passes
- Any high-risk behavior has either a manual checklist entry or an automated test

## 13. Manual Test Note Template

Use this format when documenting a manual test:

```text
Feature:
Date:
Tester:
Branch/commit:

What changed:

Tested roles:
- Public
- User
- Admin

Tested languages:
- NO
- EN

Cases tested:
- Happy path:
- Validation:
- Auth/permission:
- Error state:
- Mobile:
- Desktop:
- Regression checks:

Bugs found:

Result:
Pass/Fail
```

## 14. Open Clients Across Frontend Releases

Run `npm run test:deployment` with Node from `.nvmrc`, Python 3, Nginx, and
Playwright Chromium (`npx playwright install --with-deps chromium`). The test
uses the sibling `../../backend/pundad-api-dev` checkout by default; set
`PUNDAD_DEPLOY_ROOT=/absolute/path/to/Pundad-api` for another layout. The backend
checkout must contain the paired issue #199 deployment changes. CI selects the
matching backend branch when it exists, otherwise `main`; land the paired
backend changes before deleting that branch.

The test creates two production Vite builds in a temporary directory, changes
the dashboard layout and CSS so their hashes differ, and runs the deployment
tooling's actual asset preparation, atomic symlink switch, and production Nginx
template on loopback. A fixture HTTP API supplies authentication and empty data;
the test never accesses a real database, account, deployment, or private config.
It verifies a service-worker-controlled A tab can lazy-load A's dashboard after
B activates, while a fresh tab gets B. It also checks CSS status/MIME and cache
headers, missing CSS rejection without cache poisoning, bounded recovery with
the route/query/hash intact, repeated failures across reloads, blocked session
storage, unsaved editor preservation, NO/EN fallbacks, and offline behavior.

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing Chromium executable, and
`NGINX_BIN` can select another Nginx binary. Browser runtime libraries must be
available. Verification on a minimal host can extract the missing libraries
under `/tmp` and set `LD_LIBRARY_PATH`, without installing system packages.

To reproduce the original failure independently, extract the pre-fix frontend
revision to a temporary directory, symlink its `node_modules` to this checkout's
installed dependencies, then run
`PUNDAD_FRONTEND_SOURCE=/tmp/pristine-frontend PUNDAD_REPRODUCE=1 npm run test:deployment`.
This mode deliberately switches releases without asset retention and expects
the old dashboard's hashed chunk to return 404 with a browser import error.

Before a dev/staging rollout, repeat these checks in both NO and EN:

- Keep a home tab open, activate a new release, and use its dashboard link.
  Confirm the old tab loads and a fresh tab gets the new version.
- Check HTML and `sw.js` revalidate, build/release metadata is `no-store`, hashed
  assets are immutable, and a nonexistent JS/CSS path returns 404.
- Keep a joke editor open with unsaved text. Force a missing lazy profile or
  admin chunk, and confirm the text survives with a useful recovery notice.
- Confirm a missing old chunk reloads at most once; a second failure stays on
  the fallback. Repeat with blocked session storage and an offline connection.
- Confirm a visited shell opens offline and reconnecting restores navigation.
- Smoke-test login/session refresh/logout, registration/Turnstile, post creation,
  editing and drafts, moderation, badges, leaderboards, Top Creator, streak
  bonuses, and the points guide. These application/API flows use fixtures in the
  deployment regression and still require a real dev/staging check.
