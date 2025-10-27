"""
Settings API blueprint.
Handles user settings management.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
import logging

logger = logging.getLogger(__name__)

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/', methods=['GET'])
@login_required
def get_settings():
    """Get user settings"""
    if not current_user.settings:
        return jsonify({'error': 'Settings not found'}), 404

    settings = current_user.settings

    return jsonify({
        'min_event_duration_hours': settings.min_event_duration_hours,
        'max_event_duration_hours': settings.max_event_duration_hours,
        'intensity_multipliers': settings.get_multipliers()
    })


@settings_bp.route('/', methods=['PUT'])
@login_required
def update_settings():
    """Update user settings"""
    if not current_user.settings:
        return jsonify({'error': 'Settings not found'}), 404

    settings = current_user.settings
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Update min/max duration
    if 'min_event_duration_hours' in data:
        try:
            min_hours = float(data['min_event_duration_hours'])
            if min_hours < 0:
                return jsonify({'error': 'min_event_duration_hours must be >= 0'}), 400
            settings.min_event_duration_hours = min_hours
        except (ValueError, TypeError):
            return jsonify({'error': 'min_event_duration_hours must be a number'}), 400

    if 'max_event_duration_hours' in data:
        try:
            max_hours = float(data['max_event_duration_hours'])
            if max_hours <= 0:
                return jsonify({'error': 'max_event_duration_hours must be > 0'}), 400
            settings.max_event_duration_hours = max_hours
        except (ValueError, TypeError):
            return jsonify({'error': 'max_event_duration_hours must be a number'}), 400

    # Validate min < max
    if settings.min_event_duration_hours >= settings.max_event_duration_hours:
        return jsonify({'error': 'min_event_duration_hours must be less than max_event_duration_hours'}), 400

    # Update intensity multipliers
    if 'intensity_multipliers' in data:
        multipliers = data['intensity_multipliers']

        if not isinstance(multipliers, dict):
            return jsonify({'error': 'intensity_multipliers must be an object'}), 400

        # Validate multipliers
        for color, value in multipliers.items():
            try:
                float_value = float(value)
                if float_value <= 0:
                    return jsonify({'error': f'Multiplier for {color} must be > 0'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': f'Multiplier for {color} must be a number'}), 400

        settings.set_multipliers(multipliers)

    db.session.commit()

    return jsonify({
        'message': 'Settings updated successfully',
        'settings': {
            'min_event_duration_hours': settings.min_event_duration_hours,
            'max_event_duration_hours': settings.max_event_duration_hours,
            'intensity_multipliers': settings.get_multipliers()
        }
    })


@settings_bp.route('/reset-multipliers', methods=['POST'])
@login_required
def reset_multipliers():
    """Reset intensity multipliers to defaults"""
    if not current_user.settings:
        return jsonify({'error': 'Settings not found'}), 404

    settings = current_user.settings
    settings.set_default_multipliers()
    db.session.commit()

    return jsonify({
        'message': 'Multipliers reset to defaults',
        'intensity_multipliers': settings.get_multipliers()
    })
