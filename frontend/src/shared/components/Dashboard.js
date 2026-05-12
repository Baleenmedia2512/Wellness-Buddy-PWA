// src/components/Dashboard.js
import React, { useState, lazy, Suspense } from 'react';
import { ArrowLeft, AppleIcon, Calendar, ChevronLeft, ChevronRight, Footprints, Smartphone } from 'lucide-react';
import TouchFeedbackButton from './TouchFeedbackButton';
import { TeamMemberSearch } from '../../features/team';

// Custom weighing scale icon component
const WeighingScaleIcon = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Outer rounded square (scale body) */}
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    {/* Inner dial display area */}
    <path d="M6 10 C6 7, 18 7, 18 10" />
    {/* Dial tick marks */}
    <line x1="8" y1="8.5" x2="8" y2="9.5" />
    <line x1="12" y1="7" x2="12" y2="8" />
    <line x1="16" y1="8.5" x2="16" y2="9.5" />
    {/* Needle pointing up */}
    <line x1="12" y1="12" x2="12" y2="9" />
  </svg>
);

// Custom education icon component
const EducationIcon = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Book cover */}
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    {/* Book pages */}
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    {/* Bookmark */}
    <path d="M12 6v7" />
    <path d="M10 11l2 2 2-2" />
  </svg>
);

// âœ… LAZY LOADING: Load tab components on-demand (only one visible at a time)
const NutritionDashboard = lazy(() => import('../../features/nutrition/components/NutritionDashboard'));
const WeightDashboard = lazy(() => import('../../features/weight/components/WeightDashboard'));
const EducationDashboard = lazy(() => import('../../features/education/components/EducationDashboard'));
// FEATURE DISABLED: const StepsDashboard = lazy(() => import('./StepsDashboard'));
// FEATURE DISABLED: const ScreenDashboard = lazy(() => import('./ScreenDashboard'));

/**
 * Unified Dashboard with tabs for Nutrition and Weight tracking
 * Replaces the separate Nutrition Dashboard and Weight Tracking pages
 * @param {string} initialTab - Optional tab to open initially ('nutrition' or 'weight')
 * @param {string} userRole - User's role for access control (coach, coCoach, admin, user)
 * @param {string} initialTab - Optional tab to open initially ('nutrition' | 'weight' | 'education')
 */
