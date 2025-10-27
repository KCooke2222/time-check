"""
APScheduler sync job.
Runs calendar sync on startup and hourly.
"""

from app.models import User
from app.services.calendar_sync import sync_user_calendars
import logging

logger = logging.getLogger(__name__)


def sync_all_users():
    """Sync calendars for all users"""
    logger.info("Starting scheduled sync for all users")

    # Import here to avoid circular imports
    from app import db

    users = User.query.all()

    for user in users:
        try:
            if not user.settings:
                logger.warning(f"User {user.id} has no settings, skipping")
                continue

            logger.info(f"Syncing calendars for user {user.id}")
            sync_log = sync_user_calendars(user)

            if sync_log:
                logger.info(
                    f"User {user.id} sync complete: "
                    f"+{sync_log.events_added} ~{sync_log.events_updated} -{sync_log.events_deleted}"
                )

        except Exception as e:
            logger.error(f"Error syncing user {user.id}: {e}")
            continue

    logger.info("Scheduled sync completed for all users")


def setup_sync_job(app, scheduler):
    """
    Set up APScheduler jobs for calendar sync.

    Args:
        app: Flask app instance
        scheduler: APScheduler BackgroundScheduler instance
    """
    # Get sync interval from config
    sync_interval_hours = app.config.get('SYNC_INTERVAL_HOURS', 1)

    # Add job to run on startup (after a 10-second delay to let app fully initialize)
    scheduler.add_job(
        func=lambda: sync_with_app_context(app),
        trigger='date',
        run_date=None,  # Run immediately when scheduler starts
        id='startup_sync',
        name='Initial sync on startup',
        replace_existing=True
    )

    # Add job to run hourly
    scheduler.add_job(
        func=lambda: sync_with_app_context(app),
        trigger='interval',
        hours=sync_interval_hours,
        id='hourly_sync',
        name=f'Sync every {sync_interval_hours} hour(s)',
        replace_existing=True
    )

    logger.info(f"Sync jobs configured: startup + every {sync_interval_hours} hour(s)")


def sync_with_app_context(app):
    """
    Run sync with Flask app context.

    Args:
        app: Flask app instance
    """
    with app.app_context():
        sync_all_users()
