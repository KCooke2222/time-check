import { useState, useEffect } from 'react';
import { reportsAPI, calendarAPI } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

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
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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

  // Prepare chart data
  const categoryChartData = Object.entries(report.category_summary).map(([id, data]) => ({
    name: data.name,
    rawHours: parseFloat(data.raw_hours.toFixed(2)),
    intensityHours: parseFloat(data.intensity_hours.toFixed(2)),
  }));

  const sectionChartData = Object.entries(report.section_summary).map(([id, data]) => ({
    name: data.name,
    value: parseFloat(data.intensity_hours.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Current Week</h2>
            <p className="text-gray-600">
              {new Date(report.week_start).toLocaleDateString()} -{' '}
              {new Date(report.week_end).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`px-4 py-2 rounded font-medium ${
              isSyncing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
        {lastSync && (
          <p className="text-sm text-gray-500 mt-2">
            Last synced: {lastSync.toLocaleString()}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">Raw Hours</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">
            {report.totals.raw_hours.toFixed(1)}h
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">Intensity Hours</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {report.totals.intensity_hours.toFixed(1)}h
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">Intensity Bonus</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {(report.totals.intensity_hours - report.totals.raw_hours).toFixed(1)}h
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Distribution */}
        {sectionChartData.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Time by Section (Intensity-Adjusted)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sectionChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name}: ${entry.value}h`}
                >
                  {sectionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Category Breakdown
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {categoryChartData.map((cat, idx) => (
              <div key={idx} className="border-b pb-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">{cat.name}</span>
                  <div className="text-sm text-gray-600">
                    <span className="mr-3">Raw: {cat.rawHours}h</span>
                    <span className="font-semibold text-blue-600">
                      Intensity: {cat.intensityHours}h
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Events</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Intensity
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {report.events.slice(0, 10).map((event, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {event.category_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(event.start_time).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {event.duration_hours.toFixed(2)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        event.color === 'blue'
                          ? 'bg-blue-100 text-blue-800'
                          : event.color === 'red'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {event.intensity_hours.toFixed(2)}h
                    </span>
                  </td>
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
