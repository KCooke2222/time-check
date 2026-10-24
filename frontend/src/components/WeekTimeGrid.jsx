import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { sectionKeys, OTHER, NONE_COLOR, h1 } from '../utils/ledger';

const HOUR_START = 7;
const HOUR_END = 23;
const HOURS = HOUR_END - HOUR_START;
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NARROW = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches;
const PX_PER_HOUR = NARROW ? 22 : 34;

function getSunday(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return d;
}

function formatLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// The week's calendar events, coloured by charted section. Mostly a check that sync works.
function WeekTimeGrid({ events: initialEvents, hierarchy: initialHierarchy, colorOf }) {
  const [offset, setOffset]   = useState(0);
  const [data, setData]       = useState({ events: initialEvents || [], hierarchy: initialHierarchy });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (offset === 0) {
      setData({ events: initialEvents || [], hierarchy: initialHierarchy });
      return;
    }
    setLoading(true);
    const sunday = getSunday(offset);
    reportsAPI.weekly(formatLocal(sunday)).then(d => {
      setData({ events: d.events || [], hierarchy: d.section_hierarchy });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [offset, initialEvents, initialHierarchy]);

  const keys = sectionKeys(data.hierarchy);
  const sunday = getSunday(offset);

  const byDay = Array.from({ length: 7 }, () => []);
  for (const event of data.events) {
    const start  = new Date(event.start_time);
    const day    = start.getDay();
    const startH = start.getHours() + start.getMinutes() / 60;
    const endH   = startH + event.duration_hours;
    if (startH >= HOUR_END || endH <= HOUR_START) continue;
    byDay[day].push({ ...event, startH, endH });
  }

  const gridH = HOURS * PX_PER_HOUR;
  const end = addDays(sunday, 6);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekLabel = sunday.getMonth() === end.getMonth() ? `${fmt(sunday)} – ${end.getDate()}` : `${fmt(sunday)} – ${fmt(end)}`;
  const navBtn = 'w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-soft transition disabled:opacity-30';

  return (
    <div className="panel p-3 sm:p-4">
      <div className="flex items-center gap-1 mb-2">
        <button onClick={() => setOffset(o => o - 1)} className={navBtn} aria-label="Previous week">‹</button>
        <button onClick={() => setOffset(o => Math.min(o + 1, 0))} disabled={offset === 0} className={navBtn} aria-label="Next week">›</button>
        <button onClick={() => setOffset(0)} disabled={offset === 0}
          className="text-sm font-medium px-1 disabled:cursor-default" title={offset ? 'Back to this week' : ''}>
          {weekLabel}
        </button>
      </div>

      <div className={`flex overflow-hidden transition-opacity ${loading ? 'opacity-40' : 'opacity-100'}`}>
        <div className="flex-shrink-0 w-6 sm:w-8 relative" style={{ height: gridH + 30 }}>
          {Array.from({ length: HOURS + 1 }, (_, i) => {
            const hour = HOUR_START + i;
            if (i % 3 !== 2) return null;
            return (
              <div key={i} className="absolute right-1.5 text-[10px] text-muted leading-none num" style={{ top: 30 + i * PX_PER_HOUR - 5 }}>
                {(hour % 12) || 12}
              </div>
            );
          })}
        </div>

        {DAYS.map((day, dayIdx) => {
          const colDate = addDays(sunday, dayIdx);
          const isToday = new Date().toDateString() === colDate.toDateString();
          return (
            <div key={dayIdx} className="flex-1 min-w-0">
              <div className={`h-[30px] text-center text-[10px] leading-tight ${isToday ? 'text-ink font-bold' : 'text-muted'}`}>
                <div>{day}</div>
                <div className="num text-xs">{colDate.getDate()}</div>
              </div>
              <div className={`relative border-l border-line ${isToday ? 'bg-ink/[0.03]' : ''}`} style={{ height: gridH }}>
                {Array.from({ length: HOURS }, (_, i) => i % 3 === 2 && (
                  <div key={i} className="absolute w-full border-t border-line/70" style={{ top: i * PX_PER_HOUR }} />
                ))}
                {byDay[dayIdx].map((event, i) => {
                  const top = Math.max(0, (event.startH - HOUR_START) * PX_PER_HOUR);
                  const height = (Math.min(event.endH, HOUR_END) - Math.max(event.startH, HOUR_START)) * PX_PER_HOUR - 1;
                  const categorized = event.category_id && event.category_name !== 'Uncategorized';
                  const key = categorized ? (event.section_id != null && keys[event.section_id]) || OTHER : null;
                  const bg = key ? colorOf(key) : NONE_COLOR;
                  return (
                    <div key={i}
                      className="absolute left-px right-px sm:left-0.5 sm:right-0.5 rounded-[3px] px-1 py-0.5 overflow-hidden"
                      style={{ top, height: Math.max(height, 3), backgroundColor: bg, opacity: key ? 0.9 : 0.55 }}
                      title={`${event.title} · ${h1(event.duration_hours)} h · ${event.category_name}`}>
                      {height >= 16 && (
                        <p className="hidden sm:block text-[10px] font-medium leading-tight truncate text-white">{event.title}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeekTimeGrid;
