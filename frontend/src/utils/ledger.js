import { formatDateLocal } from './dateHelpers';

// Charted sections get a colour each, in the order they first appear; "Other"
// is the categories with no section, as main computes it.
const PALETTE = ['#3c6a8c', '#2f6b4f', '#8b5e83', '#4f7a7a', '#a0574a', '#5a6b3c', '#6b5a9c'];
export const OTHER = 'Other';
export const OTHER_COLOR = '#c39a45';
export const NONE_COLOR = '#b9afa2';

export function makeColors(names) {
  const map = {};
  names.filter(n => n !== OTHER).forEach((n, i) => { map[n] = PALETTE[i % PALETTE.length]; });
  map[OTHER] = OTHER_COLOR;
  return (name) => map[name] || OTHER_COLOR;
}

// section id -> charted section name (sub-sections inherit their charted ancestor)
export function sectionKeys(hierarchy) {
  const keys = {};
  const walk = (list, inherited) => {
    for (const s of list || []) {
      const key = inherited || (s.show_in_charts ? s.name : null);
      if (key) keys[s.id] = key;
      walk(s.children, key);
    }
  };
  walk(hierarchy, null);
  return keys;
}

export function chartNames(hierarchy) {
  const names = [];
  const walk = (list) => {
    for (const s of list || []) {
      if (s.show_in_charts) names.push(s.name);
      else walk(s.children);
    }
  };
  walk(hierarchy);
  return names;
}

// One report -> { total, by: {key: hours}, cats: [...] }
export function summarize(report) {
  if (!report) return null;
  const keys = sectionKeys(report.section_hierarchy);
  const total = report.totals?.raw_hours_total || 0;
  const by = {};
  const walk = (list) => {
    for (const s of list || []) {
      if (s.show_in_charts) by[s.name] = (by[s.name] || 0) + (s.total_raw_hours || 0);
      else walk(s.children);
    }
  };
  walk(report.section_hierarchy);
  by[OTHER] = Object.values(report.category_summary || {})
    .filter(c => !c.section_id)
    .reduce((sum, c) => sum + (c.raw_hours_total || 0), 0);

  const cats = Object.entries(report.category_summary || {})
    .map(([id, c]) => ({
      id,
      name: c.name,
      section: c.section_name || null,
      key: c.section_id ? keys[c.section_id] || null : OTHER,
      hours: c.raw_hours_total || 0,
      weeks: c.weeks_present || 0,
      avg: c.raw_hours_avg || 0,
    }))
    .filter(c => c.hours > 0)
    .sort((a, b) => b.hours - a.hours);
  return { total, by, cats };
}

export const h1 = (v) => (Math.round((v || 0) * 10) / 10).toFixed(1).replace(/\.0$/, '');

export function getSunday(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

// The last n Sunday-Saturday weeks ending with the current week.
export function lastWeeks(n) {
  const sun = getSunday(new Date());
  return Array.from({ length: n }, (_, i) => {
    const s = new Date(sun);
    s.setDate(sun.getDate() - (n - 1 - i) * 7);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return { start: formatDateLocal(s), end: formatDateLocal(e) };
  });
}

export const md = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
