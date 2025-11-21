"""
Calendar API blueprint.
Handles calendar management and sync operations.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Calendar
from app.services.calendar_sync import sync_user_calendars
from app.utils.helpers import format_timestamp_iso
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import logging

logger = logging.getLogger(__name__)

calendar_bp = Blueprint('calendar', __name__)


@calendar_bp.route('/list', methods=['GET'])
@login_required
def list_calendars():
    """Get all calendars for current user"""
    calendars = current_user.calendars.all()

    return jsonify({
        'calendars': [{
            'id': cal.id,
            'calendar_id': cal.calendar_id,
            'name': cal.name,
            'is_active': cal.is_active
        } for cal in calendars]
    })


@calendar_bp.route('/discover', methods=['GET'])
@login_required
def discover_calendars():
    """Discover available Google Calendars for the user"""
    try:
        # Get user's OAuth tokens
        tokens = current_user.get_tokens()
        if not tokens:
            return jsonify({'error': 'No OAuth tokens found'}), 401

        # Create credentials
        creds = Credentials(
            token=tokens.get('access_token'),
            refresh_token=tokens.get('refresh_token'),
            token_uri='https://oauth2.googleapis.com/token',
            client_id=tokens.get('client_id'),
            client_secret=tokens.get('client_secret')
        )

        # Get calendar list from Google
        service = build('calendar', 'v3', credentials=creds)
        calendar_list = service.calendarList().list().execute()

        # Get existing calendar IDs
        existing_ids = {cal.calendar_id for cal in current_user.calendars.all()}

        # Return calendars with status
        calendars = []
        for item in calendar_list.get('items', []):
            calendars.append({
                'calendar_id': item['id'],
                'name': item['summary'],
                'is_added': item['id'] in existing_ids
            })

        return jsonify({'calendars': calendars})

    except Exception as e:
        logger.error(f"Error discovering calendars: {e}")
        return jsonify({'error': str(e)}), 500


@calendar_bp.route('/add', methods=['POST'])
@login_required
def add_calendar():
    """Add a calendar to track"""
    data = request.get_json()

    if not data or 'calendar_id' not in data or 'name' not in data:
        return jsonify({'error': 'Missing calendar_id or name'}), 400

    # Check if calendar already exists
    existing = Calendar.query.filter_by(
        user_id=current_user.id,
        calendar_id=data['calendar_id']
    ).first()

    if existing:
        return jsonify({'error': 'Calendar already added'}), 400

    # Add calendar
    calendar = Calendar(
        user_id=current_user.id,
        calendar_id=data['calendar_id'],
        name=data['name'],
        is_active=True
    )

    db.session.add(calendar)
    db.session.commit()

    return jsonify({
        'message': 'Calendar added successfully',
        'calendar': {
            'id': calendar.id,
            'calendar_id': calendar.calendar_id,
            'name': calendar.name,
            'is_active': calendar.is_active
        }
    }), 201


@calendar_bp.route('/<int:calendar_id>/toggle', methods=['PUT'])
@login_required
def toggle_calendar(calendar_id):
    """Toggle calendar active status"""
    calendar = Calendar.query.filter_by(
        id=calendar_id,
        user_id=current_user.id
    ).first()

    if not calendar:
        return jsonify({'error': 'Calendar not found'}), 404

    calendar.is_active = not calendar.is_active
    db.session.commit()

    return jsonify({
        'message': 'Calendar status updated',
        'is_active': calendar.is_active
    })


@calendar_bp.route('/<int:calendar_id>', methods=['DELETE'])
@login_required
def delete_calendar(calendar_id):
    """Delete a calendar (and all its events)"""
    calendar = Calendar.query.filter_by(
        id=calendar_id,
        user_id=current_user.id
    ).first()

    if not calendar:
        return jsonify({'error': 'Calendar not found'}), 404

    db.session.delete(calendar)
    db.session.commit()

    return jsonify({'message': 'Calendar deleted successfully'})


@calendar_bp.route('/sync', methods=['POST'])
@login_required
def manual_sync():
    """Manually trigger calendar sync with optional lookback days"""
    try:
        data = request.get_json() or {}
        lookback_days = data.get('lookback_days', 7)

        sync_log = sync_user_calendars(current_user, lookback_days=lookback_days)

        if not sync_log:
            return jsonify({'error': 'Sync failed'}), 500

        # Get user timezone for timestamp formatting
        user_timezone = current_user.settings.timezone if current_user.settings else 'UTC'

        return jsonify({
            'message': 'Sync completed successfully',
            'stats': {
                'events_added': sync_log.events_added,
                'events_updated': sync_log.events_updated,
                'events_deleted': sync_log.events_deleted,
                'sync_time': format_timestamp_iso(sync_log.sync_time, user_timezone),
                'lookback_days': lookback_days
            }
        })

    except Exception as e:
        logger.error(f"Manual sync error: {e}")
        return jsonify({'error': str(e)}), 500


@calendar_bp.route('/sync/stats', methods=['GET'])
@login_required
def sync_stats():
    """Get sync statistics for the user"""
    from app.models import Event, SyncLog
    from sqlalchemy import func

    # Get user timezone for timestamp formatting
    user_timezone = current_user.settings.timezone if current_user.settings else 'UTC'

    # Get oldest event
    oldest_event = Event.query.filter_by(user_id=current_user.id).order_by(Event.start_time.asc()).first()

    # Get latest sync log
    latest_sync = SyncLog.query.filter_by(user_id=current_user.id).order_by(SyncLog.sync_time.desc()).first()

    # Get total events count
    total_events = Event.query.filter_by(user_id=current_user.id).count()

    return jsonify({
        'oldest_event_date': format_timestamp_iso(oldest_event.start_time, user_timezone) if oldest_event else None,
        'latest_sync_time': format_timestamp_iso(latest_sync.sync_time, user_timezone) if latest_sync else None,
        'total_events': total_events,
        'last_sync_stats': {
            'events_added': latest_sync.events_added if latest_sync else 0,
            'events_updated': latest_sync.events_updated if latest_sync else 0,
            'events_deleted': latest_sync.events_deleted if latest_sync else 0,
        } if latest_sync else None
    })
