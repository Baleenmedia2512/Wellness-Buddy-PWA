import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';
import {
  isMobileDevice,
  generateScrollableDates,
  generateHorizontalCalendarDates,
} from '../../services/nutritionDashboard';
import InlineCalendarPanel from './InlineCalendarPanel';

/**
 * Horizontal date strip (mobile: scrollable; desktop: paginated) plus the
 * slide-down month grid. Pure presentation — parent owns date + calendar state.
 */
function HorizontalCalendarStrip({
  selectedDate,
  setSelectedDate,
  navigateDate,
  showCalendar,
  setShowCalendar,
  calendarMonth,
  setCalendarMonth,
}) {
  return (
    <>
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {isMobileDevice() ? (
            <div className="px-4 py-3">
              <div
                className="overflow-x-auto"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <style>{`
                  div::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                <div
                  className="flex space-x-2 pb-1"
                  style={{ minWidth: 'max-content' }}
                >
                  {generateScrollableDates(selectedDate).map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 relative">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg px-1.5 py-1.5 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-semibold text-gray-600"
                              style={{
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                fontSize: '9px',
                                letterSpacing: '1px',
                              }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        data-date-index={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`flex-shrink-0 w-12 text-center py-2 px-1 rounded-lg transition-all duration-300 relative backdrop-blur-sm border
                          ${
                            day.isSelected
                              ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300'
                              : day.isToday
                              ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                              : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20'
                          }`}
                      >
                        <div className="text-xs font-medium mb-0.5">
                          {day.dayName}
                        </div>
                        <div className="text-sm font-semibold">
                          {day.dayNumber}
                        </div>
                        {day.isToday && (
                          <div
                            className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${
                              day.isSelected ? 'bg-white' : 'bg-emerald-500'
                            }`}
                          />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center px-4 py-3 md:px-6 md:py-2">
              <TouchFeedbackButton
                onClick={() => navigateDate(-1)}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 mr-2 md:mr-3 backdrop-blur-sm border border-white/20"
                ariaLabel="Previous day"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </TouchFeedbackButton>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-center space-x-1 md:space-x-2">
                  {generateHorizontalCalendarDates(selectedDate).map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 md:mx-2 relative h-full">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg md:rounded-xl px-1.5 md:px-2 py-2 md:py-3 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-bold text-gray-600 tracking-wider"
                              style={{
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                letterSpacing: '2px',
                              }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <TouchFeedbackButton
                        onClick={() =>
                          !day.isFuture && setSelectedDate(day.date)
                        }
                        disabled={day.isFuture}
                        className={`w-12 h-12 md:w-16 md:h-16 text-center rounded-lg md:rounded-2xl transition-all duration-300 relative backdrop-blur-sm border
                          ${
                            day.isSelected
                              ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300'
                              : day.isToday
                              ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                              : day.isFuture
                              ? 'text-gray-300 cursor-not-allowed bg-white/10 border-white/10'
                              : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20'
                          }`}
                        ariaLabel={`${day.dayName} ${day.dayNumber}`}
                      >
                        <div className="text-xs font-medium mb-0.5 md:mb-1">
                          {day.dayName}
                        </div>
                        <div className="text-sm md:text-lg font-semibold">
                          {day.dayNumber}
                        </div>
                        {day.isToday && (
                          <div
                            className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mx-auto mt-0.5 md:mt-1 ${
                              day.isSelected ? 'bg-white' : 'bg-emerald-500'
                            }`}
                          />
                        )}
                      </TouchFeedbackButton>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <TouchFeedbackButton
                onClick={() => navigateDate(1)}
                disabled={(() => {
                  const nextDay = new Date(selectedDate);
                  nextDay.setDate(selectedDate.getDate() + 1);
                  return nextDay > new Date();
                })()}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 ml-2 md:ml-3 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20"
                ariaLabel="Next day"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </TouchFeedbackButton>
            </div>
          )}
        </div>
      </div>

      {/* Inline Calendar with Slide Animation */}
      <InlineCalendarPanel
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
        calendarMonth={calendarMonth}
        setCalendarMonth={setCalendarMonth}
      />
    </>
  );
}

export default HorizontalCalendarStrip;
