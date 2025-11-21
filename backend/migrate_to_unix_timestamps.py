"""
Migration script to convert datetime columns to Unix timestamps.

This script:
1. Backs up the database
2. Converts all datetime columns to Unix timestamp integers
3. Recreates tables with new schema

Tables to migrate:
- events: start_time, end_time, last_synced
- sync_logs: sync_time, date_range_start, date_range_end
- users: created_at
- user_settings: add timezone column with default 'UTC'
"""

import sqlite3
import shutil
from datetime import datetime
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / 'instance' / 'time_track.db'
BACKUP_PATH = Path(__file__).parent / 'instance' / 'app_backup_before_unix_migration.db'


def parse_datetime_to_unix(dt_str):
    """
    Parse various datetime formats to Unix timestamp.
    Handles:
    - ISO format: "2025-11-10T14:30:00+00:00"
    - SQLite format: "2025-11-10 14:30:00.000000"
    - SQLite format without microseconds: "2025-11-10 14:30:00"
    - Already Unix timestamp (integer)
    """
    if not dt_str or dt_str == 'NULL' or dt_str is None:
        return None

    # If already an integer, return it
    if isinstance(dt_str, int):
        return dt_str

    # Try as integer string
    try:
        return int(dt_str)
    except (ValueError, TypeError):
        pass

    # Try different datetime formats
    formats = [
        '%Y-%m-%dT%H:%M:%S%z',  # ISO with timezone
        '%Y-%m-%dT%H:%M:%S',  # ISO without timezone
        '%Y-%m-%d %H:%M:%S.%f',  # SQLite with microseconds
        '%Y-%m-%d %H:%M:%S',  # SQLite without microseconds
        '%Y-%m-%d',  # Date only
    ]

    # Clean the string
    dt_clean = str(dt_str).replace('Z', '+0000')

    for fmt in formats:
        try:
            if '%z' in fmt and '+' not in dt_clean:
                continue
            dt = datetime.strptime(dt_clean.split('+')[0].split('.')[0], fmt.replace('%z', ''))

            # Check if datetime is valid (after 1970-01-01 for Windows compatibility)
            try:
                unix_ts = int(dt.timestamp())
                # Validate the timestamp is reasonable (between 1970 and 2100)
                if unix_ts < 0 or unix_ts > 4102444800:  # Jan 1, 2100
                    print(f"Warning: Datetime {dt_str} is out of range, using current time")
                    return int(datetime.now().timestamp())
                return unix_ts
            except (OSError, OverflowError, ValueError) as e:
                print(f"Warning: Error converting {dt_str} to timestamp: {e}, using current time")
                return int(datetime.now().timestamp())
        except (ValueError, AttributeError):
            continue

    print(f"Warning: Could not parse datetime: {dt_str}")
    # Return current timestamp as fallback for non-critical fields
    return int(datetime.now().timestamp())


def backup_database():
    """Create a backup of the database before migration."""
    print(f"Creating backup: {BACKUP_PATH}")
    shutil.copy2(DB_PATH, BACKUP_PATH)
    print("Backup created successfully!")


