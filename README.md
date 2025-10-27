# Time Track - Intensity-Based Time Tracking System

A robust time tracking application that pulls data from Google Calendar and applies **intensity multipliers** based on event colors to give you a more accurate picture of your productive hours.

## Features

- **Google Calendar Integration**: Automatically sync events from multiple Google Calendars
- **Intensity-Based Tracking**: Events colored blue/green/red get 0.75x/1.0x/1.25x multipliers
- **Hierarchical Categories**: Organize activities into Sections → Categories with keyword-based auto-matching
- **Smart Reporting**: Weekly and date-range reports showing both raw and intensity-adjusted hours
- **AI-Powered Insights**: Weekly email summaries with Gemini-generated productivity tips
- **Automated Sync**: Background sync every hour with 7-day rolling window for updates

## Tech Stack

### Backend
- **Flask** - Python web framework
- **SQLAlchemy** - ORM for SQLite database
- **APScheduler** - Background job scheduling
- **Google Calendar API** - Event data source
- **Google Gemini AI** - Insight generation
- **Flask-Mail** - Email notifications

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **React Router** - Navigation

## Architecture

```
time-track/
├── backend/
│   ├── app/
│   │   ├── models.py           # Database models
│   │   ├── api/                # REST API endpoints
│   │   ├── services/           # Business logic
│   │   └── tasks/              # Background jobs
│   ├── config.py               # Configuration
│   └── run.py                  # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── services/           # API client
│   │   └── App.jsx             # Main app
│   └── package.json
└── .env                        # Configuration (create from .env.example)
```

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- Google Cloud Project with Calendar API enabled
- Gmail account for SMTP (or other email provider)
- Gemini API key (free at https://makersuite.google.com/app/apikey)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp ../.env.example .env
# Edit .env and fill in your credentials (see Configuration section below)

# Run the backend
python run.py
```

Backend will start on `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

Frontend will start on `http://localhost:5173`

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Calendar API**
4. Go to **Credentials** → Create OAuth 2.0 Client ID
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:5000/api/auth/callback`
7. Copy **Client ID** and **Client Secret** to your `.env` file

## Configuration

Edit your `.env` file with the following:

```env
# Flask
SECRET_KEY=your-random-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/callback

# Email (Gmail example)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password  # Create at myaccount.google.com/apppasswords
MAIL_DEFAULT_SENDER=your-email@gmail.com

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Sync Settings
SYNC_INTERVAL_HOURS=1
SYNC_LOOKBACK_DAYS=7
```

## Usage

### First Time Setup

1. **Login**: Open `http://localhost:5173` and click "Login with Google"
2. **Authorize**: Grant calendar read permissions
3. **Add Calendars**: Go to Settings → Calendars → Discover calendars
4. **Create Categories**:
   - Go to Settings → Categories
   - Create Sections (e.g., "Fall 2024 Classes", "Personal Projects")
   - Add Categories with keywords (e.g., Category: "Algorithms", Keywords: "2341, algo")
5. **Sync**: Click "Sync Now" on the Dashboard

### Daily Workflow

- **Dashboard**: View current week's progress
- **Reports**: Generate weekly or date-range reports
- **Settings**: Adjust intensity multipliers or event filters
- **Email**: Manually trigger weekly report email (Settings → Email Reports)

## How It Works

### Intensity Calculation

```
Event: "Study 2341" - 2 hours - Red color
Raw Hours: 2.0h
Intensity Multiplier: 1.25 (red = high focus)
Intensity-Adjusted Hours: 2.5h
```

### Category Matching

Events are categorized by **substring matching** against keywords:
- Event: "Gym session" → matches keyword "gym" → Category: "Fitness"
- Event: "2341 homework" → matches keyword "2341" → Category: "Algorithms"

### Sync Behavior

- **Startup**: Syncs all calendars on app launch
- **Hourly**: Automatic sync every hour while app is running
- **Rolling Window**: Last 7 days are checked for updates/deletions
- **Event Filtering**: Events outside min/max duration settings are excluded

## API Endpoints

### Authentication
- `GET /api/auth/login` - Initiate Google OAuth
- `GET /api/auth/callback` - OAuth callback
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check auth status

### Calendar
- `GET /api/calendar/list` - List connected calendars
- `GET /api/calendar/discover` - Find available Google Calendars
- `POST /api/calendar/add` - Add calendar to track
- `PUT /api/calendar/<id>/toggle` - Toggle active status
- `POST /api/calendar/sync` - Manual sync trigger

### Reports
- `GET /api/reports/weekly?date=YYYY-MM-DD` - Weekly report
- `GET /api/reports/range?start=YYYY-MM-DD&end=YYYY-MM-DD` - Date range report
- `GET /api/reports/current-week` - Current week summary

### Categories
- `GET /api/categories/sections` - List sections
- `POST /api/categories/sections` - Create section
- `GET /api/categories/categories` - List categories
- `POST /api/categories/categories` - Create category

### Settings
- `GET /api/settings/` - Get user settings
- `PUT /api/settings/` - Update settings
- `POST /api/settings/reset-multipliers` - Reset to defaults

### Email
- `POST /api/email/send-weekly-report` - Send weekly report email

## Database Schema

- **users**: User accounts and OAuth tokens
- **user_settings**: Event filters and intensity multipliers
- **calendars**: Connected Google Calendars
- **sections**: Top-level category groups
- **categories**: Activity categories with keywords
- **events**: Synced calendar events
- **sync_logs**: Sync operation history

## Troubleshooting

### Events not appearing
- Check that calendar is marked "Active" in Settings
- Verify event duration is within min/max filters
- Ensure sync has run (check Dashboard for last sync time)

### Categories not matching
- Keywords are case-insensitive substrings
- Add more keyword variations (e.g., "2341", "algo", "algorithms")
- Check category display order (higher priority = matched first)

### Email not sending
- Verify SMTP credentials in `.env`
- For Gmail: Create App Password at myaccount.google.com/apppasswords
- Check Flask logs for detailed error messages

### Sync not running automatically
- APScheduler runs only while Flask app is active
- Check logs for scheduler initialization messages
- Manual sync is always available on Dashboard

## Future Enhancements

- [ ] Day-of-week analytics
- [ ] Time-of-day heatmaps
- [ ] Multi-user support with team dashboards
- [ ] Export to CSV/PDF
- [ ] Mobile app
- [ ] Custom color → intensity mappings
- [ ] Goal setting and progress tracking

## License

MIT License - Feel free to use and modify for your needs.

## Credits

Built with inspiration from Google Apps Script time tracking, now evolved into a full-stack intensity-aware system.

Powered by:
- Google Calendar API
- Google Gemini AI
- Flask & React ecosystems
