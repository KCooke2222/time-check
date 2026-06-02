from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_mail import Mail
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from config import config
import os

db = SQLAlchemy()
login_manager = LoginManager()
mail = Mail()
scheduler = BackgroundScheduler()

def create_app(config_name='default'):
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)
    CORS(app, origins=app.config['CORS_ORIGINS'], supports_credentials=True)

    # Set login view
    login_manager.login_view = 'auth.login'

    # Register blueprints
    from app.api.auth import auth_bp
    from app.api.calendar import calendar_bp
    from app.api.reports import reports_bp
    from app.api.categories import categories_bp
    from app.api.settings import settings_bp
    from app.api.email import email_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(calendar_bp, url_prefix='/api/calendar')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(categories_bp, url_prefix='/api/categories')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(email_bp, url_prefix='/api/email')

    # Create database tables and run safe migrations
    with app.app_context():
        db.create_all()
        from sqlalchemy import text
        try:
            db.session.execute(text('ALTER TABLE sections ADD COLUMN show_in_charts BOOLEAN DEFAULT FALSE'))
            db.session.commit()
        except Exception:
            db.session.rollback()  # column already exists

    # Initialize scheduler
    if not scheduler.running:
        from app.tasks.sync_job import setup_sync_job
        setup_sync_job(app, scheduler)
        scheduler.start()

    return app
