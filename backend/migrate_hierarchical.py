"""
Simple migration script to add hierarchical sections support
Run this with: python migrate_hierarchical.py
"""

import sqlite3
import os

# Path to your database
DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'time_track.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("Starting migration...")

        # Step 1: Add parent_id to sections table
        print("1. Adding parent_id column to sections table...")
        cursor.execute("""
            ALTER TABLE sections ADD COLUMN parent_id INTEGER NULL
        """)
        print("   ✓ parent_id column added")

        # Step 2: Create index on parent_id
        print("2. Creating index on parent_id...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sections_parent_id ON sections(parent_id)
        """)
        print("   ✓ Index created")

        # Step 3: Make section_id nullable in categories
        # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
        print("3. Making section_id nullable in categories table...")

        # Disable foreign keys temporarily
        cursor.execute("PRAGMA foreign_keys=off")

        # Create new table
        cursor.execute("""
            CREATE TABLE categories_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                section_id INTEGER NULL,
                name VARCHAR(100) NOT NULL,
                keywords TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (section_id) REFERENCES sections(id)
            )
        """)

        # Copy data
        cursor.execute("""
            INSERT INTO categories_new (id, user_id, section_id, name, keywords, display_order)
            SELECT id, user_id, section_id, name, keywords, display_order
            FROM categories
        """)

        # Drop old table
        cursor.execute("DROP TABLE categories")

        # Rename new table
        cursor.execute("ALTER TABLE categories_new RENAME TO categories")

        # Recreate indexes
        cursor.execute("CREATE INDEX idx_categories_user_id ON categories(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_categories_section_id ON categories(section_id)")

        # Re-enable foreign keys
        cursor.execute("PRAGMA foreign_keys=on")

        print("   ✓ section_id is now nullable")

        # Commit all changes
        conn.commit()
        print("\n✓ Migration completed successfully!")
        print("\nYou can now:")
        print("  - Nest sections inside other sections")
        print("  - Create root-level categories without a section")

    except sqlite3.Error as e:
        print(f"\n✗ Migration failed: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()

    return True

if __name__ == '__main__':
    print("Hierarchical Sections Migration")
    print("=" * 50)
    print(f"Database: {DB_PATH}")
    print()

    if not os.path.exists(DB_PATH):
        print(f"✗ Database not found at {DB_PATH}")
        print("Please check the path and try again.")
        exit(1)

    # Confirm before running
    response = input("Run migration? (yes/no): ")
    if response.lower() in ['yes', 'y']:
        success = migrate()
        exit(0 if success else 1)
    else:
        print("Migration cancelled.")
