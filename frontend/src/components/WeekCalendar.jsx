import { useState, useMemo, useRef } from 'react';
import { formatDateLocal } from '../utils/dateHelpers';

function WeekCalendar({ selectedWeeks, onWeekSelect }) {
  const [startMonth, setStartMonth] = useState(() => {
    // Center on current month (show prev month, current month, next month)
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
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
      {/* 3-Month Calendar Grid, month arrows at the edges */}
      <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6">
        <button onClick={handlePrevMonth} aria-label="Previous month"
          className="absolute left-0 -top-1 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-soft">‹</button>
        <button onClick={handleNextMonth} aria-label="Next month"
          className="absolute right-0 -top-1 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-soft">›</button>
        {monthsData.map((monthData, monthIdx) => (
          <div key={monthIdx} className={monthIdx === 1 ? '' : 'hidden sm:block'}>
            {/* Month Header */}
            <h3 className="text-center text-sm font-semibold mb-2 leading-6">
              {monthData.date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </h3>

            {/* Day Headers */}
            <div className="grid grid-cols-7 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={idx} className="text-center text-[10px] text-muted py-0.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div className="space-y-0.5">
              {monthData.weeks.map((week, weekIndex) => {
                const isSelected = isWeekSelected(week.weekStart);
                // Check if all days in this week are in the past
                const allDaysPast = week.days.every(day => isPastDay(day.date));

                return (
                  <div
                    key={weekIndex}
                    className={`grid grid-cols-7 rounded-[7px] cursor-pointer transition-colors select-none ${
                      isSelected
                        ? 'bg-ink hover:bg-ink/90'
                        : allDaysPast
                        ? 'bg-soft/60 hover:bg-soft'
                        : 'hover:bg-soft'
                    }`}
                    onMouseDown={() => handleMouseDown(week.weekStart)}
                    onMouseEnter={() => handleMouseEnter(week.weekStart)}
                  >
                    {week.days.map((day, dayIndex) => {
                      return (
                        <div
                          key={dayIndex}
                          className={`text-center py-2 sm:py-1 px-0.5 text-sm sm:text-xs num ${
                            isSelected
                              ? day.isCurrentMonth
                                ? 'text-panel font-semibold'
                                : 'text-panel/45'
                              : day.isCurrentMonth
                              ? 'text-ink'
                              : 'text-muted/50'
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
