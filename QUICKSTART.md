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

### Option A — one command (Linux, opens two terminals)

```bash
./start-dev.sh
```

### Option B — manually in two terminals

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
