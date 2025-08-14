import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Leaf,
  Beef,
  Wheat,
  Droplet,
  RotateCcw
} from 'lucide-react';
import DatePickerCalendar from './DatePickerCalendar';

const UNDO_SECONDS = 10; // cooldown duration

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

  // delete button state
  const [deletingId, setDeletingId] = useState(null);

  // undo placeholders: key -> { originalMeal, expiresAt }
  const [undoState, setUndoState] = useState({});
  const [undoing, setUndoing] = useState(false);

  /* ---------------- Helpers ---------------- */

  const getMealCategory = (timeString) => {
    const hour = new Date(timeString).getHours();
    if (hour >= 5 && hour < 10) return 'breakfast';
    if (hour >= 10 && hour < 12) return 'morning-snack';
    if (hour >= 12 && hour < 16) return 'lunch';
    if (hour >= 16 && hour < 18) return 'evening-snack';
    if (hour >= 18 && hour < 23) return 'dinner';
    return 'late-night';
  };

  const formatTimeAMPM = (hour, minute = 0) => {
    const d = new Date();
    d.setHours(hour);
    d.setMinutes(minute);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getMealCategoryInfo = (category) => {
    const categories = {
      'breakfast': { name: 'Breakfast', timeRange: { start: { h: 5, m: 0 }, end: { h: 10, m: 0 } } },
      'morning-snack': { name: 'Morning Snack', timeRange: { start: { h: 10, m: 0 }, end: { h: 12, m: 0 } } },
      'lunch': { name: 'Lunch', timeRange: { start: { h: 12, m: 0 }, end: { h: 16, m: 0 } } },
      'evening-snack': { name: 'Evening Snack', timeRange: { start: { h: 16, m: 0 }, end: { h: 18, m: 0 } } },
      'dinner': { name: 'Dinner', timeRange: { start: { h: 18, m: 0 }, end: { h: 23, m: 0 } } },
      'late-night': { name: 'Late Night', timeRange: { start: { h: 23, m: 0 }, end: { h: 5, m: 0 } } }
    };
    return categories[category] || categories['late-night'];
  };

  const formatTimeRangeAMPM = (range) =>
    range ? `${formatTimeAMPM(range.start.h, range.start.m)} - ${formatTimeAMPM(range.end.h, range.end.m)}` : '';

  const isMobileDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

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
    setShowCalendar(false);
  }, [selectedDate]);

  const fetchDayAnalyses = useCallback(
    async (date) => {
      setLoading(true);
      setError(null);

      const calculateDailyStats = (dayAnalyses) => {
        const stats = dayAnalyses.reduce(
          (acc, analysis) => {
            if (analysis.isUndoPlaceholder) return acc;
            const foodData = parseAnalysisData(analysis.AnalysisData);
            const n = foodData.nutrition || {};
            const calories = n.calories || analysis.TotalCalories || 0;
            const protein = n.protein || analysis.TotalProtein || 0;
            const carbs = n.carbs || analysis.TotalCarbs || 0;
            const fat = n.fat || analysis.TotalFat || 0;
            const fiber = n.fiber || analysis.TotalFiber || 0;
            return {
              totalCalories: acc.totalCalories + calories,
              totalProtein: acc.totalProtein + protein,
              totalCarbs: acc.totalCarbs + carbs,
              totalFat: acc.totalFat + fat,
              totalFiber: acc.totalFiber + fiber,
              mealCount: acc.mealCount + 1
            };
          },
          {
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            totalFiber: 0,
            mealCount: 0
          }
        );
        setDailyStats(stats);
      };

      try {
        let actualUserId = user.id;
        if (!actualUserId && user.uid) {
          try {
            const lookupResponse = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email, firebaseUid: user.uid })
            });
            const lookupData = await lookupResponse.json();
            if (lookupData.success && lookupData.userId) actualUserId = lookupData.userId;
            else {
              setError('User account not found in database. Please contact support.');
              return;
            }
          } catch {
            setError('Failed to lookup user account. Please try again.');
            return;
          }
        }
        if (!actualUserId) {
          setError('Unable to determine user account. Please try logging in again.');
          return;
        }

        const dateString = date.toISOString().split('T')[0];
        const response = await fetch(
          `${apiBaseUrl}/api/user-nutrition-stats?userId=${actualUserId}&date=${dateString}&detailed=true`
        );
        const data = await response.json();

        if (data.success) {
          const list = data.data || [];
          setAnalyses(list);
          calculateDailyStats(list);
        } else {
          setError('Failed to load nutrition data');
        }
      } catch (err) {
        setError('Failed to load nutrition data. Please check your connection.');
      } finally {
        setLoading(false);
      }
    },
    [user, apiBaseUrl]
  );

  useEffect(() => {
    if (user) fetchDayAnalyses(selectedDate);
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
    if (newDate <= new Date()) setSelectedDate(newDate);
  };

  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setSelectedMeal(null);
      setIsClosingModal(false);
    }, 300);
  };

  const parseAnalysisData = (analysisData) => {
    try {
      const parsed = typeof analysisData === 'string' ? JSON.parse(analysisData) : analysisData;

      // Helper: user-friendly title from foods[]
      const formatFoodsTitle = (foods = []) => {
        const count = foods.length || 0;
        if (count === 0) return 'Unknown Food';

        const first = (foods[0]?.name || 'Unknown Food').trim();
        if (count === 1) return first;

        // For 2 items: "First & Second"
        if (count === 2) {
          const second = (foods[1]?.name || 'another item').trim();
          return `${first} & ${second}`;
        }

        // For 3+ items: "First & other {count-1} item(s)"
        const others = count - 1;
        return `${first} + ${others} more`;
      };

      // Unified format: foods[] + total
      if (parsed?.foods?.length > 0 && parsed?.total) {
        return {
          name: formatFoodsTitle(parsed.foods),
          nutrition: {
            calories: parsed.total.calories || 0,
            protein:  parsed.total.protein  || 0,
            carbs:    parsed.total.carbs    || 0,
            fat:      parsed.total.fat      || 0,
            fiber:    parsed.total.fiber    || 0,
          },
          detailedItems: parsed.foods || [],
        };
      }

      // Legacy manual: category + nutrition
      if (parsed?.category?.name) {
        return {
          name: parsed.category.name,
          nutrition: parsed.nutrition || {},
          detailedItems: parsed.detailedItems || [],
        };
      }

      // Legacy background: foods[] without total
      if (parsed?.foods?.length > 0) {
        const firstFood = parsed.foods[0] || {};
        return {
          name: formatFoodsTitle(parsed.foods),
          nutrition: firstFood.nutrition || {},
          detailedItems: parsed.foods || [],
        };
      }

      return { name: 'Unknown Food', nutrition: {}, detailedItems: [] };
    } catch {
      return { name: 'Error parsing data', nutrition: {}, detailedItems: [] };
    }
  };

  const applyDailyDelta = ({
    calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, mealCountDelta = 0
  }) => {
    setDailyStats((prev) => ({
      totalCalories: Math.max(0, prev.totalCalories + calories),
      totalProtein: Math.max(0, prev.totalProtein + protein),
      totalCarbs: Math.max(0, prev.totalCarbs + carbs),
      totalFat: Math.max(0, prev.totalFat + fat),
      totalFiber: Math.max(0, prev.totalFiber + fiber),
      mealCount: Math.max(0, prev.mealCount + mealCountDelta)
    }));
  };

  // group by meal bucket (placeholders included, but ignored in totals)
  const groupedMeals = analyses.reduce((groups, analysis) => {
    const category = getMealCategory(analysis.CreatedAt);
    if (!groups[category]) groups[category] = [];
    groups[category].push(analysis);
    return groups;
  }, {});

