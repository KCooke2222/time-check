import os

DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173'

def _get_cors_origins():
    # An empty or blank-entry CORS_ORIGINS must not survive: the first entry is
    # also the post-login redirect target, and '' would redirect to a path on
    # the backend itself.
    origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', '').split(',') if o.strip()]
    return origins or [DEFAULT_FRONTEND_ORIGIN]

def _get_database_url():
    url = os.environ.get('DATABASE_URL') or 'sqlite:///time_track.db'
    # Render/Railway emit postgres:// but SQLAlchemy requires postgresql://
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    return url

_DATABASE_URL = _get_database_url()
_ENGINE_OPTIONS = {'pool_pre_ping': True, 'pool_recycle': 300}
if _DATABASE_URL.startswith('sqlite'):
    _ENGINE_OPTIONS['connect_args'] = {'check_same_thread': False}

class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = _DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = _ENGINE_OPTIONS

    # Google OAuth
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
    GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI') or 'http://localhost:5000/auth/callback'

    # Email configuration
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.gmail.com'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')

    # Gemini API
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

    # Sync settings
    SYNC_INTERVAL_HOURS = int(os.environ.get('SYNC_INTERVAL_HOURS') or 1)
    SYNC_LOOKBACK_DAYS = int(os.environ.get('SYNC_LOOKBACK_DAYS') or 7)

    # CORS
    CORS_ORIGINS = _get_cors_origins()

    # Where the OAuth callback sends the browser once login succeeds. Defaults
    # to the first allowed CORS origin, which is already the frontend, so
    # moving the frontend to another port only means updating CORS_ORIGINS.
    FRONTEND_URL = os.environ.get('FRONTEND_URL', '').strip() or CORS_ORIGINS[0]

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