def migrate_database(conn):
    """Perform the full database migration."""
    cursor = conn.cursor()

    # Add timezone column to user_settings if it doesn't exist
    print("\nAdding timezone to user_settings...")
    cursor.execute("PRAGMA table_info(user_settings)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'timezone' not in columns:
        cursor.execute("ALTER TABLE user_settings ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC'")
        cursor.execute("UPDATE user_settings SET timezone = 'UTC' WHERE timezone IS NULL")
        print("  Added timezone column")

    # Migrate users table
    print("\nMigrating users table...")
    cursor.execute("SELECT id, email, google_oauth_tokens, created_at FROM users")
    users = cursor.fetchall()

    cursor.execute("DROP TABLE IF EXISTS users_new")
    cursor.execute("""
        CREATE TABLE users_new (
            id INTEGER PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            google_oauth_tokens TEXT,
            created_at INTEGER
        )
    """)

    for user_id, email, tokens, created_at in users:
        created_at_unix = parse_datetime_to_unix(created_at)
        cursor.execute(
            "INSERT INTO users_new (id, email, google_oauth_tokens, created_at) VALUES (?, ?, ?, ?)",
            (user_id, email, tokens, created_at_unix)
        )

    cursor.execute("DROP TABLE users")
    cursor.execute("ALTER TABLE users_new RENAME TO users")
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)")
    print(f"  Migrated {len(users)} users")

    # Migrate events table
    print("\nMigrating events table...")
    cursor.execute("""
        SELECT id, user_id, calendar_id, event_id, title, start_time, end_time,
               duration_hours, color, category_id, last_synced
        FROM events
    """)
    events = cursor.fetchall()

    cursor.execute("DROP TABLE IF EXISTS events_new")
    cursor.execute("""
        CREATE TABLE events_new (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            calendar_id INTEGER NOT NULL,
            event_id VARCHAR(255) NOT NULL,
            title VARCHAR(500) NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            duration_hours FLOAT NOT NULL,
            color VARCHAR(50),
            category_id INTEGER,
            last_synced INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (calendar_id) REFERENCES calendars (id),
            FOREIGN KEY (category_id) REFERENCES categories (id),
            UNIQUE (calendar_id, event_id)
        )
    """)

    for event in events:
        (event_id, user_id, calendar_id, g_event_id, title, start_time, end_time,
         duration_hours, color, category_id, last_synced) = event

        start_time_unix = parse_datetime_to_unix(start_time)
        end_time_unix = parse_datetime_to_unix(end_time)
        last_synced_unix = parse_datetime_to_unix(last_synced)

        cursor.execute("""
            INSERT INTO events_new
            (id, user_id, calendar_id, event_id, title, start_time, end_time,
             duration_hours, color, category_id, last_synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (event_id, user_id, calendar_id, g_event_id, title, start_time_unix, end_time_unix,
              duration_hours, color, category_id, last_synced_unix))

    cursor.execute("DROP TABLE events")
    cursor.execute("ALTER TABLE events_new RENAME TO events")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_events_user_id ON events (user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_events_start_time ON events (start_time)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_events_user_start_time ON events (user_id, start_time)")
    print(f"  Migrated {len(events)} events")

    # Migrate sync_logs table
    print("\nMigrating sync_logs table...")
    cursor.execute("""
        SELECT id, user_id, sync_time, date_range_start, date_range_end,
               events_added, events_updated, events_deleted
        FROM sync_logs
    """)
    sync_logs = cursor.fetchall()

    cursor.execute("DROP TABLE IF EXISTS sync_logs_new")
    cursor.execute("""
        CREATE TABLE sync_logs_new (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            sync_time INTEGER,
            date_range_start INTEGER NOT NULL,
            date_range_end INTEGER NOT NULL,
            events_added INTEGER DEFAULT 0,
            events_updated INTEGER DEFAULT 0,
            events_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    for i, sync_log in enumerate(sync_logs):
        (log_id, user_id, sync_time, date_range_start, date_range_end,
         events_added, events_updated, events_deleted) = sync_log

        if i % 10 == 0:  # Print progress every 10 rows
            print(f"  Processing sync log {i+1}/{len(sync_logs)}...")

        sync_time_unix = parse_datetime_to_unix(sync_time)
        date_range_start_unix = parse_datetime_to_unix(date_range_start)
        date_range_end_unix = parse_datetime_to_unix(date_range_end)

        cursor.execute("""
            INSERT INTO sync_logs_new
            (id, user_id, sync_time, date_range_start, date_range_end,
             events_added, events_updated, events_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (log_id, user_id, sync_time_unix, date_range_start_unix, date_range_end_unix,
              events_added, events_updated, events_deleted))

    cursor.execute("DROP TABLE sync_logs")
    cursor.execute("ALTER TABLE sync_logs_new RENAME TO sync_logs")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_sync_logs_user_id ON sync_logs (user_id)")
    print(f"  Migrated {len(sync_logs)} sync logs")


def main():
    """Main migration function."""
    print("=" * 60)
    print("Unix Timestamp Migration Script")
    print("=" * 60)

    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}")
        return

    # Create backup
    backup_database()

    # Connect to database
    conn = sqlite3.connect(DB_PATH)

    try:
        migrate_database(conn)

        # Commit changes
        conn.commit()
        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)
        print(f"\nBackup saved at: {BACKUP_PATH}")
        print("You can now restart the application.")

    except Exception as e:
        print(f"\nError during migration: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        print("\nChanges rolled back. Database remains unchanged.")
        print(f"You can restore from backup if needed: {BACKUP_PATH}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
