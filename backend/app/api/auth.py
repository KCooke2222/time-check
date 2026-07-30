"""
Authentication API blueprint.
Handles Google OAuth 2.0 login and user session management.
"""

from flask import Blueprint, request, jsonify, session, redirect, current_app
from flask_login import login_user, logout_user, login_required, current_user
from authlib.integrations.requests_client import OAuth2Session
from app import db, login_manager
from app.models import User, UserSettings
from app.services.google_auth import google_connection_status
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# Google OAuth2 configuration
GOOGLE_OAUTH_SCOPE = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
]


@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for Flask-Login"""
    return User.query.get(int(user_id))


@auth_bp.route('/login', methods=['GET'])
def login():
    """Initiate Google OAuth2 login flow"""
    google = OAuth2Session(
        current_app.config['GOOGLE_CLIENT_ID'],
        current_app.config['GOOGLE_CLIENT_SECRET'],
        scope=GOOGLE_OAUTH_SCOPE,
        redirect_uri=current_app.config['GOOGLE_REDIRECT_URI']
    )

    authorization_url, state = google.create_authorization_url(
        'https://accounts.google.com/o/oauth2/v2/auth',
        access_type='offline',
        prompt='consent'
    )

    session['oauth_state'] = state

    return jsonify({
        'authorization_url': authorization_url
    })


@auth_bp.route('/callback', methods=['GET'])
def callback():
    """Handle Google OAuth2 callback"""
    if 'error' in request.args:
        return jsonify({'error': request.args['error']}), 400

    if 'code' not in request.args:
        return jsonify({'error': 'No authorization code received'}), 400

    google = OAuth2Session(
        current_app.config['GOOGLE_CLIENT_ID'],
        current_app.config['GOOGLE_CLIENT_SECRET'],
        redirect_uri=current_app.config['GOOGLE_REDIRECT_URI'],
        state=session.get('oauth_state')
    )

    try:
        token = google.fetch_token(
            'https://oauth2.googleapis.com/token',
            authorization_response=request.url,
            code=request.args['code']
        )

        # Get user info
        resp = google.get('https://www.googleapis.com/oauth2/v1/userinfo')
        user_info = resp.json()

        # Find or create user
        user = User.query.filter_by(email=user_info['email']).first()

        if not user:
            user = User(email=user_info['email'])
            db.session.add(user)
            db.session.flush()  # Get user.id

            # Create default settings
            settings = UserSettings(user_id=user.id)
            db.session.add(settings)

        # Store OAuth tokens
        token_data = {
            'access_token': token['access_token'],
            'refresh_token': token.get('refresh_token'),
            'token_type': token.get('token_type'),
            'expires_at': token.get('expires_at'),
            'client_id': current_app.config['GOOGLE_CLIENT_ID'],
            'client_secret': current_app.config['GOOGLE_CLIENT_SECRET']
        }
        user.set_tokens(token_data)

        db.session.commit()

        # Log user in
        login_user(user)

        # Redirect to frontend
        frontend_url = current_app.config['FRONTEND_URL'].rstrip('/')
        return redirect(f'{frontend_url}/dashboard')

    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return jsonify({'error': 'Authentication failed'}), 500


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Log out current user"""
    logout_user()
    return jsonify({'message': 'Logged out successfully'})


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current user info"""
    return jsonify({
        'id': current_user.id,
        'email': current_user.email,
        'created_at': current_user.created_at.isoformat()
    })


@auth_bp.route('/status', methods=['GET'])
def auth_status():
    """Check if the user is authenticated and their Google grant still works.

    A live Flask-Login session is not enough: the stored Google refresh token
    can be revoked or expire independently, and without checking it the UI
    shows a signed-in user whose every calendar call fails. `reauth_required`
    tells the frontend to send them back through the OAuth flow.
    """
    if not current_user.is_authenticated:
        return jsonify({'authenticated': False, 'reauth_required': False})

    google = google_connection_status(current_user)

    return jsonify({
        'authenticated': True,
        'google_connected': google['google_connected'],
        'reauth_required': google['reauth_required'],
        'user': {
            'id': current_user.id,
            'email': current_user.email
        }
    })
