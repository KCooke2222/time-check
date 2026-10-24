import { useState, useEffect, useMemo } from 'react';
import { reportsAPI, calendarAPI } from '../services/api';
import { parseDateLocal } from '../utils/dateHelpers';
import { summarize, chartNames, lastWeeks, getSunday, h1, md, OTHER } from '../utils/ledger';
import useColors from '../utils/useColors';
import WeeklyTrendChart from './WeeklyTrendChart';
import WeekTimeGrid from './WeekTimeGrid';
import { Ledger, SplitBar, CategoryBars, Loading } from './LedgerParts';
import { SYNCED_EVENT } from '../utils/syncEvents';
import { MdSync } from 'react-icons/md';

const LEDGER_WEEKS = 9; // this week plus the 8 before it

function Dashboard() {
  const [report, setReport] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const colorOf = useColors();

  useEffect(() => {
    load();
    // The header's sync button reports here so the week reloads.
    const reload = () => load(false);
    window.addEventListener(SYNCED_EVENT, reload);
    return () => window.removeEventListener(SYNCED_EVENT, reload);
  }, []);

  const load = async (spinner = true) => {
    if (spinner) setIsLoading(true);
    setError(null);
    try {
      const [data, history] = await Promise.all([
        reportsAPI.currentWeek(),
        reportsAPI.ranges(lastWeeks(LEDGER_WEEKS)).catch(() => []),
      ]);
      setReport(data);
      setWeeks(history.map(summarize));
    } catch (err) {
      console.error('Failed to load current week:', err);
      setError('Load failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await calendarAPI.sync();
      window.dispatchEvent(new Event(SYNCED_EVENT));
    } catch (err) {
      console.error('Sync failed:', err);
      setError('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const cur = useMemo(() => summarize(report), [report]);

  if (isLoading) return <Loading />;

  if (error || !report) {
    return (
      <div className="flex items-center justify-center gap-3 py-12 text-muted">
        {error && <span className="text-warn">{error}</span>}
        <button onClick={handleSync} disabled={isSyncing} title="Sync" className="p-2 rounded-lg hover:bg-soft">
          <MdSync size={20} className={isSyncing ? 'animate-spin-reverse' : ''} />
        </button>
      </div>
    );
  }

  const order = chartNames(report.section_hierarchy);
  const seen = new Set([...order, ...weeks.flatMap(w => (w ? Object.keys(w.by) : []))]);
  const keys = [...order, ...[...seen].filter(k => !order.includes(k) && k !== OTHER), OTHER]
    .filter(k => cur.by[k] > 0.05 || weeks.some(w => w?.by[k] > 0.05));
  const ledgerWeeks = weeks.length ? [...weeks.slice(0, -1), cur] : [cur];

  // Pace: the average of the previous weeks, scaled to how far into this week we are.
  const prev = weeks.slice(0, -1).filter(Boolean);
  const avgPrev = prev.length ? prev.reduce((a, w) => a + w.total, 0) / prev.length : 0;
  const elapsed = Math.min(1, (Date.now() - getSunday(new Date()).getTime()) / (7 * 864e5));
  const pace = avgPrev * elapsed;
  const delta = cur.total - pace;
  const parts = keys.map(k => ({ name: k, value: cur.by[k] || 0, color: colorOf(k) }));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <div className="space-y-3">
          <div className="text-center pt-1 pb-2">
            <div className="text-5xl font-bold tracking-tight num">
              {h1(cur.total)}<small className="text-sm font-medium text-muted ml-0.5">h</small>
            </div>
            <div className="text-[13px] text-muted num mt-0.5">
              {prev.length > 0 && (
                <span className={delta < 0 ? 'text-warn' : 'text-good'} title={`vs ${prev.length}-week avg by now (${h1(pace)} h)`}>
                  {delta < 0 ? '−' : '+'}{h1(Math.abs(delta))}
                </span>
              )}
              {prev.length > 0 && ' · '}
              {md(parseDateLocal(report.week_start))} – {md(parseDateLocal(report.week_end))}
            </div>
            <div className="max-w-[300px] mx-auto mt-3">
              <SplitBar parts={parts} total={cur.total} />
            </div>
          </div>
          <Ledger keys={keys} weeks={ledgerWeeks} current={cur} colorOf={colorOf} />
        </div>

        <div className="panel hidden lg:block px-3.5 py-3">
          <div className="text-xs text-muted mb-1.5">Categories</div>
          <CategoryBars summary={cur} colorOf={colorOf} />
        </div>
      </div>

      <WeeklyTrendChart colorOf={colorOf} order={order} />

      <WeekTimeGrid events={report.events} hierarchy={report.section_hierarchy} colorOf={colorOf} />
    </div>
  );
}

export default Dashboard;
