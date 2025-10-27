import { useState } from 'react';
import { reportsAPI } from '../services/api';
import HierarchicalSectionReport from './HierarchicalSectionReport';

function Reports() {
  const [reportType, setReportType] = useState('weekly'); // 'weekly' or 'range'
  const [weeklyDate, setWeeklyDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleWeeklyReport = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await reportsAPI.weekly(weeklyDate || null);
      setReport(data);
    } catch (err) {
      console.error('Weekly report failed:', err);
      setError('Failed to generate weekly report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRangeReport = async (e) => {
    e.preventDefault();

    if (!rangeStart || !rangeEnd) {
      setError('Please provide both start and end dates');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await reportsAPI.range(rangeStart, rangeEnd);
      setReport(data);
    } catch (err) {
      console.error('Range report failed:', err);
      setError('Failed to generate range report');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Reports</h2>

        {/* Report Type Selector */}
        <div className="mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setReportType('weekly')}
              className={`px-4 py-2 rounded font-medium ${
                reportType === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Weekly Report
            </button>
            <button
              onClick={() => setReportType('range')}
              className={`px-4 py-2 rounded font-medium ${
                reportType === 'range'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Date Range Report
            </button>
          </div>
        </div>

        {/* Report Forms */}
        {reportType === 'weekly' && (
          <form onSubmit={handleWeeklyReport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date (any date within the target week)
              </label>
              <input
                type="date"
                value={weeklyDate}
                onChange={(e) => setWeeklyDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave empty for current week"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? 'Generating...' : 'Generate Weekly Report'}
            </button>
          </form>
        )}

        {reportType === 'range' && (
          <form onSubmit={handleRangeReport} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? 'Generating...' : 'Generate Range Report'}
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Report Results */}
      {report && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {reportType === 'weekly' ? 'Weekly Report' : 'Date Range Report'}
          </h3>

          <div className="mb-4 text-sm text-gray-600">
            <p>
              Period: {new Date(report.week_start || report.date_range_start).toLocaleDateString()} -{' '}
              {new Date(report.week_end || report.date_range_end).toLocaleDateString()}
            </p>
            {report.weeks_count && <p>Weeks: {report.weeks_count}</p>}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Raw Hours</p>
              <p className="text-2xl font-bold text-gray-800">
                {(report.totals.raw_hours_total || report.totals.raw_hours).toFixed(1)}h
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded">
              <p className="text-sm text-gray-600">Intensity Hours</p>
              <p className="text-2xl font-bold text-blue-600">
                {(report.totals.intensity_hours_total || report.totals.intensity_hours).toFixed(1)}h
              </p>
            </div>
            {report.totals.raw_hours_avg_per_week && (
              <>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Avg Raw/Week</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {report.totals.raw_hours_avg_per_week.toFixed(1)}h
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Avg Intensity/Week</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {report.totals.intensity_hours_avg_per_week.toFixed(1)}h
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Hierarchical Section Summary */}
          {report.section_hierarchy && report.section_hierarchy.length > 0 && (
            <HierarchicalSectionReport
              sectionHierarchy={report.section_hierarchy}
              reportType={reportType}
            />
          )}

          {/* Category Summary */}
          {report.category_summary && Object.keys(report.category_summary).length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">By Category</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Section
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Raw Hours
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Intensity Hours
                      </th>
                      {reportType === 'range' && (
                        <>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Weeks
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Avg/Week
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(report.category_summary).map(([id, data]) => (
                      <tr key={id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {data.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {data.section_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {(data.raw_hours_total || data.raw_hours).toFixed(2)}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold text-right">
                          {(data.intensity_hours_total || data.intensity_hours).toFixed(2)}h
                        </td>
                        {reportType === 'range' && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                              {data.weeks_present}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                              {data.intensity_hours_avg?.toFixed(2)}h
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Reports;
