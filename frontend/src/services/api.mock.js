/**
 * Mock API for demo mode. Same interface as api.js but returns static generated data.
 * Single source of truth: events are generated first, all hour totals derived from them.
 */

// ── Demo user ──────────────────────────────────────────────────────────────
const DEMO_USER = { id: 1, email: 'demo@timecheck.app' };

// ── Sections & Categories ──────────────────────────────────────────────────
const SECTIONS = {
  1: { id: 1, name: 'working',  parent_id: null, show_in_charts: false },
  2: { id: 2, name: 'school',   parent_id: 1,    show_in_charts: true  },
  3: { id: 3, name: 'work',     parent_id: 1,    show_in_charts: true  },
  4: { id: 4, name: 'Personal', parent_id: null, show_in_charts: true  },
};

const CATEGORIES = [
  { id: 1,  name: 'Algorithms',   section_id: 2, section_name: 'school',   },
  { id: 2,  name: 'Databases',    section_id: 2, section_name: 'school',   },
  { id: 3,  name: 'Systems',      section_id: 2, section_name: 'school',   },
  { id: 4,  name: 'Web Dev',      section_id: 2, section_name: 'school',   },
  { id: 5,  name: 'Odin Project', section_id: 3, section_name: 'work',     },
  { id: 6,  name: 'Job',          section_id: 3, section_name: 'work',     },
  { id: 7,  name: 'DSA Practice', section_id: 3, section_name: 'work',     },
  { id: 8,  name: 'Gym',          section_id: 4, section_name: 'Personal', },
  { id: 9,  name: 'Reading',      section_id: 4, section_name: 'Personal', },
  { id: 10, name: 'Piano',        section_id: 4, section_name: 'Personal', },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const EVENT_TITLES = {
  1:  ['algorithms', 'algo - graphs', 'algo - dynamic programming', 'algo - sorting', 'algo homework'],
  2:  ['db', 'db - schema design', 'db - SQL practice', 'db project', 'database lecture'],
  3:  ['systems', 'systems - memory', 'systems - concurrency', 'systems homework', 'os concepts'],
  4:  ['web', 'web - react', 'web - CSS', 'web - JavaScript', 'web project'],
  5:  ['odin', 'odin - JavaScript', 'odin - React', 'odin - Node.js', 'odin - foundations'],
  6:  ['job', 'job - standup', 'job - feature work', 'job - code review', 'job - meetings'],
  7:  ['dsa', 'dsa - arrays', 'dsa - trees', 'dsa - dynamic programming', 'leetcode'],
  8:  ['gym', 'gym - cardio', 'gym - strength', 'workout', 'gym - morning'],
  9:  ['read', 'reading', 'book'],
  10: ['piano', 'piano - scales', 'piano - practice'],
};

// ── Weekly schedule template ───────────────────────────────────────────────
// day: 0=Sun, hour: 24h, dur: hours, min: minute offset, fixed: no variation
const SCHEDULE = [
  // DSA 7-8am: Mon, Wed, Fri (morning)
  { catId: 7,  day: 1, hour: 7,  min: 0,  dur: 1,   school: false },
  { catId: 7,  day: 3, hour: 7,  min: 0,  dur: 1,   school: false },
  { catId: 7,  day: 5, hour: 7,  min: 0,  dur: 1,   school: false },

  // Classes 9:30am (fixed, no variation)
  { catId: 1,  day: 1, hour: 9,  min: 30, dur: 1.5, school: true,  fixed: true }, // Algo Mon
  { catId: 1,  day: 3, hour: 9,  min: 30, dur: 1.5, school: true,  fixed: true }, // Algo Wed
  { catId: 1,  day: 5, hour: 9,  min: 30, dur: 1.5, school: true,  fixed: true }, // Algo Fri
  { catId: 2,  day: 2, hour: 9,  min: 30, dur: 1.5, school: true,  fixed: true }, // DB Tue
  { catId: 2,  day: 4, hour: 9,  min: 30, dur: 1.5, school: true,  fixed: true }, // DB Thu
  { catId: 3,  day: 1, hour: 11, min: 0,  dur: 1.5, school: true,  fixed: true }, // Systems Mon
  { catId: 3,  day: 3, hour: 11, min: 0,  dur: 1.5, school: true,  fixed: true }, // Systems Wed
  { catId: 4,  day: 2, hour: 11, min: 0,  dur: 1.5, school: true,  fixed: true }, // Web Dev Tue
  { catId: 4,  day: 4, hour: 11, min: 0,  dur: 1.5, school: true,  fixed: true }, // Web Dev Thu

  // Study sessions (semester)
  { catId: 1,  day: 1, hour: 13, min: 0,  dur: 2,   school: true  }, // Algo study Mon
  { catId: 1,  day: 3, hour: 13, min: 0,  dur: 2,   school: true  }, // Algo study Wed
  { catId: 2,  day: 2, hour: 13, min: 0,  dur: 1.5, school: true  }, // DB study Tue
  { catId: 2,  day: 4, hour: 13, min: 0,  dur: 1.5, school: true  }, // DB study Thu
  { catId: 3,  day: 5, hour: 11, min: 0,  dur: 2,   school: true  }, // Systems study Fri
  { catId: 4,  day: 5, hour: 13, min: 0,  dur: 2,   school: true  }, // Web Dev study Fri
  { catId: 1,  day: 6, hour: 10, min: 0,  dur: 2,   school: true  }, // Algo study Sat
  { catId: 2,  day: 0, hour: 10, min: 0,  dur: 2,   school: true  }, // DB study Sun

  // Odin (semester) Mon/Wed afternoon + weekend
  { catId: 5,  day: 1, hour: 15, min: 0,  dur: 2,   school: false, semesterOnly: true },
  { catId: 5,  day: 3, hour: 15, min: 0,  dur: 2,   school: false, semesterOnly: true },
  { catId: 5,  day: 6, hour: 12, min: 30, dur: 3,   school: false, semesterOnly: true },
  { catId: 5,  day: 0, hour: 13, min: 0,  dur: 3,   school: false, semesterOnly: true },

  // Job search (semester) Tue/Fri afternoon
  { catId: 6,  day: 2, hour: 15, min: 0,  dur: 1,   school: false, semesterOnly: true },
  { catId: 6,  day: 5, hour: 15, min: 30, dur: 1.5, school: false, semesterOnly: true },

  // Job 9am-5pm Mon-Fri (summer)
  { catId: 6,  day: 1, hour: 9,  min: 0,  dur: 8,   school: false, summerOnly: true },
  { catId: 6,  day: 2, hour: 9,  min: 0,  dur: 8,   school: false, summerOnly: true },
  { catId: 6,  day: 3, hour: 9,  min: 0,  dur: 8,   school: false, summerOnly: true },
  { catId: 6,  day: 4, hour: 9,  min: 0,  dur: 8,   school: false, summerOnly: true },
  { catId: 6,  day: 5, hour: 9,  min: 0,  dur: 8,   school: false, summerOnly: true },

  // Odin weekend only (summer)
  { catId: 5,  day: 0, hour: 10, min: 0,  dur: 3,   school: false, summerOnly: true },
  { catId: 5,  day: 6, hour: 10, min: 0,  dur: 3,   school: false, summerOnly: true },

  // Gym 5-6pm: Mon, Wed, Sat
  { catId: 8,  day: 1, hour: 17, min: 0,  dur: 1,   school: false },
  { catId: 8,  day: 3, hour: 17, min: 0,  dur: 1,   school: false },
  { catId: 8,  day: 6, hour: 17, min: 0,  dur: 1,   school: false },

  // Reading 8-9pm: Tue, Thu
  { catId: 9,  day: 2, hour: 20, min: 0,  dur: 1,   school: false },
  { catId: 9,  day: 4, hour: 20, min: 0,  dur: 1,   school: false },

  // Piano 9-10pm: Tue, Thu (after reading)
  { catId: 10, day: 2, hour: 21, min: 0,  dur: 1,   school: false },
  { catId: 10, day: 4, hour: 21, min: 0,  dur: 1,   school: false },
];

// ── Seeded random ─────────────────────────────────────────────────────────
function seededRand(seed, offset = 0) {
  const x = Math.sin(seed * 9301 + offset * 49297 + 233) * 100000;
  return x - Math.floor(x);
}
function dateSeed(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

// ── UTD Academic Calendar ──────────────────────────────────────────────────
function getSemesterInfo(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const mmdd = m * 100 + d;
  const isFall   = mmdd >= 819 && mmdd <= 1214;
  const isSpring = mmdd >= 113 && mmdd <= 509;
  const inSemester    = isFall || isSpring;
  const isThanksgiving = mmdd >= 1124 && mmdd <= 1130;
  const isSpringBreak  = mmdd >= 310  && mmdd <= 316;
  const isFinals = (mmdd >= 428 && mmdd <= 509) || (mmdd >= 1207 && mmdd <= 1214);
  return { inSemester, isThanksgiving, isSpringBreak, isFinals };
}

// ── Date helpers ───────────────────────────────────────────────────────────
function getSunday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function formatLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function parseLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Generate events for one week (the single source of truth) ─────────────
let eventIdCounter = 1;

function generateWeekEvents(sundayStr) {
  const sunday = parseLocal(sundayStr);
  const seed   = dateSeed(sunday);
  const si     = getSemesterInfo(sunday);
  const events = [];
  const occupied = Array.from({ length: 7 }, () => []);

  const isSummer = !si.inSemester;

  for (const slot of SCHEDULE) {
    if (slot.school && !si.inSemester) continue;
    if (slot.semesterOnly && isSummer) continue;
    if (slot.summerOnly && !isSummer) continue;

    let scale = 1;
    if (!slot.fixed) {
      if (si.isFinals)                                scale = slot.school ? 1.5 : 0.5;
      else if (si.isThanksgiving || si.isSpringBreak) scale = 0.5;
      else if (si.inSemester) {
        const light = seededRand(seed, slot.catId * 97) < 0.15;
        scale = light ? 0.8 : 1;
      }
    }

    const slotMin  = slot.min || 0;
    const minVar   = slot.fixed ? 0 : Math.round((seededRand(seed, slot.catId * 17) - 0.5) * 2) * 15;
    const durVar   = slot.fixed ? 0 : Math.round((seededRand(seed, slot.catId * 11) - 0.5) * 2) * 0.25;
    const duration = Math.max(0.25, parseFloat(((slot.dur + durVar) * scale).toFixed(2)));
    const startH   = slot.hour + (slotMin + Math.max(0, minVar)) / 60;
    const endH     = startH + duration;

    if (occupied[slot.day].some(([s, e]) => startH < e && endH > s)) continue;
    occupied[slot.day].push([startH, endH]);

    const eventDate = addDays(sunday, slot.day);
    const startDate = new Date(eventDate);
    startDate.setHours(slot.hour, slotMin + Math.max(0, minVar), 0, 0);
    const endDate = new Date(startDate.getTime() + duration * 3600000);

    const cat      = CAT_MAP[slot.catId];
    const titles   = EVENT_TITLES[slot.catId];
    const titleIdx = Math.floor(seededRand(seed, slot.catId * 13) * titles.length);

    events.push({
      id: eventIdCounter++,
      title: titles[titleIdx],
      start_time: startDate.toISOString(),
      end_time:   endDate.toISOString(),
      duration_hours: duration,
      color: 'green',
      category_name: cat.name,
      category_id:   cat.id,
      section_name:  cat.section_name,
      section_id:    cat.section_id,
    });

  }

  return events;
}

// ── Week cache ─────────────────────────────────────────────────────────────
const weekEventCache = new Map();

function getWeekEvents(sundayStr) {
  if (!weekEventCache.has(sundayStr)) {
    weekEventCache.set(sundayStr, generateWeekEvents(sundayStr));
  }
  return weekEventCache.get(sundayStr);
}

// Derive per-category hours from events
function getWeekHours(sundayStr) {
  const hours = {};
  for (const e of getWeekEvents(sundayStr)) {
    hours[e.category_id] = (hours[e.category_id] || 0) + e.duration_hours;
  }
  return hours;
}

// ── Build report for a date range ─────────────────────────────────────────
function buildReport(startStr, endStr, includeEvents = false) {
  const start = parseLocal(startStr);
  const end   = parseLocal(endStr);

  const weeks = [];
  const cursor = getSunday(start);
  while (cursor <= end) {
    weeks.push(formatLocal(new Date(cursor)));
    cursor.setDate(cursor.getDate() + 7);
  }
  const weeksCount = Math.max(weeks.length, 1);

  // Aggregate from events
  const catTotals = {};
  for (const w of weeks) {
    for (const e of getWeekEvents(w)) {
      catTotals[e.category_id] = (catTotals[e.category_id] || 0) + e.duration_hours;
    }
  }

  const categorySummary = {};
  for (const cat of CATEGORIES) {
    const total = parseFloat((catTotals[cat.id] || 0).toFixed(2));
    if (total === 0) continue;
    categorySummary[cat.id] = {
      name: cat.name,
      section_name: cat.section_name,
      section_id:   cat.section_id,
      raw_hours_total: total,
      weeks_present:   weeks.length,
      raw_hours_avg:   parseFloat((total / weeksCount).toFixed(2)),
    };
  }

  const secTotals = {};
  for (const cat of CATEGORIES) {
    secTotals[cat.section_id] = (secTotals[cat.section_id] || 0) + (catTotals[cat.id] || 0);
  }

  const sectionSummary = {};
  for (const [secId, total] of Object.entries(secTotals)) {
    const sec = SECTIONS[secId];
    if (!sec) continue;
    sectionSummary[secId] = {
      name: sec.name,
      raw_hours_total: parseFloat(total.toFixed(2)),
      weeks_present:   weeks.length,
      raw_hours_avg:   parseFloat((total / weeksCount).toFixed(2)),
    };
  }

  const schoolTotal   = secTotals[2] || 0;
  const workTotal     = secTotals[3] || 0;
  const personalTotal = secTotals[4] || 0;

  const sectionHierarchy = [
    {
      id: 1, name: 'working', parent_id: null, show_in_charts: false,
      direct_raw_hours: 0,
      total_raw_hours:  parseFloat((schoolTotal + workTotal).toFixed(2)),
      weeks_present: weeks.length,
      raw_hours_avg: parseFloat(((schoolTotal + workTotal) / weeksCount).toFixed(2)),
      children: [
        {
          id: 2, name: 'school', parent_id: 1, show_in_charts: true,
          direct_raw_hours: parseFloat(schoolTotal.toFixed(2)),
          total_raw_hours:  parseFloat(schoolTotal.toFixed(2)),
          weeks_present: weeks.length,
          raw_hours_avg: parseFloat((schoolTotal / weeksCount).toFixed(2)),
          children: [],
        },
        {
          id: 3, name: 'work', parent_id: 1, show_in_charts: true,
          direct_raw_hours: parseFloat(workTotal.toFixed(2)),
          total_raw_hours:  parseFloat(workTotal.toFixed(2)),
          weeks_present: weeks.length,
          raw_hours_avg: parseFloat((workTotal / weeksCount).toFixed(2)),
          children: [],
        },
      ],
    },
    {
      id: 4, name: 'Personal', parent_id: null, show_in_charts: true,
      direct_raw_hours: parseFloat(personalTotal.toFixed(2)),
      total_raw_hours:  parseFloat(personalTotal.toFixed(2)),
      weeks_present: weeks.length,
      raw_hours_avg: parseFloat((personalTotal / weeksCount).toFixed(2)),
      children: [],
    },
  ];

  const totalHours = parseFloat(Object.values(catTotals).reduce((a, b) => a + b, 0).toFixed(2));

  // For calendar: return events from the most recent week in range
  const events = includeEvents
    ? getWeekEvents(weeks[weeks.length - 1]).sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    : [];

  return {
    date_range_start: startStr,
    date_range_end:   endStr,
    week_start:       startStr,
    week_end:         endStr,
    weeks_count:      weeksCount,
    category_summary: categorySummary,
    section_summary:  sectionSummary,
    section_hierarchy: sectionHierarchy,
    totals: {
      raw_hours_total:       totalHours,
      raw_hours_avg_per_week: parseFloat((totalHours / weeksCount).toFixed(2)),
    },
    events,
  };
}

// ── Mock API exports ───────────────────────────────────────────────────────

export const authAPI = {
  getStatus: async () => ({
    authenticated: localStorage.getItem('demo_authed') === 'true',
    user: DEMO_USER,
  }),
  login:  async () => ({ authorization_url: '/?demo=true' }),
  logout: async () => { localStorage.removeItem('demo_authed'); },
};

export const reportsAPI = {
  currentWeek: async () => {
    const now    = new Date();
    const sunday = getSunday(now);
    const sat    = addDays(sunday, 6);
    return buildReport(formatLocal(sunday), formatLocal(sat), true);
  },
  range:  async (start, end) => buildReport(start, end, false),
  weekly: async (date) => {
    const d      = date ? parseLocal(date) : new Date();
    const sunday = getSunday(d);
    const sat    = addDays(sunday, 6);
    return buildReport(formatLocal(sunday), formatLocal(sat), true);
  },
};

export const calendarAPI = {
  list:      async () => ({ calendars: [{ id: 1, calendar_id: 'demo@timecheck.app', name: 'Demo Calendar', is_active: true }] }),
  discover:  async () => ({ calendars: [{ calendar_id: 'demo@timecheck.app', name: 'Demo Calendar', is_added: true }] }),
  add:       async () => ({}),
  toggle:    async () => ({}),
  delete:    async () => ({}),
  sync:      async () => ({ message: 'Sync not available in demo', stats: { events_added: 0, events_updated: 0, events_deleted: 0, sync_time: new Date().toISOString() } }),
  syncStats: async () => ({
    total_events: 1240,
    oldest_event_date: addDays(new Date(), -365).toISOString(),
    latest_sync_time:  new Date().toISOString(),
  }),
};

const mockSections = Object.values(SECTIONS).map(s => ({
  ...s,
  category_count: CATEGORIES.filter(c => c.section_id === s.id).length,
  children: [],
}));

export const categoriesAPI = {
  listSections:        async () => ({ sections: mockSections }),
  createSection:       async () => ({}),
  updateSection:       async () => ({}),
  deleteSection:       async () => ({}),
  toggleSectionCharts: async () => ({}),
  listCategories:      async () => ({ categories: CATEGORIES.map(c => ({ ...c, display_order: 0 })) }),
  createCategory:      async () => ({}),
  updateCategory:      async () => ({}),
  deleteCategory:      async () => ({}),
};

export const settingsAPI = {
  get:    async () => ({ min_event_duration_hours: 0, max_event_duration_hours: 16, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  update: async () => ({}),
};
