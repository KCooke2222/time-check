import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import HierarchicalSectionReport from './HierarchicalSectionReport';
import { sortCategoriesBySection } from '../utils/categoryHelpers';
import WeekCalendar from './WeekCalendar';
import { formatDateLocal, parseDateLocal } from '../utils/dateHelpers';

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

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Weekly Reports</h2>
          {selectedWeeks.length > 0 && (
            <button
              onClick={() => selectedWeeks.forEach(weekStart => handleWeekSelect(weekStart))}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded border border-red-300 transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Week Calendar Selector */}
        <WeekCalendar
          selectedWeeks={selectedWeeks}
          onWeekSelect={handleWeekSelect}
        />

        {error && (
          <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Week Navigation Arrows (only show when exactly one week selected) */}
      {selectedWeeks.length === 1 && report && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded font-medium shadow-sm"
          >
            ← Previous Week
          </button>
          <button
            onClick={handleNextWeek}
            className="px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded font-medium shadow-sm"
          >
            Next Week →
          </button>
        </div>
      )}

      {/* Report Results */}
      {report && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Report for Selected Week{selectedWeeks.length > 1 ? 's' : ''}
          </h3>

          <div className="mb-4 text-sm text-gray-600">
            <p>
              Period: {parseDateLocal(report.date_range_start).toLocaleDateString()} -{' '}
              {parseDateLocal(report.date_range_end).toLocaleDateString()}
            </p>
            {report.weeks_count && <p>Weeks: {report.weeks_count.toFixed(1)}</p>}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold text-gray-800">
                {report.totals.raw_hours_total.toFixed(1)}h
              </p>
            </div>
            {selectedWeeks.length > 1 && (
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Avg / Week</p>
                <p className="text-2xl font-bold text-gray-800">
                  {report.totals.raw_hours_avg_per_week.toFixed(1)}h
                </p>
              </div>
            )}
          </div>

          {/* Hierarchical Section Summary */}
          {report.section_hierarchy && report.section_hierarchy.length > 0 && (
            <HierarchicalSectionReport
              sectionHierarchy={report.section_hierarchy}
              reportType={selectedWeeks.length > 1 ? 'range' : 'weekly'}
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
                        Hours
                      </th>
                      {selectedWeeks.length > 1 && (
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
                    {sortCategoriesBySection(Object.entries(report.category_summary))
                      .map(([id, data]) => (
                        <tr key={id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {data.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {data.section_name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                            {data.raw_hours_total.toFixed(2)}h
                          </td>
                          {selectedWeeks.length > 1 && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                {data.weeks_present}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                {data.raw_hours_avg?.toFixed(2)}h
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
