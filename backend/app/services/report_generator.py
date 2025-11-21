"""
Report generation service.
Generates weekly and date range reports similar to the original Google Apps Script.
"""

from datetime import datetime, timezone
from sqlalchemy import func
from app import db
from app.models import Event, Category, Section
from app.utils.helpers import get_week_start, get_week_end, calculate_intensity_hours, format_timestamp_iso


def build_hierarchical_section_summary(section_totals, user):
    """
    Build hierarchical section summary by aggregating children up to parents.

    Args:
        section_totals: dict of {section_id: {'name', 'raw_hours', 'intensity_hours'}}
        user: User model instance

    Returns:
        list of section dicts with hierarchical structure and aggregated hours
    """
    # Get all user sections
    all_sections = Section.query.filter_by(user_id=user.id).all()
    section_map = {s.id: s for s in all_sections}

    # Initialize result dict with direct hours from events
    result = {}
    for sec_id, data in section_totals.items():
        if sec_id:  # Skip None (uncategorized)
            result[sec_id] = {
                'id': sec_id,
                'name': data['name'],
                'parent_id': section_map[sec_id].parent_id if sec_id in section_map else None,
                'direct_raw_hours': data['raw_hours'],
                'direct_intensity_hours': data['intensity_hours'],
                'total_raw_hours': data['raw_hours'],  # Will be updated with children
                'total_intensity_hours': data['intensity_hours'],
                'children': []
            }

    # Add sections that exist but have no direct events
    for section in all_sections:
        if section.id not in result:
            result[section.id] = {
                'id': section.id,
                'name': section.name,
                'parent_id': section.parent_id,
                'direct_raw_hours': 0.0,
                'direct_intensity_hours': 0.0,
                'total_raw_hours': 0.0,
                'total_intensity_hours': 0.0,
                'children': []
            }

    # Build tree structure and aggregate up
    def aggregate_children(section_id):
        """Recursively aggregate children hours"""
        if section_id not in result:
            return 0.0, 0.0

        section_data = result[section_id]
        total_raw = section_data['direct_raw_hours']
        total_intensity = section_data['direct_intensity_hours']

        # Find all children
        for other_id, other_data in result.items():
            if other_data['parent_id'] == section_id:
                child_raw, child_intensity = aggregate_children(other_id)
                total_raw += child_raw
                total_intensity += child_intensity
                section_data['children'].append(other_id)

        section_data['total_raw_hours'] = total_raw
        section_data['total_intensity_hours'] = total_intensity

        return total_raw, total_intensity

    # Aggregate from root sections down
    root_sections = [sid for sid, data in result.items() if data['parent_id'] is None]
    for root_id in root_sections:
        aggregate_children(root_id)

    # Convert to list, keep only root sections (children are in 'children' field)
    return [data for data in result.values() if data['parent_id'] is None]


