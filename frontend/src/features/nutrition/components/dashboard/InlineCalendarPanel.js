import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';

/**
 * Slide-down month grid (private to HorizontalCalendarStrip).
 * Pure presentation — parent owns date + month state.
 */
function InlineCalendarPanel({
  selectedDate,
  setSelectedDate,
  showCalendar,
  setShowCalendar,
  calendarMonth,
  setCalendarMonth,
}) {
  return (
    <div
      className={`bg-white shadow-sm overflow-hidden transition-all duration-300 ease-in-out ${
        showCalendar ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div
        className={`max-w-md mx-auto p-0 md:p-4 transform transition-transform duration-300 ease-in-out ${
          showCalendar ? 'translate-y-0' : '-translate-y-4'
        }`}
      >
        <div className="bg-white rounded-2xl border-0 md:border md:border-grey-100">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-grey-100">
            <TouchFeedbackButton
              onClick={() => {
                const prevMonth = new Date(calendarMonth);
                prevMonth.setMonth(prevMonth.getMonth() - 1);
                setCalendarMonth(prevMonth);
              }}
              className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
              ariaLabel="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-grey-600" />
            </TouchFeedbackButton>

            <h3 className="text-lg font-semibold text-grey-900">
              {calendarMonth.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </h3>

            <TouchFeedbackButton
              onClick={() => {
                const nextMonth = new Date(calendarMonth);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                setCalendarMonth(nextMonth);
              }}
              className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
              ariaLabel="Next month"
            >
              <ChevronRight className="w-5 h-5 text-grey-600" />
            </TouchFeedbackButton>
          </div>

          {/* Days of Week Headers */}
          <div className="grid grid-cols-7 gap-1 px-4 pt-4 pb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div
                key={index}
                className="text-center text-sm font-semibold text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 px-4 pb-4">
            {(() => {
              const year = calendarMonth.getFullYear();
              const month = calendarMonth.getMonth();
              const today = new Date();

              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0);
              const daysInMonth = lastDay.getDate();
              const startingDayOfWeek = firstDay.getDay();

              const days = [];

              for (let i = 0; i < startingDayOfWeek; i++) {
                const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
                days.push({
                  date: prevDate,
                  dayNumber: prevDate.getDate(),
                  isCurrentMonth: false,
                  isToday: prevDate.toDateString() === today.toDateString(),
                  isSelected:
                    prevDate.toDateString() === selectedDate.toDateString(),
                  isFuture: prevDate > today,
                });
              }

              for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                days.push({
                  date,
                  dayNumber: day,
                  isCurrentMonth: true,
                  isToday: date.toDateString() === today.toDateString(),
                  isSelected:
                    date.toDateString() === selectedDate.toDateString(),
                  isFuture: date > today,
                });
              }

              const remainingCells = 42 - days.length;
              for (let day = 1; day <= remainingCells; day++) {
                const nextDate = new Date(year, month + 1, day);
                days.push({
                  date: nextDate,
                  dayNumber: day,
                  isCurrentMonth: false,
                  isToday: nextDate.toDateString() === today.toDateString(),
                  isSelected:
                    nextDate.toDateString() === selectedDate.toDateString(),
                  isFuture: nextDate > today,
                });
              }

              return days.map((day, index) => {
                const isDisabled = day.isFuture;
                return (
                  <TouchFeedbackButton
                    key={index}
                    onClick={() => {
                      if (!isDisabled) {
                        setSelectedDate(day.date);
                        setShowCalendar(false);
                      }
                    }}
                    disabled={isDisabled}
                    className={`
                      aspect-square p-2 text-sm font-medium rounded-lg transition-all duration-200 relative
                      ${
                        day.isSelected
                          ? 'bg-emerald-500 text-white shadow-lg transform scale-105'
                          : day.isToday && !day.isSelected
                          ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300 font-bold'
                          : day.isCurrentMonth
                          ? isDisabled
                            ? 'text-gray-400 cursor-not-allowed opacity-50'
                            : 'text-gray-700 hover:bg-emerald-50 hover:scale-105'
                          : isDisabled
                          ? 'text-gray-300 cursor-not-allowed opacity-30'
                          : 'text-gray-400 hover:bg-emerald-50 hover:scale-105'
                      }
                    `}
                  >
                    {day.dayNumber}

                    {day.isToday && !day.isSelected && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </TouchFeedbackButton>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InlineCalendarPanel;
