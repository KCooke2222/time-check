# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Running the app

Two paths, both documented in `README.md` → Setup: `docker compose up --build`
(frontend 5173, backend 5000) and the native `./start-dev.sh`. Keep both working
when touching packaging.

Both share the **one** Postgres running on the host — there is no bundled
database container, so the two paths cannot diverge.

## Sharp edges

- All config lives in one gitignored `.env` at the repo root — `backend/run.py`
  finds it by walking up from `backend/`. `.env.example` is the authoritative
  list of variables; add placeholders there, never real values.
- Both host ports are hardcoded in the app, so both services must be published
  on them regardless of how they run — the `FRONTEND_HOST_PORT` and
  `BACKEND_HOST_PORT` knobs cannot move them alone.
  `frontend/src/services/api.js` hardcodes `http://localhost:5000/api` as the
  API base, and calls are made by the browser, not by the Vite server (the
  `/api` proxy in `vite.config.js` is unused by the app).
  `backend/app/api/auth.py` ends the OAuth callback with a redirect to
  `http://localhost:5173/dashboard`, so a moved frontend port breaks login only
  after Google authorizes, not at page load.
- Under Compose, the `.env` `DATABASE_URL` is deliberately overridden: its
  `localhost` would be the backend container itself. `docker-compose.yml`
  rebuilds the URL from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
  against `host.docker.internal`. Those three must stay in sync with
  `DATABASE_URL` — they describe the same database.
- The Compose network is pinned to `172.31.250.0/24` on purpose: the host's
  `pg_hba.conf` grants exactly that subnet, so it is not a free-floating detail.
  Changing it silently breaks every Docker run until the host rule is changed to
  match. First-time setup needs that host rule; see `README.md`.
- `netlify.toml` builds the frontend with `VITE_DEMO_MODE=true`, which aliases
  the API client to `src/services/api.mock.js`. Do not break that alias.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