def generate_weekly_report(user, week_date_unix_ts):
    """
    Generate a weekly report for a specific week.
    This is a convenience wrapper around generate_range_report for a single week.

    Args:
        user: User model instance
        week_date_unix_ts: int - Unix timestamp for any date within the target week

    Returns:
        dict with report data - same format as range report but for single week
    """
    # Get user timezone for week boundary calculations
    user_timezone = user.settings.timezone if user.settings else 'UTC'

    week_start = get_week_start(week_date_unix_ts, user_timezone)
    week_end = get_week_end(week_date_unix_ts, user_timezone)

    # Use range report for summaries (ensures consistent totals logic)
    # Pass skip_normalize=True to avoid double-normalization
    range_report = generate_range_report(user, week_start, week_end, skip_normalize=True)

    # Get event details for weekly view (range report doesn't include event list)
    # Note: week_end is exclusive (Sunday 00:00:00 of next week)
    events = Event.query.filter(
        Event.user_id == user.id,
        Event.start_time >= week_start,
        Event.start_time < week_end
    ).order_by(Event.start_time).all()

    event_list = []
    for event in events:
        intensity_hours = calculate_intensity_hours(event, user.settings)
        event_dict = {
            'id': event.id,
            'title': event.title,
            'start_time': format_timestamp_iso(event.start_time),
            'end_time': format_timestamp_iso(event.end_time),
            'duration_hours': event.duration_hours,
            'intensity_hours': intensity_hours,
            'color': event.color,
            'category_name': event.category.name if event.category else 'Uncategorized',
            'category_id': event.category_id,
            'section_name': event.category.section.name if (event.category and event.category.section) else None,
            'section_id': event.category.section_id if event.category else None
        }
        event_list.append(event_dict)

    # Convert range report format to weekly format
    # Range report has _total suffix, weekly doesn't
    category_summary = {}
    for cat_id, cat_data in range_report['category_summary'].items():
        category_summary[cat_id] = {
            'name': cat_data['name'],
            'section_name': cat_data['section_name'],
            'raw_hours': cat_data['raw_hours_total'],
            'intensity_hours': cat_data['intensity_hours_total']
        }

    section_summary = {}
    for sec_id, sec_data in range_report['section_summary'].items():
        section_summary[sec_id] = {
            'name': sec_data['name'],
            'raw_hours': sec_data['raw_hours_total'],
            'intensity_hours': sec_data['intensity_hours_total']
        }

    return {
        'week_start': format_timestamp_iso(week_start),
        'week_end': format_timestamp_iso(week_end),
        'events': event_list,
        'category_summary': category_summary,
        'section_summary': section_summary,
        'section_hierarchy': range_report['section_hierarchy'],
        'totals': {
            'raw_hours': range_report['totals']['raw_hours_total'],
            'intensity_hours': range_report['totals']['intensity_hours_total']
        }
    }