const Dashboard = ({ user, onBack, apiBaseUrl, onMealDelete, initialTab, userRole = 'user', bmrUpdateKey = 0, educationRefreshKey = 0, watchBurnedCalories = 0 }) => {
  const [activeTab, setActiveTab] = useState(() => {
    // Use initialTab prop if provided, otherwise restore from localStorage
    if (initialTab && (initialTab === 'nutrition' || initialTab === 'weight' || initialTab === 'education' || initialTab === 'steps' || initialTab === 'screen')) {
      localStorage.setItem('dashboard_activeTab', initialTab);
      return initialTab;
    }
    return localStorage.getItem('dashboard_activeTab') || 'nutrition';
  });

  // Team member selection state (for coaches)
  const [selectedMember, setSelectedMember] = useState(null);
  
  // Unified date state shared between both tabs
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Calendar visibility and month navigation
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  
  // Determine which user's data to display (selected member or coach)
  const displayUser = selectedMember || user;

  // Save active tab to localStorage when it changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('dashboard_activeTab', tab);
    if (tab === 'steps' || tab === 'screen') {
      setSelectedDate(new Date());
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e8f5e9' }}>
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-br from-orange-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header with tabs */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        {/* Team Member Search - Only visible for coaches */}
        <TeamMemberSearch
          user={user}
          userRole={userRole}
          selectedMember={selectedMember}
          onMemberSelect={setSelectedMember}
        />
        
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {/* Top bar with back button and title */}
          <div className="flex items-center justify-between p-4 md:p-6 pb-3">
            <TouchFeedbackButton 
              onClick={onBack} 
              className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </TouchFeedbackButton>

            <div className="text-center">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">
                Dashboard{selectedMember && !selectedMember.isSelf ? ` - ${selectedMember.userName}` : ''}
              </h1>
              <p className="text-xs text-gray-500">
                {selectedMember && !selectedMember.isSelf 
                  ? `Viewing ${selectedMember.userName}'s data`
                  : 'Track your wellness journey'
                }
              </p>
            </div>

            {/* Calendar button - show for steps and screen tabs */}
            {(activeTab === 'steps' || activeTab === 'screen') && (
              <TouchFeedbackButton 
                onClick={() => { setShowCalendar(!showCalendar); setCalendarMonth(new Date(selectedDate)); }} 
                className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
                ariaLabel="Toggle calendar"
              >
                <Calendar className="h-5 w-5 text-gray-700" />
              </TouchFeedbackButton>
            )}
            {/* Empty space for tabs without top-right action */}
            {(activeTab === 'nutrition' || activeTab === 'weight' || activeTab === 'education') && (
              <div className="p-2 md:p-3 w-9 h-9 md:w-11 md:h-11"></div>
            )}
          </div>

          {/* Tab navigation */}
          <div className="flex justify-center border-b border-gray-200">
            <TouchFeedbackButton
              onClick={() => handleTabChange('nutrition')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 py-3 px-6 md:px-10 text-[12px] md:text-sm whitespace-nowrap font-medium border-b-2 transition-colors rounded-t-lg ${
                activeTab === 'nutrition'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AppleIcon 
                className="h-4 w-4 flex-shrink-0" 
                strokeWidth={3}
                style={{
                  stroke: activeTab === 'nutrition' ? '#16a34a' : 'currentColor',
                  fill: 'none'
                }}
              />
              <span>Food</span>
            </TouchFeedbackButton>

            <TouchFeedbackButton
              onClick={() => handleTabChange('weight')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 py-3 px-6 md:px-10 text-[12px] md:text-sm whitespace-nowrap font-medium border-b-2 transition-colors rounded-t-lg ${
                activeTab === 'weight'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <WeighingScaleIcon className="h-4 w-4 flex-shrink-0" />
              <span>Weight</span>
            </TouchFeedbackButton>

            <TouchFeedbackButton
              onClick={() => handleTabChange('education')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 py-3 px-6 md:px-10 text-[12px] md:text-sm whitespace-nowrap font-medium border-b-2 transition-colors rounded-t-lg ${
                activeTab === 'education'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <EducationIcon className="h-4 w-4 flex-shrink-0" />
              <span>Education</span>
            </TouchFeedbackButton>

            {/* FEATURE DISABLED: Steps tab button
            <TouchFeedbackButton
              onClick={() => handleTabChange('steps')}
              className={`w-full min-w-0 flex items-center justify-center gap-1 md:gap-2 py-3 px-1 md:px-4 text-[12px] md:text-sm whitespace-nowrap font-medium border-b-2 transition-colors rounded-t-lg ${
                activeTab === 'steps'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Footprints className="hidden md:block h-4 w-4" />
              <span>Steps</span>
            </TouchFeedbackButton>
            */}

            {/* FEATURE DISABLED: Screen tab button
            <TouchFeedbackButton
              onClick={() => handleTabChange('screen')}
              className={`w-full min-w-0 flex items-center justify-center gap-1 md:gap-2 py-3 px-1 md:px-4 text-[12px] md:text-sm whitespace-nowrap font-medium border-b-2 transition-colors rounded-t-lg ${
                activeTab === 'screen'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Smartphone className="hidden md:block h-4 w-4" />
              <span>Screen</span>
            </TouchFeedbackButton>
            */}
          </div>
        </div>
      </div>

      {/* Inline Calendar with Slide Animation - only show for steps and screen tabs */}
      {(activeTab === 'steps' || activeTab === 'screen') && (
        <div className={`bg-white shadow-sm overflow-hidden transition-all duration-300 ease-in-out ${
          showCalendar ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
        }`}>
        <div className={`max-w-md mx-auto p-0 md:p-4 transform transition-transform duration-300 ease-in-out ${
          showCalendar ? 'translate-y-0' : '-translate-y-4'
        }`}>
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
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
                const remainingCells = 42 - days.length; // 6 rows Ã— 7 days
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
                    </TouchFeedbackButton>
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
              user={displayUser}
              onBack={onBack}
              apiBaseUrl={apiBaseUrl}
              onMealDelete={onMealDelete}
              hideHeader={true}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              bmrUpdateKey={bmrUpdateKey}
              watchBurnedCalories={watchBurnedCalories}
            />
          )}

          {activeTab === 'weight' && (
            <WeightDashboard
              user={displayUser}
              onBack={onBack}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
            />
          )}

          {activeTab === 'education' && (
            <EducationDashboard
              user={displayUser}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
              refreshKey={educationRefreshKey}
            />
          )}

          {/* FEATURE DISABLED: Steps tab content
          {activeTab === 'steps' && (
            <StepsDashboard
              user={displayUser}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
              selectedDate={selectedDate}
              setSelectedDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
            />
          )}
          */}

          {/* FEATURE DISABLED: Screen tab content
          {activeTab === 'screen' && (
            <ScreenDashboard
              key={displayUser?.id || displayUser?.userId || 'self'}
              user={displayUser}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
              selectedDate={selectedDate}
              setSelectedDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
            />
          )}
          */}
        </Suspense>
      </div>
    </div>
  );
};

export default Dashboard;
