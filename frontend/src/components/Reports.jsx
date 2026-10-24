import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import HierarchicalSectionReport from './HierarchicalSectionReport';
import WeekCalendar from './WeekCalendar';
import { formatDateLocal, parseDateLocal } from '../utils/dateHelpers';
import { summarize, chartNames, lastWeeks, h1, md, OTHER } from '../utils/ledger';
import useColors from '../utils/useColors';
import { SplitBar, CategoryBars } from './LedgerParts';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const QUICK = [4, 8, 16];

function WeekTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-panel rounded-lg shadow-lg px-3 py-2 text-xs border border-line">
      <p className="font-semibold mb-1">{label}</p>
      {[...payload].reverse().filter(e => e.value > 0).map((e, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="dot" style={{ backgroundColor: e.color }} />
          <span className="text-muted">{e.name}</span>
          <span className="num ml-auto pl-3 font-semibold">{h1(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

// One stacked bar per selected week, so single weeks stay readable inside an aggregate.
function SelectedWeeks({ weeks, colorOf, order, avg }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const sorted = [...weeks].sort();
    const ranges = sorted.map(w => {
      const e = parseDateLocal(w); e.setDate(e.getDate() + 6);
      return { start: w, end: formatDateLocal(e) };
    });
    let live = true;
    reportsAPI.ranges(ranges).then(res => {
      if (!live) return;
      setRows(res.map((r, i) => ({ week: md(parseDateLocal(sorted[i])), ...(summarize(r)?.by || {}) })));
    }).catch(() => live && setRows([]));
    return () => { live = false; };
  }, [weeks]);
  const keys = [...new Set(rows.flatMap(r => Object.keys(r).filter(k => k !== 'week' && r[k] > 0)))]
    .sort((a, b) => (a === OTHER) - (b === OTHER) || order.indexOf(a) - order.indexOf(b));
  if (!rows.length) return <div className="h-[120px]" />;
  return (
    <div className="h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="18%">
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#6b6258' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
          <Tooltip content={<WeekTip />} cursor={{ fill: '#2a242008' }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={colorOf(k)} isAnimationActive={false}
              radius={i === keys.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}>
              {rows.map((_, j) => <Cell key={j} fillOpacity={0.85} />)}
            </Bar>
          ))}
          {avg > 0 && <ReferenceLine y={avg} stroke="#2a2420" strokeWidth={1.5} strokeDasharray="4 3" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Reports() {
  // Get current week start (Sunday) as default
  const getCurrentWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() - dayOfWeek);
    return formatDateLocal(sunday);
  };

  const [selectedWeeks, setSelectedWeeks] = useState([getCurrentWeekStart()]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const colorOf = useColors();

  const handleWeekSelect = (weekStart) => {
    setSelectedWeeks(prev => {
      if (prev.includes(weekStart)) {
        // Deselect week
        return prev.filter(w => w !== weekStart);
      } else {
        // Select week
        return [...prev, weekStart];
      }
    });
  };

  const handlePrevWeek = () => {
    if (selectedWeeks.length === 1) {
      const [year, month, day] = selectedWeeks[0].split('-').map(Number);
      const currentWeek = new Date(year, month - 1, day);
      currentWeek.setDate(currentWeek.getDate() - 7);
      setSelectedWeeks([formatDateLocal(currentWeek)]);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeeks.length === 1) {
      const [year, month, day] = selectedWeeks[0].split('-').map(Number);
      const currentWeek = new Date(year, month - 1, day);
      currentWeek.setDate(currentWeek.getDate() + 7);
      setSelectedWeeks([formatDateLocal(currentWeek)]);
    }
  };

  // Auto-generate report when selection changes
  useEffect(() => {
    const generateReport = async () => {
      if (selectedWeeks.length === 0) {
        setReport(null);
        setError(null);
        return;
      }

      setError(null);

      try {
        // Sort weeks to find start and end
        const sortedWeeks = [...selectedWeeks].sort();
        const startDate = sortedWeeks[0];
        const lastWeekStart = sortedWeeks[sortedWeeks.length - 1];

        // Calculate end date (Saturday of last week)
        // Parse as local date by splitting the string
        const [year, month, day] = lastWeekStart.split('-').map(Number);
        const endDate = new Date(year, month - 1, day);
        endDate.setDate(endDate.getDate() + 6);
        const endDateStr = formatDateLocal(endDate);

        const data = await reportsAPI.range(startDate, endDateStr);
        setReport(data);
      } catch (err) {
        console.error('Report generation failed:', err);
        setError('Failed to generate report');
      }
    };

    generateReport();
  }, [selectedWeeks]);

  const multi = selectedWeeks.length > 1;
  const sum = summarize(report);
  const order = chartNames(report?.section_hierarchy);
  const parts = sum ? [...order, OTHER].map(k => ({ name: k, value: sum.by[k] || 0, color: colorOf(k) })) : [];
  const sorted = [...selectedWeeks].sort();
  const rangeLabel = sorted.length ? (() => {
    const s0 = parseDateLocal(sorted[0]);
    const e0 = parseDateLocal(sorted[sorted.length - 1]); e0.setDate(e0.getDate() + 6);
    return `${md(s0)} – ${s0.getMonth() === e0.getMonth() ? e0.getDate() : md(e0)}`;
  })() : '';
  const quickOn = QUICK.find(n => {
    const want = lastWeeks(n).map(w => w.start);
    return want.length === sorted.length && want.every((w, i) => w === sorted[i]);
  });
  const navBtn = 'w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-soft transition';

  return (
    <div className="space-y-3">
      <div className="panel p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="seg">
            {QUICK.map(n => (
              <button key={n} className={quickOn === n ? 'on' : ''}
                onClick={() => setSelectedWeeks(lastWeeks(n).map(w => w.start))}>{n}w</button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted num">{selectedWeeks.length || ''}</span>
          <button
            onClick={() => setSelectedWeeks([])}
            className={`w-7 h-7 rounded-lg text-muted hover:bg-soft ${selectedWeeks.length === 0 ? 'invisible' : ''}`}
            title="Clear"
          >
            ×
          </button>
        </div>

        <WeekCalendar
          selectedWeeks={selectedWeeks}
          onWeekSelect={handleWeekSelect}
        />

        {error && <div className="mt-3 text-sm text-warn">{error}</div>}
      </div>

      {report && sum && (
        <div className="space-y-3">
          <div className="text-center pt-1">
            <div className="flex items-center justify-center gap-1">
              {!multi && <button onClick={handlePrevWeek} className={navBtn} aria-label="Previous week">‹</button>}
              <span className="text-[13px] text-muted num">{rangeLabel}</span>
              {!multi && <button onClick={handleNextWeek} className={navBtn} aria-label="Next week">›</button>}
            </div>
            <div className="flex items-end justify-center gap-6">
              <div className="text-5xl font-bold tracking-tight num">
                {multi ? Math.round(report.totals.raw_hours_total).toLocaleString('en-US') : h1(report.totals.raw_hours_total)}
                <small className="text-sm font-medium text-muted ml-0.5">h</small>
              </div>
              {multi && (
                <div className="text-2xl font-semibold text-muted num pb-1" title="Average per week">
                  {h1(report.totals.raw_hours_avg_per_week)}<small className="text-xs font-medium ml-0.5">/wk</small>
                </div>
              )}
            </div>
            <div className="max-w-[300px] mx-auto mt-3"><SplitBar parts={parts} total={sum.total} /></div>
          </div>

          {multi && (
            <div className="panel p-3">
              <SelectedWeeks weeks={selectedWeeks} colorOf={colorOf} order={order} avg={report.totals.raw_hours_avg_per_week} />
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {report.section_hierarchy && report.section_hierarchy.length > 0 && (() => {
            const unsectionedHours = Object.values(report.category_summary || {})
              .filter(c => !c.section_id)
              .reduce((sum, c) => sum + (c.raw_hours_total || 0), 0);
            const otherEntry = unsectionedHours > 0
              ? [{ id: 'other', name: 'Other', parent_id: null, show_in_charts: false, direct_raw_hours: unsectionedHours, total_raw_hours: unsectionedHours, children: [], weeks_present: 0, raw_hours_avg: 0 }]
              : [];
            return (
              <div className="panel px-3.5 py-2.5">
                <HierarchicalSectionReport
                  sectionHierarchy={[...report.section_hierarchy, ...otherEntry]}
                  reportType={multi ? 'range' : 'weekly'}
                  colorOf={colorOf}
                />
              </div>
            );
          })()}

          {sum.cats.length > 0 && (
            <div className="panel px-3.5 py-2.5">
              <div className="flex text-[11px] text-muted pb-1">
                <span>Categories</span>
                {multi && <span className="ml-auto mr-12" title="Weeks with time · average per week">wks · avg</span>}
              </div>
              <CategoryBars summary={sum} colorOf={colorOf}
                extra={multi ? (c) => <span className="num text-xs text-muted whitespace-nowrap">{c.weeks} · {h1(c.avg)}</span> : null} />
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
