import { useState, useEffect } from 'react';
import { MdSync } from 'react-icons/md';
import { reportsAPI, calendarAPI } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { sortCategoriesBySection } from '../utils/categoryHelpers';
import { parseDateLocal } from '../utils/dateHelpers';
import WeeklyTrendChart from './WeeklyTrendChart';

const COLORS = ['#2563EB', '#0891B2', '#0D9488', '#059669', '#4F46E5', '#7C3AED', '#0284C7', '#10B981'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg px-3 py-2 text-sm border-0 ring-1 ring-black/5">
      {label && <p className="font-medium text-gray-700 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill || entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">{entry.value}h</span>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    loadCurrentWeek();
  }, []);

  const loadCurrentWeek = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await reportsAPI.currentWeek();
      setReport(data);
    } catch (err) {
      console.error('Failed to load current week:', err);
      setError('Failed to load data. Please try syncing your calendars.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const result = await calendarAPI.sync();
      setLastSync(new Date(result.stats.sync_time));
      await loadCurrentWeek();
    } catch (err) {
      console.error('Sync failed:', err);
      setError('Sync failed. Please check your calendar connections.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No data available</p>
        <button
          onClick={handleSync}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Sync Calendars
        </button>
      </div>
    );
  }

  // Prepare chart data with sorting by section
  const categoryChartData = sortCategoriesBySection(Object.entries(report.category_summary))
    .map(([id, data]) => ({
      name: data.name,
      rawHours: parseFloat((data.raw_hours_total || data.raw_hours || 0).toFixed(2)),
    }));

  const unsectionedHours = Object.values(report.category_summary)
    .filter(c => !c.section_id)
    .reduce((sum, c) => sum + (c.raw_hours_total || 0), 0);

  const sectionChartData = [
    ...(report.section_hierarchy || [])
      .filter(s => s.total_raw_hours > 0)
      .map(s => ({ name: s.name, value: parseFloat(s.total_raw_hours.toFixed(2)) })),
    ...(unsectionedHours > 0 ? [{ name: 'Other', value: parseFloat(unsectionedHours.toFixed(2)) }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Current Week</h2>
            <p className="text-gray-600">
              {parseDateLocal(report.week_start).toLocaleDateString()} -{' '}
              {parseDateLocal(report.week_end).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            title="Sync calendars"
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition"
          >
            <MdSync size={22} className={isSyncing ? 'animate-spin-reverse' : ''} />
          </button>
        </div>
        {lastSync && (
          <p className="text-sm text-gray-500 mt-2">
            Last synced: {lastSync.toLocaleString()}
          </p>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Hours</h3>
        <p className="text-3xl font-bold text-gray-900 mt-2">
          {(report.totals.raw_hours_total || 0).toFixed(1)}h
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Distribution */}
        {sectionChartData.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">By Section</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={sectionChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {sectionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">By Category</p>
          <table className="min-w-full">
            <tbody className="divide-y divide-gray-50">
              {categoryChartData.slice(0, 8).map((cat, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 text-sm text-gray-700">{cat.name}</td>
                  <td className="py-2.5 text-sm text-gray-400 text-right">{cat.rawHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Trend */}
      <WeeklyTrendChart />

      {/* Recent Events */}
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Recent Events</p>
        <div>
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Title</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.events.slice().reverse().slice(0, 10).map((event, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900">{event.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {event.category_name && event.category_name !== 'Uncategorized' ? event.category_name : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(event.start_time).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{event.duration_hours.toFixed(2)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
