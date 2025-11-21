Full Plan: Convert to Unix Timestamp Architecture
Phase 1: Add User Timezone Setting
File: backend/app/models.py
Add timezone field to UserSettings model:
timezone = db.Column(db.String(50), default='UTC')
File: frontend/src/components/Settings.jsx
Add timezone dropdown in General Settings tab
Use common timezones list (UTC, America/New_York, America/Chicago, America/Los_Angeles, etc.)
File: backend/app/api/settings.py
Update settings endpoint to accept/return timezone field
Phase 2: Create Unix Timestamp Helper Functions
File: backend/app/utils/helpers.py Add new functions:
parse_google_time(rfc3339_str: str) -> int
Parse RFC3339 string (e.g., "2011-06-03T10:00:00-07:00") to Unix timestamp
Use datetime.fromisoformat() then .timestamp()
to_google_time(unix_ts: int) -> str
Convert Unix timestamp to RFC3339 string with UTC timezone
Use datetime.fromtimestamp(unix_ts, tz=timezone.utc).isoformat()
parse_user_date(date_str: str, user_timezone: str) -> int
Parse "YYYY-MM-DD" as midnight in user's timezone
Return Unix timestamp
Use pytz for timezone handling
format_timestamp_iso(unix_ts: int) -> str
Convert Unix timestamp to ISO string for JSON responses
Use datetime.fromtimestamp(unix_ts, tz=timezone.utc).isoformat()
Update existing functions:
get_week_start(unix_ts: int, user_timezone: str) -> int
Find Sunday at 00:00:00 in user's timezone
Return Unix timestamp
Internally use datetime, return int
get_week_end(unix_ts: int, user_timezone: str) -> int
Find Saturday at 23:59:59 in user's timezone
Return Unix timestamp
Internally use datetime, return int
Phase 3: Update Database Models
File: backend/app/models.py Remove UTCDateTime TypeDecorator completely. Update Event model:
start_time = db.Column(db.Integer, nullable=False, index=True) # Unix timestamp
end_time = db.Column(db.Integer, nullable=False) # Unix timestamp
last_synced = db.Column(db.Integer, default=lambda: int(datetime.now(timezone.utc).timestamp()))
Update SyncLog model:
sync_time = db.Column(db.Integer, default=lambda: int(datetime.now(timezone.utc).timestamp()))
date_range_start = db.Column(db.Integer, nullable=False)
date_range_end = db.Column(db.Integer, nullable=False)
Update User model:
created_at = db.Column(db.Integer, default=lambda: int(datetime.now(timezone.utc).timestamp()))
Phase 4: Update Calendar Sync
File: backend/app/services/calendar_sync.py
sync_user_calendars():
Get current time as Unix timestamp: int(datetime.now(timezone.utc).timestamp())
Calculate lookback: start_time = end_time - (lookback_days \* 86400)
Pass Unix timestamps to fetch_calendar_events()
fetch_calendar_events():
Convert Unix timestamps to RFC3339 for Google API:
timeMin = to_google_time(start_time)
timeMax = to_google_time(end_time)
parse_google_event():
Parse Google datetime strings to Unix timestamps:
start_time = parse_google_time(start['dateTime'])
end_time = parse_google_time(end['dateTime'])
duration = end_time - start_time # seconds
duration_hours = duration / 3600
Set last_synced as current Unix timestamp
Return dict with Unix timestamps
has_event_changed():
Direct integer comparisons (no datetime conversion needed)
update_event():
Assign Unix timestamps directly
Set last_synced = int(datetime.now(timezone.utc).timestamp())
Phase 5: Update Report Generator
File: backend/app/services/report_generator.py
generate_weekly_report(user, week_date_unix_ts):
Get user timezone from user.settings.timezone
Calculate week boundaries:
week_start = get_week_start(week_date_unix_ts, user.settings.timezone)
week_end = get_week_end(week_date_unix_ts, user.settings.timezone)
Query events: Event.start_time >= week_start AND Event.start_time <= week_end
All calculations use Unix timestamps
Convert to ISO strings only for JSON response
generate_range_report(user, start_date_str, end_date_str):
Parse date strings:
start_ts = parse_user_date(start_date_str, user.settings.timezone)
end_ts = parse_user_date(end_date_str, user.settings.timezone)
Calculate week boundaries using get_week_start() and get_week_end()
Query using Unix timestamps
Calculate duration: event.duration_hours = (event.end_time - event.start_time) / 3600
build_hierarchical_section_summary():
No changes needed (works with hour totals, not timestamps)
Phase 6: Update API Endpoints
File: backend/app/api/reports.py
weekly_report():
Parse date parameter or use current time as Unix timestamp
Pass Unix timestamp to generate_weekly_report()
Convert Unix timestamps to ISO strings in response:
'week_start': format_timestamp_iso(week_start),
'week_end': format_timestamp_iso(week_end),
'events': [{
'start_time': format_timestamp_iso(event.start_time),
'end_time': format_timestamp_iso(event.end_time),
...
}]
range_report():
Receive YYYY-MM-DD strings from frontend
Pass to generate_range_report() (it handles parsing)
Convert timestamps in response
current_week():
Get current Unix timestamp
Pass to generate_weekly_report()
File: backend/app/api/calendar.py
sync_stats():
Convert timestamps to ISO strings:
'oldest_event_date': format_timestamp_iso(oldest_event.start_time) if oldest_event else None,
'latest_sync_time': format_timestamp_iso(latest_sync.sync_time) if latest_sync else None,
Phase 7: Database Migration
File: backend/migrate_to_unix_timestamps.py Create migration script to convert all existing datetime strings/values to Unix timestamps:
Backup database first
For each table/column:
Read current value (may be string like "2025-11-10 14:30:00.000000" or "2025-11-10T14:30:00+00:00")
Parse to datetime (handle multiple formats)
Convert to Unix timestamp
Update row with integer value
Tables to migrate:
events: start_time, end_time, last_synced
sync_logs: sync_time, date_range_start, date_range_end
users: created_at
Phase 8: Remove Old Code
File: backend/app/services/calendar_sync.py
Remove all debug logging added earlier (has_event_changed debug logs)
Remove unused datetime imports if any
File: backend/app/models.py
Remove UTCDateTime TypeDecorator class
Remove unused imports (TypeDecorator, String)
File: backend/migrate_timezone_aware.py
Delete this file (no longer needed)
Phase 9: Testing
Run migration script on test database
Restart backend
Test sync with 7 days lookback
Verify events saved as Unix timestamps in DB
Test sync with 365 days lookback
Verify no duplicate/update issues
Test weekly report
Test range report
Verify all timestamps display correctly in frontend
Dependencies to Install
File: backend/requirements.txt
Verify pytz is included (for timezone handling)
Order of Execution
Phase 1: User timezone setting (allows testing with different timezones)
Phase 2: Helper functions (foundation for all conversions)
Phase 3: Update models (DB schema change)
Phase 4: Calendar sync (most critical, fixes the duplicate issue)
Phase 5: Report generator (depends on helper functions)
Phase 6: API endpoints (formatting layer)
Phase 7: Migration (convert existing data)
Phase 8: Cleanup (remove old code)
Phase 9: Testing (verify everything works)
