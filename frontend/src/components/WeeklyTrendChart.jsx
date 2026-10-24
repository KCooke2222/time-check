import { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { reportsAPI, calendarAPI } from '../services/api';
import { formatDateLocal } from '../utils/dateHelpers';
import { summarize, OTHER, h1 } from '../utils/ledger';

const PRESET_KEY = 'weeklyTrendPreset';

const YEAR = new Date().getFullYear();
const PRESETS = [
  { key: '8w', label: '8w' },
  { key: '12w', label: '12w' },
  { key: '26w', label: '26w' },
  { key: '52w', label: '52w' },
  { key: 'this-year', label: String(YEAR) },
  { key: 'last-year', label: String(YEAR - 1) },
  { key: 'all', label: 'All' },
];

function getSunday(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekRanges(preset, oldestDate = null) {
  const ranges = [];
  const now = new Date();
  const thisSunday = getSunday(now);

  let start, end;

  if (preset === 'all') {
    start = oldestDate ? getSunday(new Date(oldestDate)) : thisSunday;
    end = thisSunday;
  } else if (preset === 'this-year') {
    start = getSunday(new Date(now.getFullYear(), 0, 1));
    end = thisSunday;
  } else if (preset === 'last-year') {
    const y = now.getFullYear() - 1;
    start = getSunday(new Date(y, 0, 1));
    end = getSunday(new Date(y, 11, 31));
  } else {
    const weeks = parseInt(preset);
    start = new Date(thisSunday);
    start.setDate(thisSunday.getDate() - (weeks - 1) * 7);
    end = thisSunday;
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    const sunday = new Date(cursor);
    const saturday = new Date(cursor);
    saturday.setDate(saturday.getDate() + 6);
    ranges.push({
      start: formatDateLocal(sunday),
      end: formatDateLocal(saturday),
      label: sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return ranges;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, e) => a + (e.value || 0), 0);
  return (
    <div className="bg-panel rounded-lg shadow-lg px-3 py-2 text-xs border border-line">
      <p className="font-semibold mb-1">{label} <span className="num font-normal text-muted">{h1(total)} h</span></p>
      {[...payload].reverse().filter(e => e.value > 0).map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="dot" style={{ backgroundColor: entry.color }} />
          <span className="text-muted">{entry.name}</span>
          <span className="num ml-auto pl-3 font-semibold">{h1(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function WeeklyTrendChart({ colorOf, order = [] }) {
  const [preset, setPreset] = useState(() => localStorage.getItem(PRESET_KEY) || '8w');
  const [weeklyData, setWeeklyData] = useState([]);
  const [keys, setKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { localStorage.setItem(PRESET_KEY, preset); }, [preset]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      let oldestDate = null;
      if (preset === 'all') {
        try {
          const stats = await calendarAPI.syncStats();
          oldestDate = stats.oldest_event_date;
        } catch {}
      }
      const ranges = getWeekRanges(preset, oldestDate);
      try {
        const results = await reportsAPI.ranges(ranges.map(r => ({ start: r.start, end: r.end })))
          .catch(() => ranges.map(() => null));

        const allKeys = new Set();
        const data = results.map((report, i) => {
          const row = { week: ranges[i].label };
          const sum = summarize(report);
          if (!sum) return row;
          Object.entries(sum.by).forEach(([name, value]) => {
            if (value <= 0) return;
            row[name] = parseFloat(value.toFixed(2));
            allKeys.add(name);
          });
          row.total = sum.total;
          return row;
        });

        setWeeklyData(data);
        setKeys([...allKeys]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [preset]);

  const rank = (k) => (k === OTHER ? 1e3 : order.indexOf(k) === -1 ? 500 : order.indexOf(k));
  const keysList = [...keys].sort((x, y) => rank(x) - rank(y));
  const past = weeklyData.slice(0, -1).filter(r => r.total != null);
  const avg = past.length ? past.reduce((a, r) => a + r.total, 0) / past.length : 0;
  const last = weeklyData.length - 1;

  return (
    <div className="panel p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="seg min-w-0 shrink overflow-x-auto [scrollbar-width:none]">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)} className={preset === p.key ? 'on' : ''}>
              {p.label}
            </button>
          ))}
        </div>
        {avg > 0 && <span className="ml-auto text-xs text-muted num whitespace-nowrap" title="Weekly average">avg {h1(avg)}</span>}
      </div>

      {isLoading ? (
        <div className="h-[220px] sm:h-[260px]" />
      ) : (
        <div className="h-[220px] sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 6, right: 4, left: -24, bottom: 0 }} barCategoryGap="18%">
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--ink) / 0.04)' }} />
              {keysList.map((key, i) => (
                <Bar key={key} dataKey={key} stackId="a" fill={colorOf(key)} isAnimationActive={false}
                  radius={i === keysList.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}>
                  {weeklyData.map((_, j) => <Cell key={j} fillOpacity={j === last ? 1 : 0.42} />)}
                </Bar>
              ))}
              {avg > 0 && <ReferenceLine y={avg} stroke="rgb(var(--ink))" strokeWidth={1.5} strokeDasharray="4 3" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default WeeklyTrendChart;
