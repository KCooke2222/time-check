from datetime import datetime, timedelta
import pytz
from app.models import Section
from app.services.event_queries import get_events_between
from app.utils.helpers import format_timestamp_iso


def build_hierarchical_section_summary(section_totals, user):
    all_sections = Section.query.filter_by(user_id=user.id).all()
    section_map = {s.id: s for s in all_sections}

    result = {}
    for sec_id, data in section_totals.items():
        if sec_id:
            s = section_map.get(sec_id)
            result[sec_id] = {
                'id': sec_id,
                'name': data['name'],
                'parent_id': s.parent_id if s else None,
                'show_in_charts': s.show_in_charts if s else False,
                'direct_raw_hours': data['raw_hours'],
                'total_raw_hours': data['raw_hours'],
                'children': []
            }

    for section in all_sections:
        if section.id not in result:
            result[section.id] = {
                'id': section.id,
                'name': section.name,
                'parent_id': section.parent_id,
                'show_in_charts': section.show_in_charts,
                'direct_raw_hours': 0.0,
                'total_raw_hours': 0.0,
                'children': []
            }

    def aggregate_children(section_id):
        if section_id not in result:
            return 0.0

        section_data = result[section_id]
        total_raw = section_data['direct_raw_hours']

        for other_id, other_data in result.items():
            if other_data['parent_id'] == section_id:
                child_raw = aggregate_children(other_id)
                total_raw += child_raw

        section_data['total_raw_hours'] = total_raw
        return total_raw

    root_sections = [sid for sid, data in result.items() if data['parent_id'] is None]
    for root_id in root_sections:
        aggregate_children(root_id)

    def embed_children(section_data):
        child_ids = [sid for sid, data in result.items() if data['parent_id'] == section_data['id']]
        section_data['children'] = [embed_children(result[cid]) for cid in child_ids]
        return section_data

    return [embed_children(data) for data in result.values() if data['parent_id'] is None]


def generate_range_report(user, start_iso, end_iso, include_events=False):
    user_timezone = user.settings.timezone if user.settings else 'UTC'

    events = get_events_between(user, start_iso, end_iso)

    try:
        start_dt = datetime.strptime(start_iso, '%Y-%m-%d')
        end_dt = datetime.strptime(end_iso, '%Y-%m-%d')
        days_count = (end_dt - start_dt).days + 1
        weeks_count = max(days_count / 7.0, 1)
    except ValueError:
        weeks_count = 1

    def get_event_week_start(event_start_ts):
        try:
            tz = pytz.timezone(user_timezone)
            dt = datetime.fromtimestamp(event_start_ts, tz=tz)
            days_since_sunday = (dt.weekday() + 1) % 7
            week_start_dt = dt - timedelta(days=days_since_sunday)
            week_start_dt = week_start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            return int(week_start_dt.timestamp())
        except:
            return event_start_ts

    category_week_presence = {}
    category_totals = {}
    section_week_presence = {}
    section_totals = {}
    total_raw_hours = 0.0

    for event in events:
        if not event.category:
            continue

        event_week_start = get_event_week_start(event.start_time)
        total_raw_hours += event.duration_hours
        cat_id = event.category.id

        if cat_id not in category_week_presence:
            category_week_presence[cat_id] = set()
        category_week_presence[cat_id].add(event_week_start)

        if cat_id not in category_totals:
            category_totals[cat_id] = {
                'name': event.category.name,
                'section_name': event.category.section.name if event.category.section else None,
                'section_id': event.category.section_id,
                'raw_hours_total': 0.0,
            }
        category_totals[cat_id]['raw_hours_total'] += event.duration_hours

        sec_id = event.category.section_id
        if sec_id:
            if sec_id not in section_week_presence:
                section_week_presence[sec_id] = set()
            section_week_presence[sec_id].add(event_week_start)

            if sec_id not in section_totals:
                section_totals[sec_id] = {
                    'name': event.category.section.name if event.category.section else None,
                    'raw_hours_total': 0.0,
                }
            section_totals[sec_id]['raw_hours_total'] += event.duration_hours

    for cat_id, data in category_totals.items():
        weeks_present = len(category_week_presence[cat_id])
        data['weeks_present'] = weeks_present
        data['raw_hours_avg'] = data['raw_hours_total'] / weeks_present if weeks_present > 0 else 0.0

    for sec_id, data in section_totals.items():
        weeks_present = len(section_week_presence[sec_id])
        data['weeks_present'] = weeks_present
        data['raw_hours_avg'] = data['raw_hours_total'] / weeks_present if weeks_present > 0 else 0.0

    section_totals_for_hierarchy = {
        sec_id: {'name': data['name'], 'raw_hours': data['raw_hours_total']}
        for sec_id, data in section_totals.items() if sec_id
    }

    hierarchical_sections = build_hierarchical_section_summary(section_totals_for_hierarchy, user)

    def add_week_stats_recursive(section):
        if section.get('children'):
            for child in section['children']:
                add_week_stats_recursive(child)
                # merge child week sets into parent
                child_id = child['id']
                sec_id = section['id']
                if child_id in section_week_presence:
                    if sec_id not in section_week_presence:
                        section_week_presence[sec_id] = set()
                    section_week_presence[sec_id] |= section_week_presence[child_id]

        sec_id = section['id']
        if sec_id in section_week_presence:
            weeks = len(section_week_presence[sec_id])
            section['weeks_present'] = weeks
            section['raw_hours_avg'] = section['total_raw_hours'] / weeks if weeks > 0 else 0.0
        else:
            section['weeks_present'] = 0
            section['raw_hours_avg'] = 0.0

    for section in hierarchical_sections:
        add_week_stats_recursive(section)

    event_list = []
    if include_events:
        for event in events:
            event_list.append({
                'id': event.id,
                'title': event.title,
                'start_time': format_timestamp_iso(event.start_time, user_timezone),
                'end_time': format_timestamp_iso(event.end_time, user_timezone),
                'duration_hours': event.duration_hours,
                'color': event.color,
                'category_name': event.category.name if event.category else 'Uncategorized',
                'category_id': event.category_id,
                'section_name': event.category.section.name if (event.category and event.category.section) else None,
                'section_id': event.category.section_id if event.category else None
            })

    result = {
        'date_range_start': start_iso,
        'date_range_end': end_iso,
        'weeks_count': weeks_count,
        'category_summary': category_totals,
        'section_summary': section_totals,
        'section_hierarchy': hierarchical_sections,
        'totals': {
            'raw_hours_total': total_raw_hours,
            'raw_hours_avg_per_week': total_raw_hours / weeks_count if weeks_count > 0 else 0.0,
        }
    }

    if include_events:
        result['events'] = event_list

    return result
