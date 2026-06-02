from datetime import datetime, timezone
from flask_login import UserMixin
from app import db
import json


class User(UserMixin, db.Model):
    """User model"""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    google_oauth_tokens = db.Column(db.Text)  # JSON string
    created_at = db.Column(db.Integer, default=lambda: int(datetime.now(timezone.utc).timestamp()))

    # Relationships
    settings = db.relationship('UserSettings', backref='user', uselist=False, cascade='all, delete-orphan')
    calendars = db.relationship('Calendar', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    events = db.relationship('Event', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    sections = db.relationship('Section', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    categories = db.relationship('Category', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    sync_logs = db.relationship('SyncLog', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_tokens(self, tokens_dict):
        """Store OAuth tokens as JSON"""
        self.google_oauth_tokens = json.dumps(tokens_dict)

    def get_tokens(self):
        """Retrieve OAuth tokens"""
        if self.google_oauth_tokens:
            return json.loads(self.google_oauth_tokens)
        return None

    def __repr__(self):
        return f'<User {self.email}>'


class UserSettings(db.Model):
    """User settings for event filtering"""
    __tablename__ = 'user_settings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    min_event_duration_hours = db.Column(db.Float, default=0.0)
    max_event_duration_hours = db.Column(db.Float, default=16.0)
    timezone = db.Column(db.String(50), default='UTC')

    def __repr__(self):
        return f'<UserSettings user_id={self.user_id}>'


class Calendar(db.Model):
    """Google Calendar reference"""
    __tablename__ = 'calendars'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    calendar_id = db.Column(db.String(255), nullable=False)  # Google Calendar ID
    name = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    events = db.relationship('Event', backref='calendar', lazy='dynamic', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'calendar_id', name='unique_user_calendar'),
    )

    def __repr__(self):
        return f'<Calendar {self.name}>'


class Section(db.Model):
    """Hierarchical folder for organizing categories - can nest inside other sections"""
    __tablename__ = 'sections'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('sections.id'), nullable=True, index=True)
    name = db.Column(db.String(100), nullable=False)
    display_order = db.Column(db.Integer, default=0)
    show_in_charts = db.Column(db.Boolean, default=False)

    # Relationships
    categories = db.relationship('Category', backref='section', lazy='dynamic', cascade='all, delete-orphan')
    children = db.relationship('Section', backref=db.backref('parent', remote_side='Section.id'), lazy='dynamic', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'name', name='unique_user_section'),
    )

    def __repr__(self):
        return f'<Section {self.name}>'

    def get_all_categories(self):
        """Recursively get all trackable categories in this section and child sections"""
        cats = list(self.categories.all())
        for child_section in self.children:
            cats.extend(child_section.get_all_categories())
        return cats


class Category(db.Model):
    """Trackable category with keywords for matching - can exist at root or in any section"""
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    section_id = db.Column(db.Integer, db.ForeignKey('sections.id'), nullable=True)  # Nullable for root-level categories
    name = db.Column(db.String(100), nullable=False)
    keywords = db.Column(db.Text, nullable=False)  # JSON array: ["2341", "algorithms"]
    display_order = db.Column(db.Integer, default=0)

    # Relationships
    events = db.relationship('Event', backref='category', lazy='dynamic')

    def get_keywords(self):
        """Get keywords as list"""
        if self.keywords:
            return json.loads(self.keywords)
        return []

    def set_keywords(self, keywords_list):
        """Set keywords from list"""
        self.keywords = json.dumps(keywords_list)

    def __repr__(self):
        return f'<Category {self.name}>'


class Event(db.Model):
    """Calendar event"""
    __tablename__ = 'events'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    calendar_id = db.Column(db.Integer, db.ForeignKey('calendars.id'), nullable=False)
    event_id = db.Column(db.String(255), nullable=False)  # Google Calendar event ID
    title = db.Column(db.String(500), nullable=False)
    start_time = db.Column(db.Integer, nullable=False, index=True)  # Unix timestamp
    end_time = db.Column(db.Integer, nullable=False)  # Unix timestamp
    duration_hours = db.Column(db.Float, nullable=False)
    color = db.Column(db.String(50))  # e.g., "blue", "green", "red"
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    last_synced = db.Column(db.Integer, default=lambda: int(datetime.now(timezone.utc).timestamp()))

    __table_args__ = (
        db.UniqueConstraint('calendar_id', 'event_id', name='unique_calendar_event'),
        db.Index('idx_user_start_time', 'user_id', 'start_time'),
    )

    def __repr__(self):
        return f'<Event {self.title} ({self.duration_hours}h)>'


class SyncLog(db.Model):
    """Log of sync operations"""
    __tablename__ = 'sync_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    sync_time = db.Column(db.Integer, default=lambda: int(datetime.now(timezone.utc).timestamp()))
    date_range_start = db.Column(db.Integer, nullable=False)
    date_range_end = db.Column(db.Integer, nullable=False)
    events_added = db.Column(db.Integer, default=0)
    events_updated = db.Column(db.Integer, default=0)
    events_deleted = db.Column(db.Integer, default=0)

    def __repr__(self):
        return f'<SyncLog {self.sync_time} (+{self.events_added} ~{self.events_updated} -{self.events_deleted})>'
