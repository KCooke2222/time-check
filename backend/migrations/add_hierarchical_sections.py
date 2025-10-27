"""
Database migration: Add hierarchical sections support
Adds parent_id column to sections table to allow nested sections
Also makes section_id nullable in categories table for root-level categories
"""

from sqlalchemy import text

def upgrade(db):
    """Apply migration"""
    with db.engine.connect() as conn:
        # Add parent_id column to sections
        conn.execute(text("""
            ALTER TABLE sections
            ADD COLUMN parent_id INTEGER NULL
        """))

        # Add foreign key constraint for parent_id
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_sections_parent_id ON sections(parent_id)
        """))

        # Make section_id nullable in categories (for root-level categories)
        # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
        # First, check if we're using SQLite
        conn.execute(text("""
            PRAGMA foreign_keys=off
        """))

        # Create new categories table with nullable section_id
        conn.execute(text("""
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
        """))

        # Copy data
        conn.execute(text("""
            INSERT INTO categories_new (id, user_id, section_id, name, keywords, display_order)
            SELECT id, user_id, section_id, name, keywords, display_order
            FROM categories
        """))

        # Drop old table
        conn.execute(text("DROP TABLE categories"))

        # Rename new table
        conn.execute(text("ALTER TABLE categories_new RENAME TO categories"))

        # Recreate indexes
        conn.execute(text("CREATE INDEX idx_categories_user_id ON categories(user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_categories_section_id ON categories(section_id)"))

        conn.execute(text("PRAGMA foreign_keys=on"))

        conn.commit()

def downgrade(db):
    """Revert migration"""
    with db.engine.connect() as conn:
        # Remove parent_id from sections
        # SQLite doesn't support DROP COLUMN easily, so this is a simplified version
        print("Downgrade not fully implemented for SQLite")
        print("Manual intervention required to revert changes")
        conn.commit()

if __name__ == '__main__':
    print("This migration adds hierarchical sections support")
    print("Run this from your Flask app context:")
    print("")
    print("from app import db")
    print("from migrations.add_hierarchical_sections import upgrade")
    print("upgrade(db)")
