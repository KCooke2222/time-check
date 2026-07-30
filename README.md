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

Two supported ways to run the app locally. Both read configuration from a single
`.env` at the repo root — start from `.env.example`.

### Docker Compose (no local Python, Node, or Postgres needed)

```bash
cp .env.example .env   # then fill in your credentials
docker compose up --build
```

| Service  | Host port | URL                     |
| -------- | --------- | ----------------------- |
| Frontend | 5173      | <http://localhost:5173> |
| Backend  | 5000      | <http://localhost:5000> |
| Postgres | 5434      | `localhost:5434`        |

Postgres runs as its own service with a named volume (`postgres-data`), so data
survives `docker compose down`. The backend waits for the database healthcheck
before starting. Both application services bind-mount their source, so edits on
the host hot-reload in the container with no rebuild.

Host ports are overridable in `.env` via `FRONTEND_HOST_PORT`,
`BACKEND_HOST_PORT`, and `POSTGRES_HOST_PORT`. If you change the frontend or
backend port, update `CORS_ORIGINS` and `GOOGLE_REDIRECT_URI` to match.

Stop everything with `docker compose down` (add `-v` to also drop the database
volume).

### Native (venv + npm)

Unchanged — see [QUICKSTART.md](QUICKSTART.md). This path uses whatever
`DATABASE_URL` in `.env` points at, not the Compose Postgres service.
