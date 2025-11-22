"""
Reports API blueprint.
Handles report generation and retrieval.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.report_generator import generate_range_report
from datetime import datetime, timedelta
import pytz
import logging

logger = logging.getLogger(__name__)

reports_bp = Blueprint('reports', __name__)


@reports_bp.route('/weekly', methods=['GET'])
@login_required
def weekly_report():
    """
    Get weekly report.
    Query param: date (YYYY-MM-DD) - any date within the target week
    If not provided, uses current week.
    """
    date_param = request.args.get('date')
    user_timezone = current_user.settings.timezone if current_user.settings else 'UTC'

    try:
        # Determine the target date
        if date_param:
            target_date = datetime.strptime(date_param, '%Y-%m-%d').date()
        else:
            # Use current date in user's timezone
            tz = pytz.timezone(user_timezone)
            target_date = datetime.now(tz).date()

        # Calculate week boundaries (Sunday to Saturday)
        # Python: 0=Monday, 6=Sunday
        days_since_sunday = (target_date.weekday() + 1) % 7
        week_start_date = target_date - timedelta(days=days_since_sunday)
        week_end_date = week_start_date + timedelta(days=6)

        # Convert to ISO format
        start_iso = week_start_date.strftime('%Y-%m-%d')
        end_iso = week_end_date.strftime('%Y-%m-%d')

        # Generate report
        report = generate_range_report(current_user, start_iso, end_iso, include_events=True)

        # Rename keys for backward compatibility with frontend
        report['week_start'] = report.pop('date_range_start')
        report['week_end'] = report.pop('date_range_end')

        return jsonify(report)

    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    except Exception as e:
        logger.error(f"Weekly report error: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/range', methods=['GET'])
@login_required
def range_report():
    """
    Get date range report.
    Query params:
    - start (YYYY-MM-DD) - required
    - end (YYYY-MM-DD) - required
    """
    start_param = request.args.get('start')
    end_param = request.args.get('end')

    if not start_param or not end_param:
        return jsonify({'error': 'Both start and end dates are required'}), 400

    try:
        # Validate date format
        datetime.strptime(start_param, '%Y-%m-%d')
        datetime.strptime(end_param, '%Y-%m-%d')

        # Generate report
        report = generate_range_report(current_user, start_param, end_param, include_events=False)

        return jsonify(report)

    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    except Exception as e:
        logger.error(f"Range report error: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/current-week', methods=['GET'])
@login_required
def current_week():
    """Get current week summary (convenience endpoint)"""
    user_timezone = current_user.settings.timezone if current_user.settings else 'UTC'

    try:
        # Use current date in user's timezone
        tz = pytz.timezone(user_timezone)
        target_date = datetime.now(tz).date()

        # Calculate week boundaries (Sunday to Saturday)
        days_since_sunday = (target_date.weekday() + 1) % 7
        week_start_date = target_date - timedelta(days=days_since_sunday)
        week_end_date = week_start_date + timedelta(days=6)

        # Convert to ISO format
        start_iso = week_start_date.strftime('%Y-%m-%d')
        end_iso = week_end_date.strftime('%Y-%m-%d')

        # Generate report
        report = generate_range_report(current_user, start_iso, end_iso, include_events=True)

        # Rename keys for backward compatibility with frontend
        report['week_start'] = report.pop('date_range_start')
        report['week_end'] = report.pop('date_range_end')

        return jsonify(report)

    except Exception as e:
        logger.error(f"Current week summary error: {e}")
        return jsonify({'error': str(e)}), 500
