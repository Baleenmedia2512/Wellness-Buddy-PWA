// src/components/Dashboard.js
import React, { useState, lazy, Suspense } from 'react';
import { ArrowLeft, AppleIcon, Scale, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// ✅ LAZY LOADING: Load tab components on-demand (only one visible at a time)
const NutritionDashboard = lazy(() => import('./NutritionDashboard'));
const WeightDashboard = lazy(() => import('./WeightDashboard'));

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
  
  // Calendar visibility and month navigation
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

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

            {/* Calendar button - only show for nutrition tab */}
            {activeTab === 'nutrition' && (
              <button 
                onClick={() => setShowCalendar(!showCalendar)} 
                className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Calendar className="h-5 w-5 text-gray-700" />
              </button>
            )}
            {/* Empty space for weight tab to maintain layout */}
            {activeTab === 'weight' && (
              <div className="p-2 md:p-3 w-9 h-9 md:w-11 md:h-11"></div>
            )}
          </div>

          {/* Tab navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleTabChange('nutrition')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'nutrition'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AppleIcon 
                className="h-4 w-4" 
                strokeWidth={3}
                style={{
                  stroke: activeTab === 'nutrition' ? '#16a34a' : 'currentColor',
                  fill: 'none'
                }}
              />
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

      {/* Inline Calendar with Slide Animation - only show for nutrition tab */}
      {activeTab === 'nutrition' && (
        <div className={`bg-white shadow-sm overflow-hidden transition-all duration-300 ease-in-out ${
          showCalendar ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
        }`}>
        <div className={`max-w-md mx-auto p-0 md:p-4 transform transition-transform duration-300 ease-in-out ${
          showCalendar ? 'translate-y-0' : '-translate-y-4'
        }`}>
          <div className="bg-white rounded-2xl border-0 md:border md:border-grey-100">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-grey-100">
              <button
                onClick={() => {
                  const prevMonth = new Date(calendarMonth);
                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                  setCalendarMonth(prevMonth);
                }}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-grey-600" />
              </button>
              
              <h3 className="text-lg font-semibold text-grey-900">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              
              <button
                onClick={() => {
                  const nextMonth = new Date(calendarMonth);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setCalendarMonth(nextMonth);
                }}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-grey-600" />
              </button>
            </div>
            
            {/* Days of Week Headers */}
            <div className="grid grid-cols-7 gap-1 px-4 pt-4 pb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <div key={index} className="text-center text-sm font-semibold text-gray-500 py-2">
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
                    isSelected: prevDate.toDateString() === selectedDate.toDateString(),
                    isFuture: prevDate > today
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
                    isSelected: date.toDateString() === selectedDate.toDateString(),
                    isFuture: date > today
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
                    isSelected: nextDate.toDateString() === selectedDate.toDateString(),
                    isFuture: nextDate > today
                  });
                }
                
                return days.map((day, index) => {
                  const isDisabled = day.isFuture;
                  
                  return (
                    <button
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
                            ? `bg-gradient-to-br from-${
                                activeTab === 'nutrition' ? 'green-500 to-emerald-500' : 'emerald-400 to-teal-500'
                              } text-white shadow-lg transform scale-105`
                            : day.isToday && !day.isSelected
                              ? `bg-${
                                  activeTab === 'nutrition' ? 'green-100 text-green-700' : 'emerald-100 text-emerald-700'
                                } border-2 border-${
                                  activeTab === 'nutrition' ? 'green-300' : 'emerald-300'
                                } font-bold`
                              : day.isCurrentMonth
                                ? isDisabled
                                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                                  : `text-gray-700 hover:bg-${
                                      activeTab === 'nutrition' ? 'green-50' : 'emerald-50'
                                    } hover:scale-105`
                                : isDisabled
                                  ? 'text-gray-300 cursor-not-allowed opacity-30'
                                  : `text-gray-400 hover:bg-${
                                      activeTab === 'nutrition' ? 'green-50' : 'emerald-50'
                                    } hover:scale-105`
                        }
                      `}
                    >
                      {day.dayNumber}
                      
                      {/* Today indicator dot */}
                      {day.isToday && !day.isSelected && (
                        <div className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-${
                          activeTab === 'nutrition' ? 'green-500' : 'emerald-500'
                        }`} />
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab content */}
      <div className="relative">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-300 border-t-emerald-600"></div>
          </div>
        }>
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
            />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default Dashboard;
