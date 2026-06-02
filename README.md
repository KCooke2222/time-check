# Time Check

A full-stack app that syncs with Google Calendar to show you exactly what activities you're spending your time on, through interactive reports and visualizations.

**Live demo:** _coming soon_

## Stack

| Layer | Tech |
|---|---|
| Backend | Flask, SQLAlchemy, PostgreSQL, APScheduler |
| Auth | Google OAuth 2.0 |
| Data | Google Calendar API |
| Frontend | React, Vite, Tailwind CSS, Recharts |

## Architecture

The backend follows an application factory pattern with Flask blueprints for each domain (auth, calendars, categories, reports). Calendar events are synced on startup and hourly via APScheduler, storing everything in PostgreSQL with Unix timestamps for timezone-safe querying.

Categories use a hierarchical section/category model where keyword matching assigns events to categories at sync time. Sections can be nested arbitrarily deep, and report aggregation recursively rolls up hours through the tree.

The frontend is a single-page React app. Reports hit a range API endpoint that aggregates events server-side the weekly trend chart fires parallel requests per week and renders the results as a stacked bar chart filtered by user-starred sections.

## Features

- Google Calendar sync with background hourly polling
- Hierarchical category tree with drag-and-drop reordering
- Dashboard with current week summary and configurable 8–52 week trend chart
- Date range reports with section and category breakdowns
- Star-based chart filtering control which sections appear in visualizations
- Auto timezone detection

## Setup

See [QUICKSTART.md](QUICKSTART.md).
