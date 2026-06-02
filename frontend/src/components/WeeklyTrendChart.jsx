import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { reportsAPI, calendarAPI } from '../services/api';
import { formatDateLocal } from '../utils/dateHelpers';

const COLORS = ['#2563EB', '#0891B2', '#0D9488', '#059669', '#4F46E5', '#7C3AED', '#0284C7', '#10B981'];
const PRESET_KEY = 'weeklyTrendPreset';

const PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'this-year', label: 'This Year' },
  { key: 'last-year', label: 'Last Year' },
  { key: '52w', label: '52W' },
  { key: '26w', label: '26W' },
  { key: '12w', label: '12W' },
  { key: '8w', label: '8W' },
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

function flattenSections(sections) {
  const result = [];
  for (const s of sections) {
    if (s.direct_raw_hours > 0) result.push({ name: s.name, value: s.direct_raw_hours });
    if (s.children?.length) result.push(...flattenSections(s.children));
  }
  return result;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg px-3 py-2 text-sm ring-1 ring-black/5">
      {label && <p className="font-medium text-gray-700 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">{entry.value}h</span>
        </div>
      ))}
    </div>
  );
}


function WeeklyTrendChart() {
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
        const results = await Promise.all(
          ranges.map(r => reportsAPI.range(r.start, r.end).catch(() => null))
        );

        const allKeys = new Set();
        const data = results.map((report, i) => {
          const row = { week: ranges[i].label };
          if (!report) return row;

          flattenSections(report.section_hierarchy || []).forEach(({ name, value }) => {
            row[name] = parseFloat(value.toFixed(2));
            allKeys.add(name);
          });
          const other = Object.values(report.category_summary || {})
            .filter(c => !c.section_id)
            .reduce((sum, c) => sum + (c.raw_hours_total || 0), 0);
          if (other > 0) { row['Other'] = parseFloat(other.toFixed(2)); allKeys.add('Other'); }
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

  const keysList = [...keys];

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {PRESETS.map((p, i) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-2.5 py-1 ${i > 0 ? 'border-l border-gray-200' : ''} ${preset === p.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12 }} unit="h" />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} />
            {keysList.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]}
                radius={i === keysList.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default WeeklyTrendChart;
