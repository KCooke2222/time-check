# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Running the app

Two paths, both documented in `README.md` → Setup: `docker compose up --build`
(frontend 5173, backend 5000, postgres 5434) and the native `./start-dev.sh`.
Keep both working when touching packaging.

## Sharp edges

- All config lives in one gitignored `.env` at the repo root — `backend/run.py`
  finds it by walking up from `backend/`. `.env.example` is the authoritative
  list of variables; add placeholders there, never real values.
- `frontend/src/services/api.js` hardcodes `http://localhost:5000/api` as the
  API base. Calls are made by the browser, not by the Vite server, so the
  backend must be published on host port 5000 regardless of how it runs. The
  `/api` proxy in `vite.config.js` is unused by the app.
- Under Compose, the `.env` `DATABASE_URL` is deliberately overridden: its
  `localhost` would be the backend container itself. `docker-compose.yml`
  rebuilds the URL from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
  against the `postgres` service.
- The Compose Postgres is a separate, initially empty database from whatever a
  native run points at. `create_app()` calls `db.create_all()` on boot, so the
  schema appears automatically but the data does not.
- `netlify.toml` builds the frontend with `VITE_DEMO_MODE=true`, which aliases
  the API client to `src/services/api.mock.js`. Do not break that alias.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
