import React, { useState } from 'react';

const DatePickerCalendar = ({ 
  selectedDate, 
  onDateSelect, 
  onClose, 
  isVisible = false,
  maxDate = new Date(),
  minDate = null,
  theme = 'green' // green, blue, purple, etc.
}) => {
  const [calendarMonth, setCalendarMonth] = useState(new Date(selectedDate || new Date()));

  // Theme configurations
  const themes = {
    green: {
      bg: 'bg-white',
      headerBg: 'bg-gradient-to-r from-green-400 to-emerald-500',
      selectedBg: 'bg-green-500',
      selectedHover: 'hover:bg-green-600',
      todayBg: 'bg-green-50',
      todayText: 'text-green-700',
      todayBorder: 'border-green-300',
      hoverBg: 'hover:bg-green-50',
      buttonHover: 'hover:bg-green-50',
      disabledText: 'text-gray-400',
      currentMonthText: 'text-gray-700',
      otherMonthText: 'text-gray-400',
      headerText: 'text-white'
    },
    blue: {
      bg: 'bg-white',
      headerBg: 'bg-gradient-to-r from-blue-400 to-cyan-500',
      selectedBg: 'bg-blue-500',
      selectedHover: 'hover:bg-blue-600',
      todayBg: 'bg-blue-50',
      todayText: 'text-blue-700',
      todayBorder: 'border-blue-300',
      hoverBg: 'hover:bg-blue-50',
      buttonHover: 'hover:bg-blue-50',
      disabledText: 'text-gray-400',
      currentMonthText: 'text-gray-700',
      otherMonthText: 'text-gray-400',
      headerText: 'text-white'
    }
  };

  const currentTheme = themes[theme] || themes.green;

  // Generate calendar grid
  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const today = new Date();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    const days = [];
    
    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({
        date: prevDate,
        dayNumber: prevDate.getDate(),
        isCurrentMonth: false,
        isToday: prevDate.toDateString() === today.toDateString(),
        isSelected: selectedDate && prevDate.toDateString() === selectedDate.toDateString(),
        isFuture: maxDate ? prevDate > maxDate : false,
        isPast: minDate ? prevDate < minDate : false
      });
    }
    
    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date: date,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        isSelected: selectedDate && date.toDateString() === selectedDate.toDateString(),
        isFuture: maxDate ? date > maxDate : false,
        isPast: minDate ? date < minDate : false
      });
    }
    
    // Add days from next month to fill the grid
    const remainingCells = 42 - days.length; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
      const nextDate = new Date(year, month + 1, day);
      days.push({
        date: nextDate,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: nextDate.toDateString() === today.toDateString(),
        isSelected: selectedDate && nextDate.toDateString() === selectedDate.toDateString(),
        isFuture: maxDate ? nextDate > maxDate : false,
        isPast: minDate ? nextDate < minDate : false
      });
    }
    
    return days;
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(calendarMonth.getMonth() + direction);
    setCalendarMonth(newMonth);
  };

  const handleDateClick = (day) => {
    if (day.isFuture || day.isPast) return;
    onDateSelect(day.date);
    if (onClose) onClose();
  };

  const isDateDisabled = (day) => {
    return day.isFuture || day.isPast;
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className={`${currentTheme.bg} rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-gray-100`}>
        {/* Calendar Header */}
        <div className={`${currentTheme.headerBg} rounded-2xl p-4 mb-6`}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateMonth(-1)}
              className={`p-2 ${currentTheme.buttonHover} rounded-xl transition-colors ${currentTheme.headerText}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <h3 className={`text-xl font-bold ${currentTheme.headerText}`}>
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            
            <button
              onClick={() => navigateMonth(1)}
              className={`p-2 ${currentTheme.buttonHover} rounded-xl transition-colors ${currentTheme.headerText}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 p-2 ${currentTheme.buttonHover} rounded-xl transition-colors ${currentTheme.headerText}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Days of Week Headers */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <div key={index} className="text-center text-sm font-semibold text-gray-500 py-3">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {generateCalendarDays().map((day, index) => {
            const isDisabled = isDateDisabled(day);
            
            return (
              <button
                key={index}
                onClick={() => handleDateClick(day)}
                disabled={isDisabled}
                className={`
                  aspect-square p-2 text-sm font-medium rounded-xl transition-all duration-200 relative
                  ${day.isSelected
                    ? `${currentTheme.selectedBg} text-white shadow-lg transform scale-105 ${currentTheme.selectedHover}`
                    : day.isToday && !day.isSelected
                      ? `${currentTheme.todayBg} ${currentTheme.todayText} border-2 ${currentTheme.todayBorder} font-bold`
                      : day.isCurrentMonth
                        ? isDisabled
                          ? `${currentTheme.disabledText} cursor-not-allowed opacity-50`
                          : `${currentTheme.currentMonthText} ${currentTheme.hoverBg} hover:scale-105`
                        : isDisabled
                          ? `${currentTheme.disabledText} cursor-not-allowed opacity-30`
                          : `${currentTheme.otherMonthText} ${currentTheme.hoverBg} hover:scale-105`
                  }
                `}
              >
                {day.dayNumber}
                
                {/* Today indicator dot */}
                {day.isToday && !day.isSelected && (
                  <div className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full ${currentTheme.selectedBg}`} />
                )}
              </button>
            );
          })}
        </div>
        
        {/* Footer with today button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => {
              const today = new Date();
              if (!maxDate || today <= maxDate) {
                onDateSelect(today);
                if (onClose) onClose();
              }
            }}
            className={`px-6 py-2 ${currentTheme.selectedBg} text-white rounded-full ${currentTheme.selectedHover} transition-colors font-medium shadow-md`}
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatePickerCalendar;
