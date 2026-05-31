import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { reportsAPI } from '../services/api';
import { formatDateLocal, parseDateLocal } from '../utils/dateHelpers';

const COLORS = ['#2563EB', '#0891B2', '#0D9488', '#059669', '#4F46E5', '#7C3AED', '#0284C7', '#10B981'];

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
const STORAGE_KEY = 'weeklyTrendView';
const WEEKS_BACK = 8;

function getWeekRanges() {
  const ranges = [];
  const now = new Date();
  // Find most recent Sunday
  const dayOfWeek = now.getDay();
  const thisSunday = new Date(now);
  thisSunday.setDate(now.getDate() - dayOfWeek);

  for (let i = WEEKS_BACK - 1; i >= 0; i--) {
    const sunday = new Date(thisSunday);
    sunday.setDate(thisSunday.getDate() - i * 7);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    ranges.push({
      start: formatDateLocal(sunday),
      end: formatDateLocal(saturday),
      label: sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }
  return ranges;
}

function WeeklyTrendChart() {
  const [view, setView] = useState(() => localStorage.getItem(STORAGE_KEY) || 'section');
  const [weeklyData, setWeeklyData] = useState([]);
  const [keys, setKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const ranges = getWeekRanges();

      try {
        const results = await Promise.all(
          ranges.map(r => reportsAPI.range(r.start, r.end).catch(() => null))
        );

        const allKeys = new Set();
        const data = results.map((report, i) => {
          const row = { week: ranges[i].label };

          if (!report) return row;

          if (view === 'section') {
            (report.section_hierarchy || []).forEach(s => {
              if (s.total_raw_hours > 0) {
                row[s.name] = parseFloat(s.total_raw_hours.toFixed(2));
                allKeys.add(s.name);
              }
            });
            // Unsectioned hours as "Other"
            const other = Object.values(report.category_summary || {})
              .filter(c => !c.section_id)
              .reduce((sum, c) => sum + (c.raw_hours_total || 0), 0);
            if (other > 0) {
              row['Other'] = parseFloat(other.toFixed(2));
              allKeys.add('Other');
            }
          } else {
            Object.values(report.category_summary || {}).forEach(c => {
              if (c.raw_hours_total > 0) {
                row[c.name] = parseFloat(c.raw_hours_total.toFixed(2));
                allKeys.add(c.name);
              }
            });
          }

          return row;
        });

        setWeeklyData(data);
        setKeys([...allKeys]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [view]);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Last 8 Weeks</p>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => setView('section')}
            className={`px-3 py-1 ${view === 'section' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            By Section
          </button>
          <button
            onClick={() => setView('category')}
            className={`px-3 py-1 border-l border-gray-200 ${view === 'category' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            By Category
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="h" />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} />
            {keys.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]}
                radius={i === keys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default WeeklyTrendChart;
