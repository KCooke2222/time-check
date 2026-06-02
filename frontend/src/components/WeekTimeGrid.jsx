import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';

const HOUR_START = 7;
const HOUR_END = 23;
const HOURS = HOUR_END - HOUR_START;
const PX_PER_HOUR = 38;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const UNCATEGORIZED_COLOR = '#D1D5DB'; // gray-300
const CAT_COLOR = '#2563EB';           // blue-600, matches dashboard chart

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

function WeekTimeGrid({ events: initialEvents, weekStart: initialWeekStart }) {
  const [offset, setOffset]   = useState(0);
  const [events, setEvents]   = useState(initialEvents || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (offset === 0) {
      setEvents(initialEvents || []);
      return;
    }
    setLoading(true);
    const sunday = getSunday(offset);
    reportsAPI.weekly(formatLocal(sunday)).then(data => {
      setEvents(data.events || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [offset, initialEvents]);

  const sunday = getSunday(offset);
  sunday.setHours(0, 0, 0, 0);

  const byDay = Array.from({ length: 7 }, () => []);
  for (const event of events) {
    const start  = new Date(event.start_time);
    const day    = start.getDay();
    const startH = start.getHours() + start.getMinutes() / 60;
    const endH   = startH + event.duration_hours;
    if (startH >= HOUR_END || endH <= HOUR_START) continue;
    byDay[day].push({ ...event, startH, endH });
  }

  const gridH = HOURS * PX_PER_HOUR;

  const weekLabel = (() => {
    const end = addDays(sunday, 6);
    const fmtFull  = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const fmtShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sameMonth = sunday.getMonth() === end.getMonth();
    return sameMonth
      ? `${fmtShort(sunday)} – ${end.getDate()}, ${sunday.getFullYear()}`
      : `${fmtShort(sunday)} – ${fmtFull(end)}`;
  })();

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setOffset(0)}
          disabled={offset === 0}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition disabled:opacity-40"
        >
          Today
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset(o => o - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-sm"
          >
            ‹
          </button>
          <button
            onClick={() => setOffset(o => Math.min(o + 1, 0))}
            disabled={offset === 0}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-sm disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
      </div>

      <div className={`flex gap-0 overflow-hidden transition-opacity ${loading ? 'opacity-40' : 'opacity-100'}`}>
        {/* Hour labels */}
        <div className="flex-shrink-0 w-10 relative" style={{ height: gridH }}>
          {Array.from({ length: HOURS }, (_, i) => {
            const hour = HOUR_START + i;
            if (i === 0 || i % 2 !== 0) return null;
            return (
              <div
                key={i}
                className="absolute right-2 text-xs text-gray-300 leading-none"
                style={{ top: i * PX_PER_HOUR - 6 }}
              >
                {(hour % 12) || 12}{hour < 12 ? 'a' : 'p'}
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        {DAYS.map((day, dayIdx) => {
          const colDate = new Date(sunday);
          colDate.setDate(sunday.getDate() + dayIdx);
          const isToday = new Date().toDateString() === colDate.toDateString();

          return (
            <div key={day} className="flex-1 min-w-0">
              <div className={`text-center text-xs font-medium pb-2 ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                <div>{day}</div>
                <div className={`text-sm font-semibold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {colDate.getDate()}
                </div>
              </div>

              <div className="relative border-l border-gray-100" style={{ height: gridH }}>
                {Array.from({ length: HOURS }, (_, i) => (
                  <div key={i} className="absolute w-full border-t border-gray-50" style={{ top: i * PX_PER_HOUR }} />
                ))}

                {byDay[dayIdx].map((event, i) => {
                  const top   = Math.max(0, (event.startH - HOUR_START) * PX_PER_HOUR);
                  const height = Math.max(18, event.duration_hours * PX_PER_HOUR - 2);
                  const categorized = event.category_id && event.category_name !== 'Uncategorized';
                  const bg    = categorized ? CAT_COLOR : UNCATEGORIZED_COLOR;

                  return (
                    <div
                      key={i}
                      className="absolute left-0.5 right-0.5 rounded px-1.5 py-1 overflow-hidden"
                      style={{ top, height, backgroundColor: bg }}
                    >
                      <p className={`text-xs font-medium leading-tight truncate ${categorized ? 'text-white' : 'text-gray-500'}`}>
                        {event.title}
                      </p>
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
