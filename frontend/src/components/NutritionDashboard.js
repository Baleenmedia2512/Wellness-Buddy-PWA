import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, TrendingUp, ChevronLeft, ChevronRight, Calendar, Leaf, Beef, Wheat, Droplet } from 'lucide-react';
import DatePickerCalendar from './DatePickerCalendar';


const NutritionDashboard = ({ user, onBack, apiBaseUrl }) => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyStats, setDailyStats] = useState({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    mealCount: 0
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [isClosingModal, setIsClosingModal] = useState(false);

  // Generate calendar grid - removed since we're using the separate component

  // Meal time categories with updated times for better categorization
  const getMealCategory = (timeString) => {
    const hour = new Date(timeString).getHours();
    
    if (hour >= 5 && hour < 10) return 'breakfast';
    if (hour >= 10 && hour < 12) return 'morning-snack';
    if (hour >= 12 && hour < 16) return 'lunch';
    if (hour >= 16 && hour < 18) return 'evening-snack';
    if (hour >= 18 && hour < 23) return 'dinner';
    return 'late-night';
  };


  // Helper to format 24hr time to AM/PM
  const formatTimeAMPM = (hour, minute = 0) => {
    const d = new Date();
    d.setHours(hour);
    d.setMinutes(minute);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getMealCategoryInfo = (category) => {
    const categories = {
      'breakfast': {
        name: 'Breakfast',
        icon: '🍳',
        timeRange: { start: { h: 5, m: 0 }, end: { h: 10, m: 0 } },
        color: 'from-green-400 to-emerald-400',
        targetCalories: 525
      },
      'morning-snack': {
        name: 'Morning Snack',
        icon: '☕',
        timeRange: { start: { h: 10, m: 0 }, end: { h: 12, m: 0 } },
        color: 'from-emerald-400 to-teal-400',
        targetCalories: 262
      },
      'lunch': {
        name: 'Lunch',
        icon: '🍽️',
        timeRange: { start: { h: 12, m: 0 }, end: { h: 16, m: 0 } },
        color: 'from-teal-400 to-cyan-400',
        targetCalories: 650
      },
      'evening-snack': {
        name: 'Evening Snack',
        icon: '🍎',
        timeRange: { start: { h: 16, m: 0 }, end: { h: 18, m: 0 } },
        color: 'from-cyan-400 to-blue-400',
        targetCalories: 200
      },
      'dinner': {
        name: 'Dinner',
        icon: '🍝',
        timeRange: { start: { h: 18, m: 0 }, end: { h: 23, m: 0 } },
        color: 'from-blue-400 to-indigo-400',
        targetCalories: 700
      },
      'late-night': {
        name: 'Late Night',
        icon: '🌙',
        timeRange: { start: { h: 23, m: 0 }, end: { h: 5, m: 0 } },
        color: 'from-gray-400 to-slate-400',
        targetCalories: 150
      }
    };
    return categories[category] || categories['late-night'];
  };

  // Helper to format a time range object to AM/PM string
  const formatTimeRangeAMPM = (range) => {
    if (!range) return '';
    return `${formatTimeAMPM(range.start.h, range.start.m)} - ${formatTimeAMPM(range.end.h, range.end.m)}`;
  };


  // Detect if user is on mobile device
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
  };

  // Generate horizontal calendar dates (7 days centered around selected date)
  const generateHorizontalCalendarDates = () => {
    const dates = [];
    const today = new Date();
    
    // Get 7 days: 3 before selected, selected, 3 after selected
    for (let i = -3; i <= 3; i++) {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() + i);
      
      // Check if this is the first day of a new month in our date range
      const prevDate = i > -3 ? new Date(selectedDate) : null;
      if (prevDate) {
        prevDate.setDate(selectedDate.getDate() + (i - 1));
      }
      
      const isNewMonth = i === -3 || (prevDate && date.getMonth() !== prevDate.getMonth());
      
      dates.push({
        date: date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: date > today,
        isNewMonth: isNewMonth
      });
    }
    
    return dates;
  };

  // Generate extended date range for mobile scrolling (3 weeks = 21 days before today)
  const generateScrollableDates = () => {
    const dates = [];
    const today = new Date();
    
    // Generate 21 days: 20 days before today + today (no future dates)
    for (let i = -20; i <= 0; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Check if this is the first day of a new month
      const prevDate = i > -20 ? new Date(today) : null;
      if (prevDate) {
        prevDate.setDate(today.getDate() + (i - 1));
      }
      
      const isNewMonth = i === -20 || (prevDate && date.getMonth() !== prevDate.getMonth());
      
      dates.push({
        date: date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: false, // No future dates in this range
        isNewMonth: isNewMonth
      });
    }
    
    return dates;
  };

  // Auto-scroll to selected date on mobile and close calendar
  useEffect(() => {
    if (isMobileDevice()) {
      setTimeout(() => {
        const scrollableDates = generateScrollableDates();
        const selectedIndex = scrollableDates.findIndex(dateObj => 
          dateObj.date.toDateString() === selectedDate.toDateString()
        );
        if (selectedIndex !== -1) {
          const dateElement = document.querySelector(`[data-date-index="${selectedIndex}"]`);
          if (dateElement) {
            dateElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest',
              inline: 'center'
            });
          }
        }
      }, 100);
    }
    
    // Close calendar when date changes (for both web and mobile)
    setShowCalendar(false);
  }, [selectedDate]);

  const fetchDayAnalyses = useCallback(async (date) => {
    setLoading(true);
    setError(null);
    
    const calculateDailyStats = (dayAnalyses) => {
      const stats = dayAnalyses.reduce((acc, analysis) => {
        // Parse nutrition data from AnalysisData JSON
        const foodData = parseAnalysisData(analysis.AnalysisData);
        const nutrition = foodData.nutrition || {};
        
        // Use JSON nutrition data, fallback to database columns
        const calories = nutrition.calories || analysis.TotalCalories || 0;
        const protein = nutrition.protein || analysis.TotalProtein || 0;
        const carbs = nutrition.carbs || analysis.TotalCarbs || 0;
        const fat = nutrition.fat || analysis.TotalFat || 0;
        const fiber = nutrition.fiber || analysis.TotalFiber || 0;
        
        return {
          totalCalories: acc.totalCalories + calories,
          totalProtein: acc.totalProtein + protein,
          totalCarbs: acc.totalCarbs + carbs,
          totalFat: acc.totalFat + fat,
          totalFiber: acc.totalFiber + fiber,
          mealCount: acc.mealCount + 1
        };
      }, {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
        mealCount: 0
      });
      
      setDailyStats(stats);
    };
    
    try {
      // For OTP users, user.id contains the database UserID directly
      // For Firebase users, we need to lookup the UserID from team_table
      let actualUserId = user.id; // OTP users have database UserID here
      
      // If no user.id (Firebase user), lookup the team_table UserID
      if (!actualUserId && user.uid) {
        try {
          const lookupResponse = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: user.email, 
              firebaseUid: user.uid 
            })
          });
          const lookupData = await lookupResponse.json();
          if (lookupData.success && lookupData.userId) {
            actualUserId = lookupData.userId;
          } else {
            console.warn('[NutritionDashboard] No UserID found in team_table for:', user.email || user.uid);
            setError('User account not found in database. Please contact support.');
            return;
          }
        } catch (lookupErr) {
          console.error('[NutritionDashboard] UserID lookup failed:', lookupErr.message);
          setError('Failed to lookup user account. Please try again.');
          return;
        }
      }
      
      // Fallback if still no actualUserId
      if (!actualUserId) {
        console.error('[NutritionDashboard] No UserID available for user');
        setError('Unable to determine user account. Please try logging in again.');
        return;
      }
      
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Use the enhanced API for better performance
      const response = await fetch(
        `${apiBaseUrl}/api/user-nutrition-stats?userId=${actualUserId}&date=${dateString}&detailed=true`
      );
      const data = await response.json();
      
      if (data.success) {
        const analysesData = data.data || [];
        setAnalyses(analysesData);
        
        // Always calculate daily stats from the actual data to ensure accuracy
        calculateDailyStats(analysesData);
      } else {
        setError('Failed to load nutrition data');
        console.error('API Error:', data.message);
      }
    } catch (err) {
      console.error('Failed to fetch day analyses:', err);
      setError('Failed to load nutrition data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user, apiBaseUrl]);

  useEffect(() => {
    if (user) {
      fetchDayAnalyses(selectedDate);
    }
  }, [user, selectedDate, fetchDayAnalyses]);

  const formatDateHeader = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction);
    
    // Don't allow future dates
    const today = new Date();
    if (newDate <= today) {
      setSelectedDate(newDate);
    }
  };

  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setSelectedMeal(null);
      setIsClosingModal(false);
    }, 300); // Match the animation duration
  };

  const parseAnalysisData = (analysisData) => {
    try {
      const parsed = typeof analysisData === 'string' ? JSON.parse(analysisData) : analysisData;
      
      // Handle unified format with foods array and total object (both background service and manual saves)
      if (parsed.foods && parsed.foods.length > 0 && parsed.total) {
        // Use the total nutrition values for display
        return {
          name: parsed.foods.length > 1 
            ? `Mixed Foods (${parsed.foods.length} items)` 
            : parsed.foods[0].name || 'Unknown Food',
          nutrition: {
            calories: parsed.total.calories || 0,
            protein: parsed.total.protein || 0,
            carbs: parsed.total.carbs || 0,
            fat: parsed.total.fat || 0,
            fiber: parsed.total.fiber || 0
          },
          confidence: typeof parsed.confidence === 'string' 
            ? (parsed.confidence === 'medium' ? 0.7 : parsed.confidence === 'high' ? 0.9 : parsed.confidence === 'low' ? 0.5 : 0.7)
            : parsed.confidence || null,
          detailedItems: parsed.foods || []
        };
      }
      
      // Handle legacy manual save format with top-level nutrition object
      if (parsed.category && parsed.category.name) {
        return {
          name: parsed.category.name,
          nutrition: parsed.nutrition || {},
          confidence: parsed.confidence === 'medium' ? 0.7 : parsed.confidence === 'high' ? 0.9 : parsed.confidence === 'low' ? 0.5 : parsed.confidence || null,
          detailedItems: parsed.detailedItems || []
        };
      }
      
      // Handle legacy background service format with foods array but no total
      if (parsed.foods && parsed.foods.length > 0) {
        const firstFood = parsed.foods[0];
        return {
          name: firstFood.name || 'Unknown Food',
          nutrition: firstFood.nutrition || {},
          confidence: firstFood.confidence || null,
          detailedItems: parsed.foods || []
        };
      }
      
      return { name: 'Unknown Food', nutrition: {}, confidence: null, detailedItems: [] };
    } catch (err) {
      console.error('Error parsing analysis data:', err);
      return { name: 'Error parsing data', nutrition: {}, confidence: null, detailedItems: [] };
    }
  };

  // Group analyses by meal category
  const groupedMeals = analyses.reduce((groups, analysis) => {
    const category = getMealCategory(analysis.CreatedAt);
    if (!groups[category]) groups[category] = [];
    groups[category].push(analysis);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Background Elements - Simplified */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-br from-orange-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      {/* Fixed Header - Clean Design */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          <div className="flex items-center justify-between p-4 md:p-6">
            <button
              onClick={onBack}
              className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            
            <div className="text-center">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">Nutrition</h1>
              <p className="text-sm text-gray-600">{formatDateHeader(selectedDate)}</p>
            </div>
            
            {/* Calendar Button */}
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Calendar className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Date Calendar - Clean Design */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {isMobileDevice() ? (
            // Mobile: Horizontal Scrollable Date List
            <div className="px-4 py-3">
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style jsx>{`
                  div::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                <div className="flex space-x-2 pb-1" style={{ minWidth: 'max-content' }}>
                  {generateScrollableDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {/* Mobile Month Separator */}
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 relative">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg px-1.5 py-1.5 shadow-sm border border-white/20">
                            <div 
                              className="text-xs font-semibold text-gray-600"
                              style={{ 
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                fontSize: '9px',
                                letterSpacing: '1px'
                              }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Mobile Date Button */}
                      <button
                        data-date-index={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`
                          flex-shrink-0 w-12 text-center py-2 px-1 rounded-lg transition-all duration-300 relative backdrop-blur-sm border
                          ${day.isSelected 
                            ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300' 
                            : day.isToday && !day.isSelected
                              ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                              : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20'
                          }
                        `}
                      >
                        <div className="text-xs font-medium mb-0.5">{day.dayName}</div>
                        <div className="text-sm font-semibold">
                          {day.dayNumber}
                        </div>
                        
                        {/* Today indicator */}
                        {day.isToday && (
                          <div className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${
                            day.isSelected ? 'bg-white' : 'bg-emerald-500'
                          }`} />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Web: Fixed 7-day view with arrows
            <div className="flex items-center px-4 py-3 md:px-6 md:py-2">
              {/* Left Arrow */}
              <button
                onClick={() => navigateDate(-1)}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 mr-2 md:mr-3 backdrop-blur-sm border border-white/20"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>

              {/* Date Carousel */}
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-center space-x-1 md:space-x-2">
                  {generateHorizontalCalendarDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {/* Web Month Separator */}
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 md:mx-2 relative h-full">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg md:rounded-xl px-1.5 md:px-2 py-2 md:py-3 shadow-sm border border-white/20">
                            <div 
                              className="text-xs font-bold text-gray-600 tracking-wider"
                              style={{ 
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                letterSpacing: '2px'
                              }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Web Date Button */}
                      <button
                        onClick={() => !day.isFuture && setSelectedDate(day.date)}
                        disabled={day.isFuture}
                        className={`
                          w-12 h-12 md:w-16 md:h-16 text-center rounded-lg md:rounded-2xl transition-all duration-300 relative backdrop-blur-sm border
                          ${day.isSelected 
                            ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300' 
                            : day.isToday && !day.isSelected
                              ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                              : day.isFuture
                                ? 'text-gray-300 cursor-not-allowed bg-white/10 border-white/10'
                                : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20'
                          }
                        `}
                      >
                        <div className="text-xs font-medium mb-0.5 md:mb-1">{day.dayName}</div>
                        <div className="text-sm md:text-lg font-semibold">
                          {day.dayNumber}
                        </div>
                        
                        {/* Today indicator */}
                        {day.isToday && (
                          <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mx-auto mt-0.5 md:mt-1 ${
                            day.isSelected ? 'bg-white' : 'bg-emerald-500'
                          }`} />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Right Arrow */}
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
      </div>

      {/* Inline Calendar with Slide Animation */}
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
                        ${day.isSelected
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
                      
                      {/* Today indicator dot */}
                      {day.isToday && !day.isSelected && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-4 md:pb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-20 px-4 md:px-6">
            <div className="backdrop-blur-xl bg-white/30 rounded-2xl md:rounded-3xl p-8 md:p-12 border border-white/30 shadow-2xl">
              <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-emerald-300 border-t-emerald-600 mb-4 md:mb-6 mx-auto"></div>
              <p className="text-gray-700 font-semibold text-lg md:text-xl text-center">Loading nutrition data...</p>
              <p className="text-gray-600 text-sm mt-2 text-center">Please wait</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 md:py-20 px-4 md:px-6">
            <div className="backdrop-blur-xl bg-white/30 rounded-2xl md:rounded-3xl p-8 md:p-12 border border-white/30 shadow-2xl">
              <div className="text-5xl md:text-7xl mb-4 md:mb-6">😔</div>
              <div className="text-red-600 mb-3 md:mb-4 text-lg md:text-xl font-semibold">{error}</div>
              <button
                onClick={() => fetchDayAnalyses(selectedDate)}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 shadow-xl font-semibold backdrop-blur-sm border border-white/20"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Nutrition Overview - Single Row Macronutrients */}
            <div className="px-3 md:px-4 mt-3 md:mt-5 mb-4">
              <div className="w-full max-w-md mx-auto bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100 p-4 md:p-5">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Calories Eaten</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">
                      {dailyStats.totalCalories || 0}
                      <span className="text-xs md:text-sm font-normal text-gray-500"> / 2100 kcal</span>
                    </p>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs md:text-sm font-medium text-emerald-700">On Track</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200/70 rounded-full h-2 mb-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, ((dailyStats.totalCalories || 0) / 2100) * 100)}%`
                    }}
                  ></div>
                </div>

                {/* Macronutrients - Single Row */}
                <div className="flex justify-between items-center gap-2">
                  {/* Protein */}
                  <div className="flex-1 p-2 rounded-lg bg-blue-50 flex flex-col items-center">
                    <Beef className="w-4 h-4 text-blue-600 mb-0.5" />
                    <p className="text-[10px] font-semibold text-blue-600">Protein</p>
                    <p className="text-sm font-bold text-gray-900">{Math.round(dailyStats.totalProtein) || 0}g</p>
                    <p className="text-[10px] text-gray-500">of 131g</p>
                  </div>

                  {/* Carbs */}
                  <div className="flex-1 p-2 rounded-lg bg-orange-50 flex flex-col items-center">
                    <Wheat className="w-4 h-4 text-orange-600 mb-0.5" />
                    <p className="text-[10px] font-semibold text-orange-600">Carbs</p>
                    <p className="text-sm font-bold text-gray-900">{Math.round(dailyStats.totalCarbs) || 0}g</p>
                    <p className="text-[10px] text-gray-500">of 263g</p>
                  </div>

                  {/* Fat */}
                  <div className="flex-1 p-2 rounded-lg bg-yellow-50 flex flex-col items-center">
                    <Droplet className="w-4 h-4 text-yellow-600 mb-0.5" />
                    <p className="text-[10px] font-semibold text-yellow-600">Fat</p>
                    <p className="text-sm font-bold text-gray-900">{Math.round(dailyStats.totalFat) || 0}g</p>
                    <p className="text-[10px] text-gray-500">of 70g</p>
                  </div>

                  {/* Fiber */}
                  <div className="flex-1 p-2 rounded-lg bg-green-50 flex flex-col items-center">
                    <Leaf className="w-4 h-4 text-green-600 mb-0.5" />
                    <p className="text-[10px] font-semibold text-green-600">Fiber</p>
                    <p className="text-sm font-bold text-gray-900">{Math.round(dailyStats.totalFiber) || 0}g</p>
                    <p className="text-[10px] text-gray-500">of 30g</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Meals Section */}
            <div className="px-4 md:px-6 space-y-4">
              {dailyStats.mealCount === 0 ? (
                <div className="text-center py-16 px-6 backdrop-blur-xl bg-white/30 rounded-2xl shadow-lg border border-white/40">
                  <div className="text-6xl mb-4">🥗</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No Meals Logged</h3>
                  <p className="text-gray-600 max-w-xs mx-auto">
                    Use the camera to snap a photo of your food and see your nutrition insights here.
                  </p>
                </div>
              ) : (
                <>
                  {['breakfast', 'morning-snack', 'lunch', 'evening-snack', 'dinner', 'late-night'].map(category => {
                    const meals = groupedMeals[category] || [];
                    if (meals.length === 0) return null;

                    const categoryInfo = getMealCategoryInfo(category);
                    const categoryCalories = meals.reduce((sum, meal) => {
                      const foodData = parseAnalysisData(meal.AnalysisData);
                      return sum + (foodData.nutrition.calories || meal.TotalCalories || 0);
                    }, 0);

                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-3 px-2">
                          <div className="flex items-center space-x-3">
                            {/* <span className="text-2xl">{categoryInfo.icon}</span> */}
                            <div>
                              <h3 className="text-lg font-semibold text-gray-800">{categoryInfo.name}</h3>
                              <p className="text-sm text-gray-500">{formatTimeRangeAMPM(categoryInfo.timeRange)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-gray-800">{Math.round(categoryCalories)}</p>
                            <p className="text-xs text-gray-500">kcal</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {meals
                            .slice() // copy to avoid mutating original
                            .sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt))
                            .map((meal) => {
                            const foodData = parseAnalysisData(meal.AnalysisData);
                            const mealTime = new Date(meal.CreatedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                            const calories = foodData.nutrition.calories || meal.TotalCalories || 0;

                            return (
                              <div
                                key={meal.ID}
                                className="bg-white/60 backdrop-blur-md rounded-xl p-4 flex items-center space-x-4 shadow-sm border border-gray-200/80 hover:shadow-md hover:border-gray-300 transition-all duration-300 cursor-pointer"
                                onClick={() => setSelectedMeal(meal)}
                              >
                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                  {meal.ImageBase64 && meal.ImageBase64.trim() !== '' ? (
                                    <img
                                      src={meal.ImageBase64.startsWith('data:image') ? meal.ImageBase64 : `data:image/jpeg;base64,${meal.ImageBase64}`}
                                      alt={foodData.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : meal.ImagePath ? (
                                    <img
                                      src={meal.ImagePath}
                                      alt={foodData.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <span className="text-2xl">🍽️</span>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-800 truncate">{foodData.name}</h4>
                                  <p className="text-sm text-gray-500">{mealTime}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-lg text-gray-800">{Math.round(calories)}</p>
                                  <p className="text-xs text-gray-500 -mt-1">kcal</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detailed Meal Modal - Inspired by Image 2 */}
      {/* Modern Meal Modal - Card Style Overlay */}
      {selectedMeal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className={`bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transition-transform duration-300 ease-in-out ${
              isClosingModal ? 'animate-slideDown' : 'animate-slideUp'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const foodData = parseAnalysisData(selectedMeal.AnalysisData);
              const mealTime = new Date(selectedMeal.CreatedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });

              const calories = foodData.nutrition.calories || selectedMeal.TotalCalories || 0;
              const protein = foodData.nutrition.protein || selectedMeal.TotalProtein || 0;
              const carbs = foodData.nutrition.carbs || selectedMeal.TotalCarbs || 0;
              const fat = foodData.nutrition.fat || selectedMeal.TotalFat || 0;
              const fiber = foodData.nutrition.fiber || selectedMeal.TotalFiber || 0;

              return (
                <div className="relative max-h-[80vh] flex flex-col">
                  {/* Image with Gradient and Text Overlay */}
                  <div className="relative">
                    {selectedMeal.ImageBase64 && selectedMeal.ImageBase64.trim() !== '' ? (
                      <img
                        src={selectedMeal.ImageBase64.startsWith('data:image') ? selectedMeal.ImageBase64 : `data:image/jpeg;base64,${selectedMeal.ImageBase64}`}
                        alt={foodData.name}
                        className="w-full h-72 object-cover"
                        onError={(e) => {
                          e.target.src =
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=880&q=80';
                        }}
                      />
                    ) : selectedMeal.ImagePath ? (
                      <img
                        src={selectedMeal.ImagePath}
                        alt={foodData.name}
                        className="w-full h-72 object-cover"
                        onError={(e) => {
                          e.target.src =
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=880&q=80';
                        }}
                      />
                    ) : (
                      <div className="w-full h-72 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <svg
                          className="w-12 h-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Darker & Taller Bottom Gradient Overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 space-y-3">
                      {/* Title + Calories */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="text-xl font-bold text-white leading-tight">{foodData.name}</h2>
                          <p className="text-xs text-white/70 mt-0.5">Logged at {mealTime}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-bold text-white">{Math.round(calories)}</span>
                          <span className="text-xs text-white/70 ml-1">kcal</span>
                        </div>
                      </div>

                      {/* Nutrition Pills - Matched Style */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {/* Protein */}
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Beef className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">{Math.round(protein)}g</span>
                        </div>

                        {/* Carbs */}
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Wheat className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">{Math.round(carbs)}g</span>
                        </div>

                        {/* Fat */}
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Droplet className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">{Math.round(fat)}g</span>
                        </div>

                        {/* Fiber */}
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <svg
                            className="w-4 h-4 text-white mr-1.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          <span className="text-xs font-medium text-white">{Math.round(fiber)}g</span>
                        </div>
                      </div>
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={handleCloseModal}
                      className="absolute top-4 right-4 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all duration-200 border border-white/20"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Content Section */}
                  <div className="p-4 overflow-y-auto">
                    {foodData.detailedItems?.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-900 text-sm flex items-center">
                          <svg
                            className="w-5 h-5 text-gray-500 mr-1.5 inline-flex align-middle translate-y-[2px] translate-x-[2px]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v1a2 2 0 002 2h2m0-8v8m0-8h2a2 2 0 012 2v1a2 2 0 01-2 2H9m-4 0v6a2 2 0 002 2h2a2 2 0 002-2V9.5"
                            />
                          </svg>
                          Food Items
                        </h3>

                        <div className="space-y-2">
                          {foodData.detailedItems.map((item, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-100 hover:bg-gray-100 transition-colors duration-200"
                            >
                              <div>
                                <p className="font-medium text-gray-900 text-sm inline">{item.name}</p>
                                <p className="text-xs text-gray-500 inline ml-2">{item.portion || 'N/A'}</p>
                                {/* Macronutrients row */}
                                {item.nutrition && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <span className="text-gray-900">Protein</span> {Math.round(item.nutrition.protein || 0)}g
                                    {' · '}
                                    <span className="text-gray-900">Carbs</span> {Math.round(item.nutrition.carbs || 0)}g
                                    {' · '}
                                    <span className="text-gray-900">Fiber</span> {Math.round(item.nutrition.fiber || 0)}g
                                    {' · '}
                                    <span className="text-gray-900">Fat</span> {Math.round(item.nutrition.fat || 0)}g
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-900 text-sm">
                                  {Math.round(item.nutrition?.calories || 0)}
                                </p>
                                <p className="text-xs text-gray-500">kcal</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <div className="p-4 pt-0">
                    <button
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-500 text-white text-sm font-medium px-4 py-2 
                                shadow-sm hover:bg-red-600 hover:shadow-md active:scale-95 transition-all duration-200"
                      onClick={async () => {
                        if (!selectedMeal?.ID) return;
                        
                        try {
                          const res = await fetch(`${apiBaseUrl}/api/delete-background-analysis`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: selectedMeal.ID })
                          });
                          const data = await res.json();
                          if (data.success) {
                            // Remove from UI
                            setAnalyses(prev => prev.filter(m => m.ID !== selectedMeal.ID));
                            setSelectedMeal(null);
                          } else {
                            alert(data.message || 'Failed to delete.');
                          }
                        } catch (err) {
                          alert('Failed to delete. Please try again.');
                        }
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 
                            1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionDashboard;