const UndoRow = ({ pid, originalMeal, expiresAt, ttlSeconds = UNDO_SECONDS }) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

  // 1) Text refresh only (does not affect bar animation)
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // 2) Freeze animation config at mount (stable across re-renders)
  const { total, delayAtMount } = React.useMemo(() => {
    const total = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - total * 1000;
    const elapsedAtMount = Math.min(total, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total, delayAtMount: -elapsedAtMount }; // negative delay
  }, [expiresAt, ttlSeconds]);

  // 3) Expire precisely at expiresAt, independent of CSS
  useEffect(() => {
    const msLeft = Math.max(0, expiresAt - Date.now());
    const t = setTimeout(() => {
      // remove placeholder + state
      setAnalyses(prev => prev.filter(a => a.ID !== pid));
      setUndoState(prev => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
    }, msLeft);
    return () => clearTimeout(t);
  }, [expiresAt, pid, setAnalyses, setUndoState]);

  const foodName = parseAnalysisData(originalMeal.AnalysisData).name || 'Food';
  const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);

  return (
    <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm">
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed</span> “{foodName}”
        </p>
        <p className="text-[11px] text-amber-700/80">Undo available for {remainingSecs}s</p>
      </div>

      {/* --- Undo button (unchanged from your latest) --- */}
      <button
        disabled={undoing}
        onClick={async () => {
          if (undoing) return;
          const entry = undoState[pid];
          const orig = entry?.originalMeal;
          if (!orig) return;

          setUndoing(true);

          // Optimistic restore
          setAnalyses(prev => prev.filter(a => a.ID !== pid).concat(orig));
          const n = parseAnalysisData(orig.AnalysisData).nutrition || {};
          applyDailyDelta({
            calories: +(n.calories || orig.TotalCalories || 0),
            protein:  +(n.protein  || orig.TotalProtein  || 0),
            carbs:    +(n.carbs    || orig.TotalCarbs    || 0),
            fat:      +(n.fat      || orig.TotalFat      || 0),
            fiber:    +(n.fiber    || orig.TotalFiber    || 0),
            mealCountDelta: +1
          });
          setUndoState(prev => { const nxt = { ...prev }; delete nxt[pid]; return nxt; });

          try {
            // NOTE: make sure this path matches your backend filename.
            const resp = await fetch(`${apiBaseUrl}/api/undo-deleted-analysis`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: orig.ID, userId: user?.id })
            });
            const data = await resp.json();
            if (!data.success) throw new Error(data.message || 'Undo failed');
          } catch (err) {
            // Revert optimistic
            setAnalyses(prev =>
              prev.filter(a => a.ID !== orig.ID).concat({ ID: pid, isUndoPlaceholder: true, CreatedAt: orig.CreatedAt })
            );
            applyDailyDelta({
              calories: -(n.calories || orig.TotalCalories || 0),
              protein:  -(n.protein  || orig.TotalProtein  || 0),
              carbs:    -(n.carbs    || orig.TotalCarbs    || 0),
              fat:      -(n.fat      || orig.TotalFat      || 0),
              fiber:    -(n.fiber    || orig.TotalFiber    || 0),
              mealCountDelta: -1
            });
            // Restore undo state with the same expiry (keeps bar in sync)
            setUndoState(prev => ({ ...prev, [pid]: { originalMeal: orig, expiresAt, ttlSeconds } }));
          } finally {
            setUndoing(false);
          }
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium
          ${undoing ? 'text-amber-500 bg-amber-50 cursor-not-allowed' : 'text-amber-800 hover:bg-amber-100/60 active:scale-95 transition'}`}
      >
        {undoing ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            Restoring…
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4" />
            Undo
          </>
        )}
      </button>

      {/* Smooth cooldown bar (stable; no re-starting on re-renders) */}
      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200/70 overflow-hidden rounded-b-xl">
        <span
          key={pid} /* ensure a fresh mount per placeholder */
          className="block h-full bg-amber-600 origin-left will-change-transform"
          style={{
            transformOrigin: 'left',
            animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards`
          }}
        />
      </span>
    </div>
  );
};


  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* keyframes (once) */}
      <style>{`@keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>

      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-br from-orange-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          <div className="flex items-center justify-between p-4 md:p-6">
            <button onClick={onBack} className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>

            <div className="text-center">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">Nutrition</h1>
              <p className="text-sm text-gray-600">{formatDateHeader(selectedDate)}</p>
            </div>

            <button onClick={() => setShowCalendar(!showCalendar)} className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors">
              <Calendar className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Date selector */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {isMobileDevice() ? (
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
      </div>

      {/* Inline calendar (unchanged) */}
      {/* ... your existing inline calendar block remains unchanged ... */}

      {/* Content */}
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-4 md:pb-6">
        {loading ? (
          /* loading state ... (unchanged) */
          <div className="flex flex-col items-center justify-center py-12 md:py-20 px-4 md:px-6">
            <div className="backdrop-blur-xl bg-white/30 rounded-2xl md:rounded-3xl p-8 md:p-12 border border-white/30 shadow-2xl">
              <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-emerald-300 border-t-emerald-600 mb-4 md:mb-6 mx-auto"></div>
              <p className="text-gray-700 font-semibold text-lg md:text-xl text-center">Loading nutrition data...</p>
              <p className="text-gray-600 text-sm mt-2 text-center">Please wait</p>
            </div>
          </div>
        ) : error ? (
          /* error state ... (unchanged) */
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
            {/* Overview card ... (unchanged content) */}
            <div className="px-3 md:px-4 mt-3 md:mt-5 mb-4">
              <div className="w-full max-w-md mx-auto bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100 p-4 md:p-5">
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

                <div className="w-full bg-gray-200/70 rounded-full h-2 mb-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(100, ((dailyStats.totalCalories || 0) / 2100) * 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center gap-2">
                  <div className="flex-1 p-2 rounded-lg bg-blue-50 flex flex-col items-center">
                    <Beef className="w-4 h-4 text-blue-600 mb-0.5" />
                    <p className="text-[10px] font-semibold text-blue-600">Protein</p>
                    <p className="text-sm font-bold text-gray-900">{Math.round(dailyStats.totalProtein) || 0}g</p>
                    <p className="text-[10px] text-gray-500">of 131g</p>
                  </div>
                  <div className="flex-1 p-2 rounded-lg bg-orange-50 flex flex-col items-center">
                    <Wheat className="w-4 h-4 text-orange-600 mb-0.5" />
                    <p className="text-[10px] font-semibold text-orange-600">Carbs</p>
                    <p className="text-sm font-bold text-gray-900">{Math.round(dailyStats.totalCarbs) || 0}g</p>
                    <p className="text-[10px] text-gray-500">of 263g</p>
                  </div>
                  <div className="flex-1 p-2 rounded-lg bg-yellow-50 flex flex-col items-center">
                    <Droplet className="w-4 h-4 text-yellow-600 mb-0.5" />
                    <p className="text-[10px] font-semibold text-yellow-600">Fat</p>
                    <p className="text-sm font-bold text-gray-900">{Math.round(dailyStats.totalFat) || 0}g</p>
                    <p className="text-[10px] text-gray-500">of 70g</p>
                  </div>
                  <div className="flex-1 p-2 rounded-lg bg-green-50 flex flex-col items-center">
                    <Leaf className="w-4 h-4 text-green-600 mb-0.5" />
                    <p className="text-[10px] font-semibold text-green-600">Fiber</p>
                    <p className="text-sm font-bold text-gray-900">{Math.round(dailyStats.totalFiber) || 0}g</p>
                    <p className="text-[10px] text-gray-500">of 30g</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Meals */}
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
                  {['breakfast', 'morning-snack', 'lunch', 'evening-snack', 'dinner', 'late-night'].map((category) => {
                    const meals = groupedMeals[category] || [];
                    if (meals.length === 0) return null;

                    const categoryInfo = getMealCategoryInfo(category);
                    const categoryCalories = meals.reduce((sum, meal) => {
                      if (meal.isUndoPlaceholder) return sum;
                      const foodData = parseAnalysisData(meal.AnalysisData);
                      return sum + (foodData.nutrition.calories || meal.TotalCalories || 0);
                    }, 0);

                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-3 px-2">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800">{categoryInfo.name}</h3>
                            <p className="text-sm text-gray-500">{formatTimeRangeAMPM(categoryInfo.timeRange)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-gray-800">{Math.round(categoryCalories)}</p>
                            <p className="text-xs text-gray-500">kcal</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {meals
                            .slice()
                            .sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt))
                            .map((meal) => {
                              if (meal.isUndoPlaceholder) {
                                const entry = undoState[meal.ID];
                                if (!entry) return null;
                                return (
                                  <UndoRow
                                    key={meal.ID}
                                    pid={meal.ID}
                                    originalMeal={entry.originalMeal}
                                    expiresAt={entry.expiresAt}
                                    ttlSeconds={entry.ttlSeconds ?? UNDO_SECONDS}
                                  />
                                );
                              }
                              const foodData = parseAnalysisData(meal.AnalysisData);
                              const mealTime = new Date(meal.CreatedAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                              const calories = foodData.nutrition.calories || meal.TotalCalories || 0;
                              return (
                                <MealCard
                                  key={meal.ID}
                                  meal={meal}
                                  foodData={foodData}
                                  mealTime={mealTime}
                                  calories={calories}
                                  onDelete={async (mealToDelete) => {
                                    setDeletingId(mealToDelete.ID);
                                    try {
                                      const res = await fetch(`${apiBaseUrl}/api/delete-background-analysis`, {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: mealToDelete.ID })
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        const n = parseAnalysisData(mealToDelete.AnalysisData).nutrition || {};
                                        applyDailyDelta({
                                          calories: -(n.calories || mealToDelete.TotalCalories || 0),
                                          protein: -(n.protein || mealToDelete.TotalProtein || 0),
                                          carbs: -(n.carbs || mealToDelete.TotalCarbs || 0),
                                          fat: -(n.fat || mealToDelete.TotalFat || 0),
                                          fiber: -(n.fiber || mealToDelete.TotalFiber || 0),
                                          mealCountDelta: -1
                                        });
                                        const placeholder = {
                                          ID: `undo-${mealToDelete.ID}`,
                                          isUndoPlaceholder: true,
                                          CreatedAt: mealToDelete.CreatedAt
                                        };
                                        setAnalyses((prev) => prev.filter((m) => m.ID !== mealToDelete.ID).concat(placeholder));
                                        setUndoState((prev) => ({
                                          ...prev,
                                          [placeholder.ID]: {
                                            originalMeal: mealToDelete,
                                            expiresAt: Date.now() + UNDO_SECONDS * 1000,
                                            ttlSeconds: UNDO_SECONDS
                                          }
                                        }));
                                      } else {
                                        alert(data.message || 'Failed to delete.');
                                      }
                                    } catch {
                                      alert('Failed to delete. Please try again.');
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                  onClick={(mealObj) => setSelectedMeal(mealObj)}
                                />
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

      {/* Modal */}
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
                minute: '2-digit'
              });

              const calories = foodData.nutrition.calories || selectedMeal.TotalCalories || 0;
              const protein = foodData.nutrition.protein || selectedMeal.TotalProtein || 0;
              const carbs = foodData.nutrition.carbs || selectedMeal.TotalCarbs || 0;
              const fat = foodData.nutrition.fat || selectedMeal.TotalFat || 0;
              const fiber = foodData.nutrition.fiber || selectedMeal.TotalFiber || 0;

              return (
                <div className="relative max-h-[80vh] flex flex-col">
                  {/* Image header */}
                  <div className="relative">
                    {selectedMeal.ImageBase64 && selectedMeal.ImageBase64.trim() !== '' ? (
                      <img
                        src={
                          selectedMeal.ImageBase64.startsWith('data:image')
                            ? selectedMeal.ImageBase64
                            : `data:image/jpeg;base64,${selectedMeal.ImageBase64}`
                        }
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
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 space-y-3">
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

                      <div className="flex flex-wrap gap-2 pt-1">
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Beef className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">{Math.round(protein)}g</span>
                        </div>
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Wheat className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">{Math.round(carbs)}g</span>
                        </div>
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Droplet className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">{Math.round(fat)}g</span>
                        </div>
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <svg className="w-4 h-4 text-white mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-xs font-medium text-white">{Math.round(fiber)}g</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCloseModal}
                      className="absolute top-4 right-4 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all duration-200 border border-white/20"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Details list (unchanged) */}
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
                                {item.nutrition && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <span className="text-gray-900">Protein</span> {Math.round(item.nutrition.protein || 0)}g ·{' '}
                                    <span className="text-gray-900">Carbs</span> {Math.round(item.nutrition.carbs || 0)}g ·{' '}
                                    <span className="text-gray-900">Fiber</span> {Math.round(item.nutrition.fiber || 0)}g ·{' '}
                                    <span className="text-gray-900">Fat</span> {Math.round(item.nutrition.fat || 0)}g
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-900 text-sm">{Math.round(item.nutrition?.calories || 0)}</p>
                                <p className="text-xs text-gray-500">kcal</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delete with in-button loading + create Undo placeholder */}
                  <div className="p-4 pt-0">
                    <button
                      disabled={deletingId === selectedMeal?.ID}
                      className={`w-full flex items-center justify-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2 shadow-sm transition-all duration-200 ${
                        deletingId === selectedMeal?.ID
                          ? 'bg-red-400 cursor-not-allowed'
                          : 'bg-red-500 hover:bg-red-600 hover:shadow-md active:scale-95'
                      }`}
                      onClick={async () => {
                        if (!selectedMeal?.ID) return;
                        setDeletingId(selectedMeal.ID);

                        try {
                          const res = await fetch(`${apiBaseUrl}/api/delete-background-analysis`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: selectedMeal.ID })
                          });
                          const data = await res.json();

                          if (data.success) {
                            // subtract totals now
                            const n = parseAnalysisData(selectedMeal.AnalysisData).nutrition || {};
                            applyDailyDelta({
                              calories: -(n.calories || selectedMeal.TotalCalories || 0),
                              protein: -(n.protein || selectedMeal.TotalProtein || 0),
                              carbs: -(n.carbs || selectedMeal.TotalCarbs || 0),
                              fat: -(n.fat || selectedMeal.TotalFat || 0),
                              fiber: -(n.fiber || selectedMeal.TotalFiber || 0),
                              mealCountDelta: -1
                            });

                            // placeholder at same time position
                            const placeholder = {
                              ID: `undo-${selectedMeal.ID}`,
                              isUndoPlaceholder: true,
                              CreatedAt: selectedMeal.CreatedAt
                            };

                            setAnalyses((prev) => prev.filter((m) => m.ID !== selectedMeal.ID).concat(placeholder));
                            setUndoState((prev) => ({
                              ...prev,
                              [placeholder.ID]: {
                                originalMeal: selectedMeal,
                                expiresAt: Date.now() + UNDO_SECONDS * 1000, // absolute expiry
                                ttlSeconds: UNDO_SECONDS
                              }
                            }));

                            setSelectedMeal(null); // close modal
                          } else {
                            alert(data.message || 'Failed to delete.');
                          }
                        } catch {
                          alert('Failed to delete. Please try again.');
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                    >
                      {deletingId === selectedMeal?.ID ? (
                        <>
                          <span className="inline-block h-4 w-4 rounded-full border-2 border-white/70 border-t-white animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 
                                1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Delete
                        </>
                      )}
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

// --- MealCard with improved swipe-to-delete UI ---
const SWIPE_DELETE_THRESHOLD = 100; // px
const SWIPE_MAX = 120; // px

const MealCard = ({ meal, foodData, mealTime, calories, onDelete, onClick }) => {
  const [swipeX, setSwipeX] = React.useState(0);
  const [isSwiping, setIsSwiping] = React.useState(false);
  const [animating, setAnimating] = React.useState(false);
  const touchStartX = React.useRef(0);
  const touchCurrentX = React.useRef(0);

  // Touch handlers
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsSwiping(true);
    setAnimating(false);
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    if (!isSwiping || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx < 0) {
      setSwipeX(Math.max(dx, -SWIPE_MAX));
      touchCurrentX.current = e.touches[0].clientX;
    }
  };
  const handleTouchEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);
    if (swipeX < -SWIPE_DELETE_THRESHOLD) {
      // Animate out, then delete
      setSwipeX(-window.innerWidth); // slide out
      setAnimating(true);
      setTimeout(() => {
        onDelete(meal);
        setSwipeX(0);
        setAnimating(false);
      }, 250);
    } else {
      // Snap back
      setSwipeX(0);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 250);
    }
  };

  // Delete area width
  const DELETE_WIDTH = 88; // px, matches your screenshot

  // Calculate progress for animations
  const progress = Math.min(1, Math.abs(swipeX) / SWIPE_DELETE_THRESHOLD);
  const isNearThreshold = Math.abs(swipeX) > SWIPE_DELETE_THRESHOLD * 0.8;

  return (
    <div className="relative w-full" style={{ touchAction: 'pan-y', height: 80 }}>
      {/* Enhanced Delete background */}
      <div
        className="absolute top-0 right-0 h-full flex items-center justify-center z-0 overflow-hidden"
        style={{
          width: DELETE_WIDTH,
          background: isNearThreshold 
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))' 
            : 'linear-gradient(135deg, rgba(244, 67, 54, 0.85), rgba(211, 47, 47, 0.85))',
          borderRadius: '0 1rem 1rem 0',
          transition: isSwiping ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: Math.min(1, Math.abs(swipeX) / (SWIPE_DELETE_THRESHOLD * 0.6)),
          transform: `scale(${0.95 + progress * 0.05})`,
          boxShadow: progress > 0.5 
            ? `inset 0 0 20px rgba(255, 255, 255, ${0.1 + progress * 0.1})` 
            : 'none'
        }}
      >
        {/* Animated background pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
            transform: `scale(${0.8 + progress * 0.4}) rotate(${progress * 45}deg)`,
            transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
          }}
        />
        
        {/* Delete icon with enhanced animation */}
        <div 
          className="relative z-10"
          style={{
            transform: `scale(${0.9 + progress * 0.2}) rotate(${isNearThreshold ? '5deg' : '0deg'})`,
            transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <svg 
            className="w-8 h-8 text-white drop-shadow-lg" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            style={{
              filter: isNearThreshold 
                ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))' 
                : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
              strokeWidth: isNearThreshold ? 2.5 : 2
            }}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
            />
          </svg>
        </div>

        {/* Pulsing effect when near threshold */}
        {isNearThreshold && (
          <div 
            className="absolute inset-0 rounded-r-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              animation: 'pulse 0.8s infinite alternate',
              animationTimingFunction: 'ease-in-out'
            }}
          />
        )}

        {/* Progress indicator dots */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-white"
              style={{
                opacity: progress > (i * 0.33) ? 0.8 : 0.3,
                transform: `scale(${progress > (i * 0.33) ? 1.2 : 0.8})`,
                transition: 'all 0.2s ease-out'
              }}
            />
          ))}
        </div>
      </div>

      {/* Card (unchanged) */}
      <div
        className={
          `relative bg-white/60 backdrop-blur-md rounded-xl p-4 flex items-center space-x-4 shadow-lg border border-gray-200/80 hover:shadow-xl hover:border-gray-300 transition-all duration-300 cursor-pointer z-10 select-none ` +
          (animating ? 'transition-transform duration-300' : '')
        }
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: animating ? 'transform 0.25s cubic-bezier(.4,1.4,.6,1)' : undefined,
          minHeight: 72,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => !isSwiping && onClick(meal)}
      >
        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
          {meal.ImageBase64 && meal.ImageBase64.trim() !== '' ? (
            <img
              src={
                meal.ImageBase64.startsWith('data:image')
                  ? meal.ImageBase64
                  : `data:image/jpeg;base64,${meal.ImageBase64}`
              }
              alt={foodData.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : meal.ImagePath ? (
            <img
              src={meal.ImagePath}
              alt={foodData.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
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

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.2; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};