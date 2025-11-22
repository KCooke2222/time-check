"""
Report generation service.
Processes events into aggregated reports with category and section summaries.
"""

from datetime import datetime, timedelta
import pytz
from app.models import Section
from app.services.event_queries import get_events_between
from app.utils.helpers import calculate_intensity_hours, format_timestamp_iso


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


def generate_range_report(user, start_iso, end_iso, include_events=False):
    """
    Generate a date range report for ISO date range.
    Fetches events and processes them into aggregated report.

    Args:
        user: User model instance
        start_iso: str - Start date in YYYY-MM-DD format
        end_iso: str - End date in YYYY-MM-DD format (inclusive)
        include_events: bool - If True, include full event list in response

    Returns:
        dict with report data
    """
    user_timezone = user.settings.timezone if user.settings else 'UTC'

    # Fetch events for the date range
    events = get_events_between(user, start_iso, end_iso)

    # Calculate number of days/weeks
    try:
        start_dt = datetime.strptime(start_iso, '%Y-%m-%d')
        end_dt = datetime.strptime(end_iso, '%Y-%m-%d')
        days_count = (end_dt - start_dt).days + 1  # Inclusive
        weeks_count = days_count / 7.0
        if weeks_count < 1:
            weeks_count = 1
    except ValueError:
        weeks_count = 1

    # Helper to get week start for an event (for week presence tracking)
    def get_event_week_start(event_start_ts):
        """Get Sunday 00:00:00 for the week containing this timestamp"""
        try:
            tz = pytz.timezone(user_timezone)
            dt = datetime.fromtimestamp(event_start_ts, tz=tz)
            days_since_sunday = (dt.weekday() + 1) % 7
            week_start_dt = dt - timedelta(days=days_since_sunday)
            week_start_dt = week_start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            return int(week_start_dt.timestamp())
        except:
            return event_start_ts

    # Track which weeks each category appears in
    category_week_presence = {}  # {category_id: set of week_start timestamps}
    category_totals = {}
    section_week_presence = {}
    section_totals = {}
    total_raw_hours = 0.0
    total_intensity_hours = 0.0

    for event in events:
        event_week_start = get_event_week_start(event.start_time)
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
                    'section_id': event.category.section_id,
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

    # Build hierarchical section summary
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

    # Build event list if requested
    event_list = []
    if include_events:
        for event in events:
            intensity_hours = calculate_intensity_hours(event, user.settings)
            event_dict = {
                'id': event.id,
                'title': event.title,
                'start_time': format_timestamp_iso(event.start_time, user_timezone),
                'end_time': format_timestamp_iso(event.end_time, user_timezone),
                'duration_hours': event.duration_hours,
                'intensity_hours': intensity_hours,
                'color': event.color,
                'category_name': event.category.name if event.category else 'Uncategorized',
                'category_id': event.category_id,
                'section_name': event.category.section.name if (event.category and event.category.section) else None,
                'section_id': event.category.section_id if event.category else None
            }
            event_list.append(event_dict)

    result = {
        'date_range_start': start_iso,
        'date_range_end': end_iso,
        'weeks_count': weeks_count,
        'category_summary': category_totals,
        'section_summary': section_totals,
        'section_hierarchy': hierarchical_sections,
        'totals': {
            'raw_hours_total': total_raw_hours,
            'intensity_hours_total': total_intensity_hours,
            'raw_hours_avg_per_week': total_raw_hours / weeks_count if weeks_count > 0 else 0.0,
            'intensity_hours_avg_per_week': total_intensity_hours / weeks_count if weeks_count > 0 else 0.0
        }
    }

    # Add events if requested
    if include_events:
        result['events'] = event_list

    return result
