// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Activity, Scale, ChevronLeft, ChevronRight } from 'lucide-react';
import NutritionDashboard from './NutritionDashboard';
import WeightDashboard from './WeightDashboard';

/**
 * Unified Dashboard with tabs for Nutrition and Weight tracking
 * Replaces the separate Nutrition Dashboard and Weight Tracking pages
 */
const Dashboard = ({ user, onBack, apiBaseUrl, onMealDelete }) => {
  const [activeTab, setActiveTab] = useState(() => {
    // Restore last active tab from localStorage
    return localStorage.getItem('dashboard_activeTab') || 'nutrition';
  });

  // Unified date state shared between both tabs
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Helper function to check if device is mobile
  const isMobileDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

  // Generate horizontal calendar dates (desktop view)
  const generateHorizontalCalendarDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() + i);
      const prevDate = i > -3 ? new Date(selectedDate) : null;
      if (prevDate) prevDate.setDate(selectedDate.getDate() + (i - 1));
      const isNewMonth = i === -3 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: date > today,
        isNewMonth
      });
    }
    return dates;
  };

  // Generate scrollable dates (mobile view)
  const generateScrollableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -20; i <= 0; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const prevDate = i > -20 ? new Date(today) : null;
      if (prevDate) prevDate.setDate(today.getDate() + (i - 1));
      const isNewMonth = i === -20 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: false,
        isNewMonth
      });
    }
    return dates;
  };

  // Navigate to previous/next date
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    const today = new Date();
    if (newDate <= today) {
      setSelectedDate(newDate);
    }
  };

  // Auto-scroll to selected date on mobile
  useEffect(() => {
    if (isMobileDevice()) {
      setTimeout(() => {
        const scrollableDates = generateScrollableDates();
        const selectedIndex = scrollableDates.findIndex(
          (d) => d.date.toDateString() === selectedDate.toDateString()
        );
        if (selectedIndex !== -1) {
          const el = document.querySelector(`[data-date-index="${selectedIndex}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Save active tab to localStorage when it changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('dashboard_activeTab', tab);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-br from-orange-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header with tabs */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {/* Top bar with back button and title */}
          <div className="flex items-center justify-between p-4 md:p-6 pb-3">
            <button 
              onClick={onBack} 
              className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>

            <div className="text-center">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-500">Track your wellness journey</p>
            </div>

            {/* Empty div for spacing balance */}
            <div className="w-10 md:w-12"></div>
          </div>
        </div>

        {/* Common Date Selector - Placed above tabs */}
        <div className="w-full bg-white/50 backdrop-blur-sm shadow-sm border-b border-gray-200">
          {isMobileDevice() ? (
            // Mobile: Scrollable horizontal date selector
            <div className="px-4 py-3">
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style jsx>{`div::-webkit-scrollbar{display:none;}`}</style>
                <div className="flex space-x-2 pb-1" style={{ minWidth: 'max-content' }}>
                  {generateScrollableDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 relative">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg px-1.5 py-1.5 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-semibold text-gray-600"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: '9px', letterSpacing: '1px' }}
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
                          ${day.isSelected ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300'
                            : day.isToday ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                            : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20' }`}
                      >
                        <div className="text-xs font-medium mb-0.5">{day.dayName}</div>
                        <div className="text-sm font-semibold">{day.dayNumber}</div>
                        {day.isToday && (
                          <div className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${day.isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Desktop: Horizontal calendar with navigation arrows
            <div className="flex items-center px-4 py-3 md:px-6 md:py-2">
              <button
                onClick={() => navigateDate(-1)}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 mr-2 md:mr-3 backdrop-blur-sm border border-white/20"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-center space-x-1 md:space-x-2">
                  {generateHorizontalCalendarDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 md:mx-2 relative h-full">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg md:rounded-xl px-1.5 md:px-2 py-2 md:py-3 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-bold text-gray-600 tracking-wider"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '2px' }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => !day.isFuture && setSelectedDate(day.date)}
                        disabled={day.isFuture}
                        className={`w-12 h-12 md:w-16 md:h-16 text-center rounded-lg md:rounded-2xl transition-all duration-300 relative backdrop-blur-sm border
                          ${day.isSelected ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300'
                            : day.isToday ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                            : day.isFuture ? 'text-gray-300 cursor-not-allowed bg-white/10 border-white/10'
                            : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20' }`}
                      >
                        <div className="text-xs font-medium mb-0.5 md:mb-1">{day.dayName}</div>
                        <div className="text-sm md:text-lg font-semibold">{day.dayNumber}</div>
                        {day.isToday && (
                          <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mx-auto mt-0.5 md:mt-1 ${day.isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigateDate(1)}
                disabled={(() => {
                  const nextDay = new Date(selectedDate);
                  nextDay.setDate(selectedDate.getDate() + 1);
                  return nextDay > new Date();
                })()}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 ml-2 md:ml-3 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="w-full bg-white border-b border-gray-200 shadow-sm">
          <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
            <div className="flex">
              <button
                onClick={() => handleTabChange('nutrition')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'nutrition'
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Nutrition</span>
              </button>

              <button
                onClick={() => handleTabChange('weight')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'weight'
                    ? ' border-emerald-300  text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Scale className="h-4 w-4" />
                <span>Weight</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="relative">
        {activeTab === 'nutrition' && (
          <NutritionDashboard
            user={user}
            onBack={onBack}
            apiBaseUrl={apiBaseUrl}
            onMealDelete={onMealDelete}
            hideHeader={true}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}

        {activeTab === 'weight' && (
          <WeightDashboard
            user={user}
            onBack={onBack}
            apiBaseUrl={apiBaseUrl}
            hideHeader={true}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
