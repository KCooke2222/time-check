"""
Email API blueprint.
Handles email sending for reports.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.email_service import send_weekly_report_email
from app.utils.helpers import parse_date_string
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

email_bp = Blueprint('email', __name__)


@email_bp.route('/send-weekly-report', methods=['POST'])
@login_required
def send_weekly_report():
    """
    Send weekly report email.
    Optional JSON body: {"week_date": "YYYY-MM-DD"}
    If not provided, uses previous week.
    """
    data = request.get_json() or {}
    week_date = None

    if 'week_date' in data:
        week_date = parse_date_string(data['week_date'])
        if not week_date:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    try:
        success = send_weekly_report_email(current_user, week_date)

        if success:
            return jsonify({
                'message': f'Weekly report email sent to {current_user.email}'
            })
        else:
            return jsonify({'error': 'Failed to send email'}), 500

    except Exception as e:
        logger.error(f"Email send error: {e}")
        return jsonify({'error': str(e)}), 500
