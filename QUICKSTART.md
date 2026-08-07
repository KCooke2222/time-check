# Quick Start Guide

Get up and running with Time Check in 10 minutes!

This guide covers the Google credentials you need and your first few minutes in
the app. For how to install and run it, see
[README.md → Setup](README.md#setup) — that is the one place run instructions
live.

## 1. Get API Keys

### Google OAuth (Required)

1. Go to https://console.cloud.google.com/
2. Create project → Enable Calendar API
3. Create OAuth 2.0 Client ID
4. Redirect URI: `http://localhost:5000/api/auth/callback`
5. Save Client ID and Secret

Put the Client ID and Secret in your `.env` as `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`.

## 2. First Use

1. Start the app (see [README.md → Setup](README.md#setup))
2. Open http://localhost:5173
3. Click "Login with Google"
4. Authorize calendar access
5. Go to Settings → Calendars → Add your calendars
6. Go to Settings → Categories → Create sections & categories
7. Click "Sync Now" on Dashboard

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
