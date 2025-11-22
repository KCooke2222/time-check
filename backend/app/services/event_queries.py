"""
Event query service.
Handles fetching events from the database based on date ranges.
"""

from datetime import datetime, timedelta
import pytz
from app.models import Event


def get_events_between(user, start_iso, end_iso):
    """
    Fetch events between ISO date strings (inclusive).

    Args:
        user: User model instance
        start_iso: str - Start date in YYYY-MM-DD format
        end_iso: str - End date in YYYY-MM-DD format (inclusive)

    Returns:
        list: Event objects ordered by start_time

    Example:
        events = get_events_between(user, "2025-11-09", "2025-11-15")
        # Returns events from Nov 9 00:00:00 to Nov 16 00:00:00 (exclusive) in user's timezone
    """
    user_timezone = user.settings.timezone if user.settings else 'UTC'

    try:
        tz = pytz.timezone(user_timezone)
    except pytz.exceptions.UnknownTimeZoneError:
        tz = pytz.timezone('UTC')

    # Parse start date to midnight in user timezone
    start_dt = datetime.strptime(start_iso, '%Y-%m-%d')
    start_localized = tz.localize(start_dt)
    start_unix_ts = int(start_localized.timestamp())

    # Parse end date to next day midnight (exclusive boundary)
    end_dt = datetime.strptime(end_iso, '%Y-%m-%d')
    end_localized = tz.localize(end_dt) + timedelta(days=1)
    end_unix_ts = int(end_localized.timestamp())

    # Query events in range
    events = Event.query.filter(
        Event.user_id == user.id,
        Event.start_time >= start_unix_ts,
        Event.start_time < end_unix_ts
    ).order_by(Event.start_time).all()

    return events