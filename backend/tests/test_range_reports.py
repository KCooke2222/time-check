"""POST /reports/ranges must return exactly what one GET /reports/range per week returns."""

import json
import os
import random
import unittest
from datetime import date, datetime, timedelta

os.environ['DATABASE_URL'] = 'sqlite://'

import pytz

import app as appmod

appmod.scheduler.start = lambda *a, **k: None  # no background sync in tests

from app import create_app, db
from app.models import Calendar, Category, Event, Section, User, UserSettings
from app.services.report_generator import generate_range_report, generate_range_reports

TZ = 'America/New_York'  # has a DST change inside the test span
FIRST_SUNDAY = date(2026, 8, 2)
WEEKS = 20


def week_ranges(n=WEEKS):
    return [((FIRST_SUNDAY + timedelta(weeks=i)).isoformat(),
             (FIRST_SUNDAY + timedelta(weeks=i, days=6)).isoformat()) for i in range(n)]


def dump(x):
    return json.dumps(x, sort_keys=True)


class RangeReportsTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

        user = User(email='t@example.com')
        db.session.add(user)
        db.session.flush()
        db.session.add(UserSettings(user_id=user.id, timezone=TZ))
        cal = Calendar(user_id=user.id, calendar_id='c', name='c')
        work = Section(user_id=user.id, name='Work', show_in_charts=True)
        db.session.add_all([cal, work])
        db.session.flush()
        school = Section(user_id=user.id, name='School', parent_id=work.id, show_in_charts=True)
        db.session.add(school)
        db.session.flush()
        cats = [Category(user_id=user.id, section_id=work.id, name='Job', keywords='[]'),
                Category(user_id=user.id, section_id=school.id, name='Class', keywords='[]'),
                Category(user_id=user.id, section_id=None, name='Gym', keywords='[]')]
        db.session.add_all(cats)
        db.session.flush()

        tz = pytz.timezone(TZ)
        rnd = random.Random(42)
        starts = []
        for i in range(WEEKS + 1):  # one week past the end, which must be ignored
            sunday = tz.localize(datetime.combine(FIRST_SUNDAY + timedelta(weeks=i), datetime.min.time()))
            starts += [sunday, sunday - timedelta(seconds=1)]  # exactly on and just before the boundary
            starts += [sunday + timedelta(minutes=rnd.randrange(7 * 24 * 60)) for _ in range(rnd.randrange(0, 12))]
        for n, st in enumerate(starts):
            ts = int(st.timestamp())
            hours = rnd.choice([0.25, 0.5, 1.0, 1.5, 2.0, 3.75])
            cat = rnd.choice(cats + [None])
            db.session.add(Event(user_id=user.id, calendar_id=cal.id, event_id=str(n), title=f'e{n}',
                                 start_time=ts, end_time=ts + int(hours * 3600), duration_hours=hours,
                                 category_id=cat.id if cat else None))
        db.session.commit()
        self.user_id = user.id

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_service_matches_per_week_reports(self):
        user = db.session.get(User, self.user_id)
        ranges = week_ranges()
        old = [generate_range_report(user, s, e) for s, e in ranges]
        new = generate_range_reports(user, ranges)
        self.assertEqual(len(new), len(ranges))
        for r, a, b in zip(ranges, old, new):
            self.assertEqual(dump(a), dump(b), r)
        self.assertGreater(sum(r['totals']['raw_hours_total'] for r in old), 0)

    def test_endpoint_matches_range_endpoint(self):
        client = self.app.test_client()
        with client.session_transaction() as s:
            s['_user_id'] = str(self.user_id)
            s['_fresh'] = True
        ranges = week_ranges()
        old = [client.get('/api/reports/range', query_string={'start': s, 'end': e}).get_json() for s, e in ranges]
        res = client.post('/api/reports/ranges', json={'ranges': [{'start': s, 'end': e} for s, e in ranges]})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(dump(res.get_json()), dump(old))

    def test_bad_input(self):
        client = self.app.test_client()
        with client.session_transaction() as s:
            s['_user_id'] = str(self.user_id)
        self.assertEqual(client.post('/api/reports/ranges', json={'ranges': [{'start': 'x', 'end': 'y'}]}).status_code, 400)
        self.assertEqual(client.post('/api/reports/ranges', json={'ranges': []}).get_json(), [])


if __name__ == '__main__':
    unittest.main()
