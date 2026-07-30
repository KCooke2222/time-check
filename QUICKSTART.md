# Quick Start Guide

Get up and running with Time Track in 10 minutes!

## 1. Install Dependencies

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## 2. Get API Keys

### Google OAuth (Required)

1. Go to https://console.cloud.google.com/
2. Create project → Enable Calendar API
3. Create OAuth 2.0 Client ID
4. Redirect URI: `http://localhost:5000/api/auth/callback`
5. Save Client ID and Secret

## 3. Configure Environment

Copy the example and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` — the required fields are `SECRET_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. See `.env.example` for all options.

## 4. Run the App

### Option A — Docker Compose (recommended; no local Python or Node)

```bash
docker compose up --build
```

Brings up two services: `frontend` on host port **5173** and `backend` on
**5000**. Source is bind-mounted, so edits hot-reload without a rebuild. Stop
with `docker compose down`.

There is no bundled database. The containers connect out to the Postgres already
running on your host, so **Docker and `./start-dev.sh` share one `time_track`
database** — no divergence between the two paths. Keep your local Postgres
running.

The stack cannot reuse the `DATABASE_URL` in `.env` as-is, because `localhost`
inside a container is the container itself. It rebuilds the URL from
`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` pointed at
`host.docker.internal`, so set those three in `.env` to match `DATABASE_URL`.

**One-time host setup:** Postgres must accept connections from the stack's
subnet, or the backend will restart-loop with `no pg_hba.conf entry for host
"172.31.250.2"`. Add to `pg_hba.conf` (`/etc/postgresql/16/main/pg_hba.conf` on
Debian/Ubuntu) and reload with `sudo systemctl reload postgresql`:

```
host    time_track    <your-db-user>    172.31.250.0/24    scram-sha-256
```

See README.md for the full explanation.

### Option B — one command (Linux, opens two terminals)

```bash
./start-dev.sh
```

### Option C — manually in two terminals

**Terminal 1 (Backend)**

```bash
cd backend
source venv/bin/activate
python run.py
```

**Terminal 2 (Frontend)**

```bash
cd frontend
npm run dev
```

## 5. First Use

1. Open http://localhost:5173
2. Click "Login with Google"
3. Authorize calendar access
4. Go to Settings → Calendars → Add your calendars
5. Go to Settings → Categories → Create sections & categories
6. Click "Sync Now" on Dashboard

## Example Categories

### Section: Fall 2024 Classes

- **Algorithms** - Keywords: `2341, algo, algorithms`
- **Database** - Keywords: `2326, database, db`

### Section: Personal

- **Gym** - Keywords: `gym, workout, fitness`
- **Reading** - Keywords: `read, reading, book`

## Troubleshooting

**No events showing?**

- Make sure calendar is "Active" in Settings
- Check event duration filters (default: 0-16 hours)

**Categories not matching?**

- Keywords are substrings (e.g., "2341" matches "Study 2341")
- Add more keyword variations

**Sync not working?**

- Check Flask logs for errors
- Verify OAuth tokens are valid
