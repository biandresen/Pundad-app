# Local frontend development on the Pi

Use `/home/pi/projects/frontend/pundad-app-dev` for development. This Git
worktree has its own `chore/development-workflow` branch and does not change
the deployed files under `/var/www/pundad-frontend`.

```bash
cd /home/pi/projects/frontend/pundad-app-dev
npm run dev
```

Start the isolated API in a second Pi terminal:

```bash
cd /home/pi/projects/backend/pundad-api-dev
npm run dev
```

Forward port **5173** in VS Code Remote SSH and open
`http://localhost:5173` in the laptop browser. Vite binds to `127.0.0.1:5173`
and proxies `/api` and `/uploads` to the Pi's `127.0.0.1:4001` API. The fixed
port avoids silently starting a second server on a different forwarded port.

API URLs default to `/api/v1`; avatar URLs default to the same origin. Optional
`VITE_API_BASE_URL` and `VITE_API_ORIGIN` overrides are public build settings,
not places to store secrets. `.env.production` is loaded for production builds,
not for the development server.

Development has its own database, upload directory, and JWT secrets.
Verification/reset messages appear in the API terminal instead of being sent
as real email. Register a test account and open its printed verification link
on the laptop. Full database setup and the rollout checklist are documented in
the API worktree's `docs/development.md`.

Check the frontend with `npm run build`. Browser Network tools should show
requests to `http://localhost:5173/api/v1/...`, without direct calls to the
production API.

## Continuous integration

CI workflows for lint, tests, migration checks, and build artifacts are prepared
and verified locally. Publishing and branch protection still require GitHub
authentication/settings. See
[the CI guide](continuous-integration.md) for the workflows, local commands,
branch protection settings, and the public staging plan.
