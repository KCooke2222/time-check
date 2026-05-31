from datetime import datetime, timedelta, timezone
import pytz


def parse_google_time(rfc3339_str):
    """
    Parse RFC3339 string (Google Calendar format) to Unix timestamp.

    Args:
        rfc3339_str: string in RFC3339 format (e.g., "2011-06-03T10:00:00-07:00")

    Returns:
        int: Unix timestamp (seconds since epoch)
    """
    dt = datetime.fromisoformat(rfc3339_str.replace('Z', '+00:00'))
    return int(dt.timestamp())


def to_google_time(unix_ts):
    """
    Convert Unix timestamp to RFC3339 string with UTC timezone for Google API.

    Args:
        unix_ts: int Unix timestamp (seconds since epoch)

    Returns:
        str: RFC3339 formatted string with UTC timezone
    """
    dt = datetime.fromtimestamp(unix_ts, tz=timezone.utc)
    return dt.isoformat()


def parse_user_date(date_str, user_timezone):
    """
    Parse YYYY-MM-DD string as midnight in user's timezone, return Unix timestamp.

    Args:
        date_str: string in YYYY-MM-DD format
        user_timezone: string timezone name (e.g., "America/New_York")

    Returns:
        int: Unix timestamp (seconds since epoch)
    """
    try:
        tz = pytz.timezone(user_timezone)
        naive_dt = datetime.strptime(date_str, '%Y-%m-%d')
        localized_dt = tz.localize(naive_dt)
        return int(localized_dt.timestamp())
    except (ValueError, TypeError, pytz.exceptions.UnknownTimeZoneError):
        return None


def format_timestamp_iso(unix_ts, user_timezone='UTC'):
    """
    Convert Unix timestamp to ISO string for JSON responses.

    Args:
        unix_ts: int Unix timestamp (seconds since epoch)
        user_timezone: string timezone name (e.g., "America/New_York")

    Returns:
        str: ISO 8601 formatted string in specified timezone
    """
    try:
        tz = pytz.timezone(user_timezone)
        dt = datetime.fromtimestamp(unix_ts, tz=tz)
        return dt.isoformat()
    except pytz.exceptions.UnknownTimeZoneError:
        # Fallback to UTC if timezone is invalid
        dt = datetime.fromtimestamp(unix_ts, tz=timezone.utc)
        return dt.isoformat()




def format_week_label(week_start_date):
    """
    Format a week label for display (e.g., "Week 2024-10-20")

    Args:
        week_start_date: datetime object representing week start

    Returns:
        str: formatted week label
    """
    return f"Week {week_start_date.strftime('%Y-%m-%d')}"


def parse_date_string(date_str):
    """
    Parse a date string in YYYY-MM-DD format to datetime.

    Args:
        date_str: string in YYYY-MM-DD format

    Returns:
        datetime object
    """
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except (ValueError, TypeError):
        return None


def google_color_id_to_name(color_id):
    """
    Map Google Calendar color IDs to color names.
    Google Calendar uses numeric color IDs (1-11).

    Common mappings (may vary by calendar type):
    1: Lavender (light blue/purple) -> blue
    2: Sage (light green) -> green
    3: Grape (purple) -> blue
    4: Flamingo (pink/red) -> red
    5: Banana (yellow) -> green
    6: Tangerine (orange) -> green
    7: Peacock (cyan/teal) -> blue
    8: Graphite (gray) -> green
    9: Blueberry (dark blue) -> blue
    10: Basil (dark green) -> green
    11: Tomato (red) -> red

    Args:
        color_id: string or int representing Google Calendar color ID

    Returns:
        str: 'blue', 'green', or 'red'
    """
    if color_id is None:
        return 'green'  # Default to normal intensity

    try:
        color_id = int(color_id)
    except (ValueError, TypeError):
        return 'green'

    # Map to our three intensity levels
    blue_colors = [1, 3, 7, 9]  # Light/cool colors -> low intensity
    red_colors = [4, 11]         # Red/warm colors -> high intensity
    green_colors = [2, 5, 6, 8, 10]  # Mid-range/neutral -> normal intensity

    if color_id in blue_colors:
        return 'blue'
    elif color_id in red_colors:
        return 'red'
    elif color_id in green_colors:
        return 'green'
    else:
        return 'green'  # Default


def should_filter_event(event_duration_hours, user_settings):
    """
    Determine if an event should be filtered out based on user settings.

    Args:
        event_duration_hours: float representing event duration
        user_settings: UserSettings model instance

    Returns:
        bool: True if event should be filtered out, False if it should be kept
    """
    return (
        event_duration_hours <= user_settings.min_event_duration_hours or
        event_duration_hours >= user_settings.max_event_duration_hours
    )
