# Time Check

A full-stack app that syncs with Google Calendar to show you exactly what activities you're spending your time on, through interactive reports and visualizations.

**Live demo:** [time-check-demo.netlify.app](https://time-check-demo.netlify.app)

## How it works

You log time by adding events to Google Calendar as you normally would. Each event title includes a short tag for example, writing `odin` or `odin - react project` in the title. Time Check syncs your calendars, searches each event title for known tags, and automatically assigns it to the matching category.

Categories are organized into sections, which you define once in the app. From there, the dashboard and reports show you exactly how many hours you've spent in each category and section, week by week.

## Stack

| Layer    | Tech                                       |
| -------- | ------------------------------------------ |
| Backend  | Flask, SQLAlchemy, PostgreSQL, APScheduler |
| Auth     | Google OAuth 2.0                           |
| Data     | Google Calendar API                        |
| Frontend | React, Vite, Tailwind CSS, Recharts        |

## Architecture

The backend follows an application factory pattern with Flask blueprints for each domain (auth, calendars, categories, reports). Calendar events are synced on startup and hourly via APScheduler, storing everything in PostgreSQL with Unix timestamps for timezone-safe querying.

Categories use a hierarchical section/category model where keyword matching assigns events to categories at sync time. Sections can be nested arbitrarily deep, and report aggregation recursively rolls up hours through the tree.

The frontend is a single-page React app providing reporting features and dashboards for viewing event timing, alongside a settings page for managing calendar sync and event categorization.

## Features

- Google Calendar sync with background hourly polling
- Hierarchical category tree with drag-and-drop reordering
- Dashboard with current week summary and configurable 8–52 week trend chart
- Date range reports with section and category breakdowns
- Star-based chart filtering control which sections appear in visualizations
- Auto timezone detection

## Setup

Two supported ways to run the app locally: Docker Compose, or natively with a
Python venv and npm. Both read configuration from a single `.env` at the repo
root, and both require a Postgres already running on your host — the Compose
stack does not bundle one. Docker and `./start-dev.sh` therefore talk to the same
`time_track` database, so the two paths can never diverge.

```bash
cp .env.example .env   # then fill in your credentials
```

The required fields are `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
and `DATABASE_URL`. `.env.example` documents every option; see
[QUICKSTART.md](QUICKSTART.md) for how to create the Google OAuth credentials.

Either way, the app comes up on the same host ports:

| Service  | Host port | URL                     |
| -------- | --------- | ----------------------- |
| Frontend | 5173      | <http://localhost:5173> |
| Backend  | 5000      | <http://localhost:5000> |

### Docker Compose (no local Python or Node needed)

Docker additionally needs `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`
set to the same database `DATABASE_URL` points at — including when updating an
older `.env` that only has `DATABASE_URL`. `docker compose` refuses to start
without all three.

```bash
docker compose up --build
```

Both services bind-mount their source, so edits on the host hot-reload in the
container with no rebuild. Stop everything with `docker compose down`.

The container's `node_modules` lives in an anonymous volume that survives a
container rebuild, so after changing a dependency in `frontend/package.json`,
plain `docker compose up --build` still starts with the old packages and Vite
fails to resolve the new import. Recreate the volume with
`docker compose up --build --renew-anon-volumes`, or discard it first with
`docker compose down -v`.

`POSTGRES_PORT` overrides the host database port if it is not the default 5432.

`FRONTEND_HOST_PORT` and `BACKEND_HOST_PORT` exist, but neither service can
actually move off its host port — 5173 and 5000 are hardcoded in the application,
and updating `CORS_ORIGINS` and `GOOGLE_REDIRECT_URI` does not change that:

- **Backend, 5000** — `frontend/src/services/api.js` hardcodes
  `http://localhost:5000/api`, and the browser, not the Vite server, makes those
  calls. Publishing the backend anywhere else makes every API call fail.
- **Frontend, 5173** — `backend/app/api/auth.py` ends the OAuth callback with
  `redirect('http://localhost:5173/dashboard')`. Publishing the frontend
  anywhere else lets the app load and API calls succeed, then dead-ends login on
  connection refused after Google authorizes, with the session cookie already
  set.

Moving either port requires editing the corresponding hardcoded value too.

#### First-time setup: let containers reach your host Postgres

`localhost` inside a container is the container itself, so the backend reaches
the host database via `host.docker.internal` (mapped to `host-gateway`, which
is required on Linux). A default Postgres install will refuse that connection
with:

```
FATAL:  no pg_hba.conf entry for host "172.31.250.2", user "...", database "time_track"
```

The stack pins its Docker network to `172.31.250.0/24` so you can grant exactly
that subnet and nothing more. Add this line to your `pg_hba.conf` (on Debian and
Ubuntu, `/etc/postgresql/16/main/pg_hba.conf`):

```
host    time_track    <your-db-user>    172.31.250.0/24    scram-sha-256
```

Then reload: `sudo systemctl reload postgresql`. Use `md5` instead of
`scram-sha-256` if that is what your server's `password_encryption` is set to.
Also confirm `listen_addresses` is not loopback-only, since the container does
not arrive over loopback.

### Native (venv + npm)

Uses `DATABASE_URL` from `.env` directly, and needs none of the Docker network
setup above. Install dependencies once:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm install
```

Then start both services from the repo root:

```bash
./start-dev.sh
```

It runs the Flask backend and the Vite dev server together and streams both logs
into one terminal, prefixed `[backend]` and `[frontend]`. Stop with Ctrl+C.

Or run them yourself in two terminals:

```bash
cd backend && source .venv/bin/activate && python run.py
```

```bash
cd frontend && npm run dev
```

## First run

With the app up, see [QUICKSTART.md](QUICKSTART.md) for the Google OAuth
credentials it needs and the walkthrough for logging in, adding calendars, and
creating your first categories.