def generate_range_report(user, start_unix_ts, end_unix_ts, skip_normalize=False):
    """
    Generate a date range report aggregating multiple weeks.

    Args:
        user: User model instance
        start_unix_ts: int - Unix timestamp for range start
        end_unix_ts: int - Unix timestamp for range end
        skip_normalize: bool - If True, use timestamps as-is without normalizing to week boundaries

    Returns:
        dict with report data:
        {
            'date_range_start': str (ISO format),
            'date_range_end': str (ISO format),
            'weeks_count': int,
            'category_summary': {category_id: {
                'name': str,
                'raw_hours_total': float,
                'intensity_hours_total': float,
                'weeks_present': int,
                'raw_hours_avg': float,
                'intensity_hours_avg': float
            }},
            'section_summary': {...},
            'totals': {
                'raw_hours_total': float,
                'intensity_hours_total': float,
                'raw_hours_avg_per_week': float,
                'intensity_hours_avg_per_week': float
            }
        }
    """
    # Get user timezone for week boundary calculations
    user_timezone = user.settings.timezone if user.settings else 'UTC'

    # Normalize to week boundaries (unless already normalized)
    if skip_normalize:
        range_start = start_unix_ts
        range_end = end_unix_ts
    else:
        range_start = get_week_start(start_unix_ts, user_timezone)
        range_end = get_week_end(end_unix_ts, user_timezone)

    # Get all events in range
    # Note: range_end is exclusive (Sunday 00:00:00 of next week)
    events = Event.query.filter(
        Event.user_id == user.id,
        Event.start_time >= range_start,
        Event.start_time < range_end
    ).all()

    # Calculate number of weeks (Unix timestamps are in seconds)
    # Since range_end is exclusive (next Sunday 00:00:00), we don't need the +1
    weeks_count = (range_end - range_start) // (7 * 86400)

    # Track which weeks each category appears in
    category_week_presence = {}  # {category_id: set of week_start timestamps}
    category_totals = {}
    section_week_presence = {}
    section_totals = {}
    total_raw_hours = 0.0
    total_intensity_hours = 0.0

    for event in events:
        event_week_start = get_week_start(event.start_time, user_timezone)
        intensity_hours = calculate_intensity_hours(event, user.settings)

        

        if event.category:
            # Update totals only if event is categorized
            total_raw_hours += event.duration_hours
            total_intensity_hours += intensity_hours

            cat_id = event.category.id

            # Track category presence across weeks
            if cat_id not in category_week_presence:
                category_week_presence[cat_id] = set()
            category_week_presence[cat_id].add(event_week_start)

            # Category totals
            if cat_id not in category_totals:
                category_totals[cat_id] = {
                    'name': event.category.name,
                    'section_name': event.category.section.name if event.category.section else None,
                    'raw_hours_total': 0.0,
                    'intensity_hours_total': 0.0
                }
            category_totals[cat_id]['raw_hours_total'] += event.duration_hours
            category_totals[cat_id]['intensity_hours_total'] += intensity_hours

            # Section presence and totals
            sec_id = event.category.section_id
            if sec_id:
                if sec_id not in section_week_presence:
                    section_week_presence[sec_id] = set()
                section_week_presence[sec_id].add(event_week_start)

                if sec_id not in section_totals:
                    section_totals[sec_id] = {
                        'name': event.category.section.name if event.category.section else None,
                        'raw_hours_total': 0.0,
                        'intensity_hours_total': 0.0
                    }
                section_totals[sec_id]['raw_hours_total'] += event.duration_hours
                section_totals[sec_id]['intensity_hours_total'] += intensity_hours

    # Calculate averages
    for cat_id, data in category_totals.items():
        weeks_present = len(category_week_presence[cat_id])
        data['weeks_present'] = weeks_present
        data['raw_hours_avg'] = data['raw_hours_total'] / weeks_present if weeks_present > 0 else 0.0
        data['intensity_hours_avg'] = data['intensity_hours_total'] / weeks_present if weeks_present > 0 else 0.0

    for sec_id, data in section_totals.items():
        weeks_present = len(section_week_presence[sec_id])
        data['weeks_present'] = weeks_present
        data['raw_hours_avg'] = data['raw_hours_total'] / weeks_present if weeks_present > 0 else 0.0
        data['intensity_hours_avg'] = data['intensity_hours_total'] / weeks_present if weeks_present > 0 else 0.0

    # Build hierarchical section summary for range report
    # Convert totals to match weekly format temporarily
    section_totals_for_hierarchy = {}
    for sec_id, data in section_totals.items():
        if sec_id:
            section_totals_for_hierarchy[sec_id] = {
                'name': data['name'],
                'raw_hours': data['raw_hours_total'],
                'intensity_hours': data['intensity_hours_total']
            }

    hierarchical_sections = build_hierarchical_section_summary(section_totals_for_hierarchy, user)

    # Add week presence and averages to hierarchical sections
    def add_week_stats(sections_list):
        for section in sections_list:
            sec_id = section['id']
            if sec_id in section_week_presence:
                weeks = len(section_week_presence[sec_id])
                section['weeks_present'] = weeks
                section['raw_hours_avg'] = section['total_raw_hours'] / weeks if weeks > 0 else 0.0
                section['intensity_hours_avg'] = section['total_intensity_hours'] / weeks if weeks > 0 else 0.0
            else:
                section['weeks_present'] = 0
                section['raw_hours_avg'] = 0.0
                section['intensity_hours_avg'] = 0.0

            # Recursively process children
            if section['children']:
                child_sections = [s for s in sections_list if s['id'] in section['children']]
                add_week_stats(child_sections)

    # Get all sections for recursive processing
    all_hierarchy_sections = []
    def collect_all(sections_list):
        for sec in sections_list:
            all_hierarchy_sections.append(sec)
            if sec['children']:
                collect_all([s for s in hierarchical_sections if s['id'] in sec['children']])

    collect_all(hierarchical_sections)
    add_week_stats(all_hierarchy_sections)

    return {
        'date_range_start': format_timestamp_iso(range_start),
        'date_range_end': format_timestamp_iso(range_end),
        'weeks_count': weeks_count,
        'category_summary': category_totals,
        'section_summary': section_totals,  # Flat summary (backward compat)
        'section_hierarchy': hierarchical_sections,  # NEW: Hierarchical tree with aggregation
        'totals': {
            'raw_hours_total': total_raw_hours,
            'intensity_hours_total': total_intensity_hours,
            'raw_hours_avg_per_week': total_raw_hours / weeks_count if weeks_count > 0 else 0.0,
            'intensity_hours_avg_per_week': total_intensity_hours / weeks_count if weeks_count > 0 else 0.0
        }
    }


def get_current_week_summary(user):
    """
    Get a summary of the current week (convenience function).

    Args:
        user: User model instance

    Returns:
        dict with current week summary
    """
    current_unix_ts = int(datetime.now(timezone.utc).timestamp())
    return generate_weekly_report(user, current_unix_ts)
