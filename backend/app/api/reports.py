"""
Reports API blueprint.
Handles report generation and retrieval.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.report_generator import generate_weekly_report, generate_range_report, get_current_week_summary
from app.utils.helpers import parse_date_string
from datetime import datetime
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
        target_date = parse_date_string(date_param)
        if not target_date:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    else:
        target_date = datetime.utcnow()

    try:
        report = generate_weekly_report(current_user, target_date)
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

    start_date = parse_date_string(start_param)
    end_date = parse_date_string(end_param)

    if not start_date or not end_date:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if start_date > end_date:
        return jsonify({'error': 'Start date must be before end date'}), 400

    try:
        report = generate_range_report(current_user, start_date, end_date)
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
