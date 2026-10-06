# Quick Start

Get Time Check running locally in about 10 minutes.

## 1. Google OAuth credentials

1. Go to <https://console.cloud.google.com/> and create a project
2. Enable the **Google Calendar API**
3. Create an **OAuth 2.0 Client ID** (type: Web application)
4. Add redirect URI: `http://localhost:5000/api/auth/callback`

## 2. Configure

```bash
cp .env.example .env
```

Fill in `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
`DATABASE_URL`. `.env.example` documents every option.

Both run paths below share this one `.env` and expect a Postgres already
running on your host — the Compose stack does not bundle one. Either way the app
comes up on <http://localhost:5173> (frontend) and port 5000 (backend).

## 3. Run it

### Docker Compose

Also set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` to the database
`DATABASE_URL` points at; Compose refuses to start without all three.

```bash
docker compose up --build
```

Source is bind-mounted, so edits hot-reload without a rebuild.

To serve the app under a path prefix behind a reverse proxy (for example
`http://localhost:8800/time/`), set `VITE_BASE_PATH=/time`,
`FRONTEND_URL=http://localhost:8800/time` and
`GOOGLE_REDIRECT_URI=http://localhost:8800/time/api/auth/callback` in `.env`,
register that redirect URI on the Google OAuth client, add the proxy origin to
`CORS_ORIGINS`, and restart the frontend (Vite reads the base at startup).

**First time only:** containers reach your host database via
`host.docker.internal`, which a default Postgres rejects with a `no pg_hba.conf
entry` error. The stack pins its network to `172.31.250.0/24`, so grant exactly
that — add to `pg_hba.conf` (Debian/Ubuntu: `/etc/postgresql/16/main/pg_hba.conf`):

```
host    time_track    <your-db-user>    172.31.250.0/24    scram-sha-256
```

Then `sudo systemctl reload postgresql`. Use `md5` if that matches your server's
`password_encryption`, and confirm `listen_addresses` is not loopback-only.

### Native (venv + npm)

Needs none of the Docker network setup. Install once:

```bash
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install
```

Then from the repo root:

```bash
./start-dev.sh
```

Runs both services in one terminal with `[backend]`/`[frontend]` prefixed logs.

### Gotchas

- After changing `frontend/package.json`, rebuild with
  `docker compose up --build --renew-anon-volumes` — `node_modules` lives in an
  anonymous volume that otherwise survives the rebuild
- `POSTGRES_PORT` overrides the host DB port if it is not 5432
- `FRONTEND_HOST_PORT` moves the frontend; set `CORS_ORIGINS` to match, since
  the OAuth callback redirects to its first entry
- `BACKEND_HOST_PORT` moves the backend; the browser only talks to the
  frontend origin, Vite proxies `/api` to the backend (`VITE_PROXY_TARGET`)
- Serving the app from another origin (a reverse proxy): set `CORS_ORIGINS` or
  `FRONTEND_URL` and `GOOGLE_REDIRECT_URI` to that origin and register the
  redirect URI in the Google Cloud console

## 4. First use

1. Open <http://localhost:5173> and click **Login with Google**
2. Authorize calendar access
3. **Settings → Calendars** → add your calendars
4. **Settings → Categories** → create sections and categories
5. Click **Sync Now** on the dashboard

### Example categories

**Fall 2024 Classes**

- Algorithms — keywords: `2341, algo, algorithms`
- Database — keywords: `2326, database, db`

**Personal**

- Gym — keywords: `gym, workout, fitness`
- Reading — keywords: `read, reading, book`

## Troubleshooting

**No events showing?** Confirm the calendar is Active in Settings and the event
duration is inside your filters (default 0–16 hours).

**Categories not matching?** Keywords are case-insensitive substrings — `2341`
matches "Study 2341". Add more variations.

**Sync not working?** Check the Flask logs and verify your OAuth token is valid.
