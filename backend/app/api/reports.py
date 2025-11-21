"""
Reports API blueprint.
Handles report generation and retrieval.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.report_generator import generate_weekly_report, generate_range_report, get_current_week_summary
from app.utils.helpers import parse_user_date
from datetime import datetime, timezone
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

    if date_param:
        # Get user timezone for date parsing
        user_timezone = current_user.settings.timezone if current_user.settings else 'UTC'
        target_unix_ts = parse_user_date(date_param, user_timezone)
        if not target_unix_ts:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    else:
        target_unix_ts = int(datetime.now(timezone.utc).timestamp())

    try:
        report = generate_weekly_report(current_user, target_unix_ts)
        return jsonify(report)

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

    # Get user timezone for date parsing
    user_timezone = current_user.settings.timezone if current_user.settings else 'UTC'

    start_unix_ts = parse_user_date(start_param, user_timezone)
    end_unix_ts = parse_user_date(end_param, user_timezone)

    if not start_unix_ts or not end_unix_ts:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if start_unix_ts > end_unix_ts:
        return jsonify({'error': 'Start date must be before end date'}), 400

    try:
        report = generate_range_report(current_user, start_unix_ts, end_unix_ts)
        return jsonify(report)

    except Exception as e:
        logger.error(f"Range report error: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/current-week', methods=['GET'])
@login_required
def current_week():
    """Get current week summary (convenience endpoint)"""
    try:
        summary = get_current_week_summary(current_user)
        return jsonify(summary)

    except Exception as e:
        logger.error(f"Current week summary error: {e}")
        return jsonify({'error': str(e)}), 500
