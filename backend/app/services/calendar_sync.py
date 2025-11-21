"""
Google Calendar sync service.
Pulls events from Google Calendar and syncs with local database.
"""

from datetime import datetime, timezone
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from app import db
from app.models import User, Calendar, Event, SyncLog, Section
from app.services.category_matcher import find_category, get_category_priority_order
from app.utils.helpers import google_color_id_to_name, should_filter_event, parse_google_time, to_google_time
import logging

logger = logging.getLogger(__name__)


def get_calendar_service(user):
    """
    Create Google Calendar API service instance for a user.

    Args:
        user: User model instance with OAuth tokens

    Returns:
        Google Calendar API service
    """
    tokens = user.get_tokens()
    if not tokens:
        raise ValueError("User has no OAuth tokens")

    creds = Credentials(
        token=tokens.get('access_token'),
        refresh_token=tokens.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=tokens.get('client_id'),
        client_secret=tokens.get('client_secret')
    )

    return build('calendar', 'v3', credentials=creds)


def sync_user_calendars(user, lookback_days=7):
    """
    Sync all active calendars for a user.

    Args:
        user: User model instance
        lookback_days: int - number of days to look back for events

    Returns:
        SyncLog instance with sync statistics
    """
    if not user.settings:
        logger.warning(f"User {user.id} has no settings, skipping sync")
        return None

    # Get date range as Unix timestamps
    end_time = int(datetime.now(timezone.utc).timestamp())
    start_time = end_time - (lookback_days * 86400)  # 86400 seconds per day

    # Get calendar service
    try:
        service = get_calendar_service(user)
    except Exception as e:
        logger.error(f"Failed to create calendar service for user {user.id}: {e}")
        return None

    # Get user's categories ordered by priority
    categories = get_category_priority_order(
        user.categories.outerjoin(Section).all()
    )

    # Initialize sync statistics
    events_added = 0
    events_updated = 0
    events_deleted = 0

    # Get all active calendars
    active_calendars = user.calendars.filter_by(is_active=True).all()

    for calendar in active_calendars:
        try:
            # Fetch events from Google Calendar
            google_events = fetch_calendar_events(
                service,
                calendar.calendar_id,
                start_time,
                end_time
            )

            # Process events
            stats = process_calendar_events(
                user,
                calendar,
                google_events,
                categories,
                start_time,
                end_time
            )

            events_added += stats['added']
            events_updated += stats['updated']
            events_deleted += stats['deleted']

        except Exception as e:
            logger.error(f"Error syncing calendar {calendar.id}: {e}")
            db.session.rollback()
            continue

    # Create sync log
    sync_log = SyncLog(
        user_id=user.id,
        date_range_start=start_time,
        date_range_end=end_time,
        events_added=events_added,
        events_updated=events_updated,
        events_deleted=events_deleted
    )
    db.session.add(sync_log)
    db.session.commit()

    logger.info(f"Sync complete for user {user.id}: +{events_added} ~{events_updated} -{events_deleted}")

    return sync_log


def fetch_calendar_events(service, calendar_id, start_time, end_time):
    """
    Fetch events from a specific Google Calendar with pagination.

    Google Calendar API limits results to 250 by default (max 2500).
    This function handles pagination to fetch all events in the range.

    Args:
        service: Google Calendar API service
        calendar_id: str - Google Calendar ID
        start_time: int - Unix timestamp for start of date range
        end_time: int - Unix timestamp for end of date range

    Returns:
        list of event dicts from Google Calendar API
    """
    all_events = []
    page_token = None

    while True:
        # Convert Unix timestamps to RFC3339 format for Google Calendar API
        time_min = to_google_time(start_time)
        time_max = to_google_time(end_time)

        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime',
            maxResults=2500,  # Maximum allowed
            pageToken=page_token
        ).execute()

        all_events.extend(events_result.get('items', []))

        page_token = events_result.get('nextPageToken')
        if not page_token:
            break

    logger.info(f"Fetched {len(all_events)} events from calendar {calendar_id}")
    return all_events


