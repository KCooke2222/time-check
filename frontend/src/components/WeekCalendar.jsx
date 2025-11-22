import { useState, useMemo, useRef } from 'react';
import { formatDateLocal } from '../utils/dateHelpers';

function WeekCalendar({ selectedWeeks, onWeekSelect }) {
  const [startMonth, setStartMonth] = useState(() => {
    // If there's a selected week, center on that month, otherwise use current month
    if (selectedWeeks && selectedWeeks.length > 0) {
      const [year, month, day] = selectedWeeks[0].split('-').map(Number);
      const firstSelectedWeek = new Date(year, month - 1, day);
      return new Date(firstSelectedWeek.getFullYear(), firstSelectedWeek.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartWeek = useRef(null);
  const draggedWeeks = useRef(new Set());

  // Get today's date for comparison
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  // Generate weeks for 3 consecutive months
  const monthsData = useMemo(() => {
    const months = [];

    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const monthDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + monthOffset, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      // Get first day of month
      const firstDay = new Date(year, month, 1);
      // Get last day of month
      const lastDay = new Date(year, month + 1, 0);

      // Find the Sunday before or on the first day
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());

      // Find the Saturday after or on the last day
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

      // Build weeks array
      const weeksArray = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        const weekStart = new Date(current);
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const days = [];
        for (let i = 0; i < 7; i++) {
          const day = new Date(current);
          day.setDate(day.getDate() + i);
          days.push({
            date: new Date(day),
            isCurrentMonth: day.getMonth() === month
          });
        }

        weeksArray.push({
          weekStart: formatDateLocal(weekStart),
          weekEnd: formatDateLocal(weekEnd),
          days
        });

        current.setDate(current.getDate() + 7);
      }

      months.push({
        date: monthDate,
        weeks: weeksArray
      });
    }

    return months;
  }, [startMonth]);

  const handlePrevMonth = () => {
    setStartMonth(new Date(startMonth.getFullYear(), startMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setStartMonth(new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 1));
  };

  const isWeekSelected = (weekStart) => {
    return selectedWeeks.includes(weekStart);
  };

  const isPastDay = (date) => {
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  const handleClearSelection = () => {
    selectedWeeks.forEach(weekStart => onWeekSelect(weekStart));
  };

  const handleMouseDown = (weekStart) => {
    setIsDragging(true);
    dragStartWeek.current = weekStart;
    draggedWeeks.current = new Set([weekStart]);
    onWeekSelect(weekStart);
  };

  const handleMouseEnter = (weekStart) => {
    if (isDragging && !draggedWeeks.current.has(weekStart)) {
      draggedWeeks.current.add(weekStart);
      onWeekSelect(weekStart);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartWeek.current = null;
    draggedWeeks.current.clear();
  };

  // Add global mouse up listener to handle drag end outside component
  const handleGlobalMouseUp = () => {
    if (isDragging) {
      handleMouseUp();
    }
  };

  return (
    <div onMouseUp={handleGlobalMouseUp} onMouseLeave={handleGlobalMouseUp}>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
        >
          &larr;
        </button>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-gray-600">
            {selectedWeeks.length > 0 ? `${selectedWeeks.length} week${selectedWeeks.length > 1 ? 's' : ''} selected` : 'Select weeks'}
          </div>
          {selectedWeeks.length > 0 && (
            <button
              onClick={handleClearSelection}
              className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded border border-red-300"
            >
              Clear
            </button>
          )}
        </div>
        <button
          onClick={handleNextMonth}
          className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
        >
          &rarr;
        </button>
      </div>

      {/* 3-Month Calendar Grid */}
      <div className="grid grid-cols-3 gap-4">
        {monthsData.map((monthData, monthIdx) => (
          <div key={monthIdx} className="bg-gray-50 rounded-lg p-4">
            {/* Month Header */}
            <h3 className="text-center text-sm font-semibold text-gray-800 mb-3">
              {monthData.date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </h3>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={idx} className="text-center text-xs font-medium text-gray-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div className="space-y-1">
              {monthData.weeks.map((week, weekIndex) => {
                const isSelected = isWeekSelected(week.weekStart);
                // Check if all days in this week are in the past
                const allDaysPast = week.days.every(day => isPastDay(day.date));

                return (
                  <div
                    key={weekIndex}
                    className={`grid grid-cols-7 gap-1 rounded transition-colors select-none ${
                      isSelected
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : allDaysPast
                        ? 'bg-gray-200 hover:bg-gray-300'
                        : 'hover:bg-gray-200'
                    }`}
                    onMouseDown={() => handleMouseDown(week.weekStart)}
                    onMouseEnter={() => handleMouseEnter(week.weekStart)}
                  >
                    {week.days.map((day, dayIndex) => {
                      return (
                        <div
                          key={dayIndex}
                          className={`text-center py-1.5 px-0.5 text-xs ${
                            isSelected
                              ? day.isCurrentMonth
                                ? 'text-white font-semibold'
                                : 'text-blue-100'
                              : day.isCurrentMonth
                              ? allDaysPast
                                ? 'text-gray-700'
                                : 'text-gray-800'
                              : 'text-gray-400'
                          }`}
                        >
                          {day.date.getDate()}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WeekCalendar;
