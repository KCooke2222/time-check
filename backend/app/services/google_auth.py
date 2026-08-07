"""
Google OAuth credential helpers.

The app stores one Google refresh token per user. That grant can die at any
time — the user revokes access, changes their password, or simply leaves the
app idle — and the Flask-Login session knows nothing about it. These helpers
are the single place that turns stored tokens into usable credentials, so a
dead grant surfaces as an explicit reauth-required state instead of a 500 from
deep inside a calendar call.
"""

from datetime import timezone
import logging
import time

from google.auth.exceptions import GoogleAuthError, RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from app import db

logger = logging.getLogger(__name__)

TOKEN_URI = 'https://oauth2.googleapis.com/token'

# Refresh a little before the recorded expiry so a request that takes a moment
# to reach Google does not race the deadline.
EXPIRY_SKEW_SECONDS = 60


class GoogleReauthRequired(Exception):
    """The stored Google grant is missing or no longer usable.

    `reason` is 'not_connected' when the user has no stored refresh token, and
    'expired' when Google rejected the one we have.
    """

    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


class _UserCredentials(Credentials):
    """Credentials that report a dead Google grant as GoogleReauthRequired.

    Refreshing is not confined to `get_credentials`: the API client refreshes
    lazily from inside `.execute()` whenever Google answers 401, which is what
    a revoked grant looks like while the recorded expiry is still in the
    future. Translating inside `refresh` covers both moments, so every caller
    sees one exception type no matter where the grant died.
    """

    def __init__(self, *args, user_id=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_id = user_id

    def refresh(self, request):
        try:
            super().refresh(request)
        except RefreshError as e:
            # google-auth marks the failures it considers transient (Google
            # 5xx, rate limits) as retryable. Those say nothing about the
            # grant, and signing in again cannot fix them.
            if getattr(e, 'retryable', False):
                raise
            logger.warning(f"Google refresh token rejected for user {self.user_id}: {e}")
            raise GoogleReauthRequired('expired') from e


def _credentials_from(tokens, user_id=None):
    return _UserCredentials(
        token=tokens.get('access_token'),
        refresh_token=tokens.get('refresh_token'),
        token_uri=TOKEN_URI,
        client_id=tokens.get('client_id'),
        client_secret=tokens.get('client_secret'),
        user_id=user_id
    )


def _needs_refresh(tokens):
    expires_at = tokens.get('expires_at')
    if not expires_at:
        # Unknown expiry: verify against Google rather than assume it is good.
        return True
    return time.time() >= (expires_at - EXPIRY_SKEW_SECONDS)


def get_credentials(user):
    """
    Return usable Google credentials for a user, refreshing when needed.

    Args:
        user: User model instance

    Returns:
        google.oauth2.credentials.Credentials

    Raises:
        GoogleReauthRequired: the user never connected Google, or the stored
            refresh token no longer works. Both are resolved only by sending
            the user back through the OAuth flow. The returned credentials
            raise it too if the grant dies later, mid-API-call.
        GoogleAuthError: Google could not be reached. Not proof the grant is
            dead, so callers should surface it as a plain failure.
    """
    tokens = user.get_tokens()
    if not tokens or not tokens.get('refresh_token'):
        raise GoogleReauthRequired('not_connected')

    creds = _credentials_from(tokens, user.id)
    if not _needs_refresh(tokens):
        return creds

    try:
        creds.refresh(Request())
    except GoogleAuthError as e:
        logger.error(f"Could not reach Google to refresh user {user.id}: {e}")
        raise

    tokens['access_token'] = creds.token
    if creds.expiry:
        tokens['expires_at'] = int(
            creds.expiry.replace(tzinfo=timezone.utc).timestamp()
        )
    user.set_tokens(tokens)
    db.session.commit()

    return creds


def google_connection_status(user):
    """
    Describe a user's Google connection for /api/auth/status.

    Returns:
        dict with 'google_connected' and 'reauth_required' booleans.

    A transient failure reaching Google reports the connection as still good:
    the user cannot fix a network problem by signing in again, and falsely
    bouncing them to the login screen would lose their session for nothing.
    """
    try:
        get_credentials(user)
    except GoogleReauthRequired as e:
        return {
            'google_connected': e.reason != 'not_connected',
            'reauth_required': True
        }
    except Exception:
        logger.exception(f"Could not verify Google token for user {user.id}")
        return {'google_connected': True, 'reauth_required': False}

    return {'google_connected': True, 'reauth_required': False}