def process_calendar_events(user, calendar, google_events, categories, start_time, end_time):
    """
    Process events from Google Calendar and sync with database.

    Args:
        user: User model instance
        calendar: Calendar model instance
        google_events: list of event dicts from Google API
        categories: list of Category instances (priority ordered)
        start_time: int - Unix timestamp for start of sync range
        end_time: int - Unix timestamp for end of sync range

    Returns:
        dict with sync statistics: {'added': int, 'updated': int, 'deleted': int}
    """
    stats = {'added': 0, 'updated': 0, 'deleted': 0}

    # Get ALL existing events from database for this calendar (not just date range)
    # to avoid duplicate key errors
    existing_events = Event.query.filter(
        Event.calendar_id == calendar.id
    ).all()

    existing_event_map = {event.event_id: event for event in existing_events}

    # Track events in current sync range for deletion
    events_in_range = Event.query.filter(
        Event.calendar_id == calendar.id,
        Event.start_time >= start_time,
        Event.start_time <= end_time
    ).all()
    events_in_range_map = {event.event_id: event for event in events_in_range}

    google_event_ids = set()

    # Process each Google Calendar event
    for gevent in google_events:
        event_id = gevent['id']
        google_event_ids.add(event_id)

        # Parse event data
        event_data = parse_google_event(gevent, user, calendar, categories)

        if not event_data:
            continue  # Skip invalid/filtered events

        # Check if event exists in database
        if event_id in existing_event_map:
            # Update existing event if changed
            existing_event = existing_event_map[event_id]
            if has_event_changed(existing_event, event_data):
                update_event(existing_event, event_data)
                stats['updated'] += 1
        else:
            # Add new event
            new_event = Event(**event_data)
            db.session.add(new_event)
            stats['added'] += 1

    # Delete events that no longer exist in Google Calendar (only in current range)
    for event_id, event in events_in_range_map.items():
        if event_id not in google_event_ids:
            db.session.delete(event)
            stats['deleted'] += 1

    db.session.commit()

    return stats


def parse_google_event(gevent, user, calendar, categories):
    """
    Parse a Google Calendar event into database-ready format.

    Args:
        gevent: dict from Google Calendar API
        user: User model instance
        calendar: Calendar model instance
        categories: list of Category instances (priority ordered)

    Returns:
        dict with event data, or None if event should be filtered
    """
    # Get start and end times
    start = gevent.get('start', {})
    end = gevent.get('end', {})

    # Skip all-day events or events without proper time data
    if 'dateTime' not in start or 'dateTime' not in end:
        return None

    # Parse datetimes to Unix timestamps
    start_time = parse_google_time(start['dateTime'])
    end_time = parse_google_time(end['dateTime'])

    # Calculate duration in hours
    duration = (end_time - start_time) / 3600  # Convert seconds to hours

    # Filter events based on user settings
    if should_filter_event(duration, user.settings):
        return None

    # Get event color
    color_id = gevent.get('colorId')
    color_name = google_color_id_to_name(color_id)

    # Get event title
    title = gevent.get('summary', 'Untitled')

    # Find matching category
    matched_category = find_category(title, categories)

    return {
        'user_id': user.id,
        'calendar_id': calendar.id,
        'event_id': gevent['id'],
        'title': title,
        'start_time': start_time,
        'end_time': end_time,
        'duration_hours': duration,
        'color': color_name,
        'category_id': matched_category.id if matched_category else None,
        'last_synced': int(datetime.now(timezone.utc).timestamp())
    }


def has_event_changed(existing_event, new_event_data):
    """
    Check if an event has changed compared to new data.
    Uses direct integer comparisons for Unix timestamps.

    Args:
        existing_event: Event model instance
        new_event_data: dict with new event data

    Returns:
        bool: True if event has changed
    """
    title_changed = existing_event.title != new_event_data['title']
    start_changed = existing_event.start_time != new_event_data['start_time']
    end_changed = existing_event.end_time != new_event_data['end_time']
    color_changed = existing_event.color != new_event_data['color']
    category_changed = existing_event.category_id != new_event_data['category_id']

    return title_changed or start_changed or end_changed or color_changed or category_changed


def update_event(event, new_data):
    """
    Update an existing event with new data.

    Args:
        event: Event model instance
        new_data: dict with new event data
    """
    event.title = new_data['title']
    event.start_time = new_data['start_time']
    event.end_time = new_data['end_time']
    event.duration_hours = new_data['duration_hours']
    event.color = new_data['color']
    event.category_id = new_data['category_id']
    event.last_synced = int(datetime.now(timezone.utc).timestamp())
