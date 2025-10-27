"""
Database migration: Rename keywords to tags
This is a simple rename - no schema changes needed, just terminology
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'time_track.db')

def migrate():
    print("Renaming 'keywords' to 'tags'")
    print("=" * 50)
    print("Note: This is just a terminology change in the application.")
    print("Database column name stays as 'keywords' for compatibility.")
    print()
    print("✓ Migration complete (no database changes needed)")
    print()
    print("The frontend will now refer to keywords as 'tags'.")
    return True

if __name__ == '__main__':
    migrate()
