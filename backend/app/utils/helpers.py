from datetime import datetime, timedelta

def get_week_start(date):
    """
    Get the start of the week (Sunday at 00:00:00) for a given date.

    Args:
        date: datetime object or date object

    Returns:
        datetime object representing Sunday at 00:00:00
    """
    if isinstance(date, datetime):
        date = date.date()

    # Get the day of the week (0=Monday, 6=Sunday in Python)
    # We want Sunday to be the start of the week
    days_since_sunday = (date.weekday() + 1) % 7
    week_start = date - timedelta(days=days_since_sunday)

    return datetime.combine(week_start, datetime.min.time())


def get_week_end(date):
    """
    Get the end of the week (Saturday at 23:59:59) for a given date.

    Args:
        date: datetime object or date object

    Returns:
        datetime object representing Saturday at 23:59:59
    """
    week_start = get_week_start(date)
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return week_end


def calculate_intensity_hours(event, user_settings):
    """
    Calculate intensity-adjusted hours for an event based on color and user multipliers.

    Args:
        event: Event model instance with duration_hours and color
        user_settings: UserSettings model instance with intensity multipliers

    Returns:
        float: duration_hours * intensity_multiplier
    """
    multipliers = user_settings.get_multipliers()

    # Get multiplier for event color (default to 1.0 if color not found)
    event_color = event.color.lower() if event.color else 'green'
    multiplier = multipliers.get(event_color, 1.0)

    return event.duration_hours * multiplier


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
