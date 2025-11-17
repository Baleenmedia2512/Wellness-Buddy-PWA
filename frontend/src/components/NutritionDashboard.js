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

const UNDO_SECONDS = 10; // cooldown duration

const NutritionDashboard = ({ user, onBack, apiBaseUrl, onMealDelete, hideHeader, selectedDate: propSelectedDate, setSelectedDate: propSetSelectedDate }) => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Use parent's selectedDate if provided, otherwise use local state
  const [localSelectedDate, setLocalSelectedDate] = useState(new Date());
  const selectedDate = propSelectedDate || localSelectedDate;
  const setSelectedDate = propSetSelectedDate || setLocalSelectedDate;
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
              body: JSON.stringify({ email: user.email })
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

  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setSelectedMeal(null);
      setIsClosingModal(false);
    }, 300);
  };

  // Parent: pass this to <MealCard onDelete={...} />
  const handleOptimisticDelete = async (mealToDelete) => {
    const n = parseAnalysisData(mealToDelete.AnalysisData).nutrition || {};
    const deltas = {
      calories: -(n.calories || mealToDelete.TotalCalories || 0),
      protein:  -(n.protein  || mealToDelete.TotalProtein  || 0),
      carbs:    -(n.carbs    || mealToDelete.TotalCarbs    || 0),
      fat:      -(n.fat      || mealToDelete.TotalFat      || 0),
      fiber:    -(n.fiber    || mealToDelete.TotalFiber    || 0),
      mealCountDelta: -1,
    };

    const placeholder = {
      ID: `undo-${mealToDelete.ID}`,
      isUndoPlaceholder: true,
      CreatedAt: mealToDelete.CreatedAt,
    };

    // Replace in place (critical for no flicker / no “floating delete”)
    setAnalyses(prev => {
      const idx = prev.findIndex(m => m.ID === mealToDelete.ID);
      if (idx === -1) return prev;
      const next = prev.slice();
      next.splice(idx, 1, placeholder);
      return next;
    });

    setUndoState(prev => ({
      ...prev,
      [placeholder.ID]: {
        originalMeal: mealToDelete,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
        ttlSeconds: UNDO_SECONDS,
      }
    }));

    applyDailyDelta(deltas);

    try {
      const res = await fetch(`${apiBaseUrl}/api/delete-background-analysis`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mealToDelete.ID }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Delete failed');
      if (onMealDelete) onMealDelete(mealToDelete.ID);
    } catch (err) {
      // Rollback on failure
      setAnalyses(prev => {
        const idx = prev.findIndex(m => m.ID === placeholder.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, mealToDelete);
        return next;
      });
      setUndoState(prev => {
        const next = { ...prev };
        delete next[placeholder.ID];
        return next;
      });
      applyDailyDelta({
        calories: -deltas.calories,
        protein:  -deltas.protein,
        carbs:    -deltas.carbs,
        fat:      -deltas.fat,
        fiber:    -deltas.fiber,
        mealCountDelta: -deltas.mealCountDelta,
      });
      alert(err.message || 'Failed to delete. Please try again.');
    }
  };

  const parseAnalysisData = (analysisData, moreTextColor = "text-gray-500") => {
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
        return (
          <>
            {first}{' '}
            <span className={`${moreTextColor} text-sm font-normal`}>
              + {others} more
            </span>
          </>
        );
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

      {/* Header - Only show if not hidden */}
      {!hideHeader && (
        <>
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
        </>
      )}

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
  {(() => {
    // NEW: decide empty vs list based on *actual* items and placeholders
    const hasUndoPlaceholders = analyses.some(a => a.isUndoPlaceholder);
    const hasRealMeals = analyses.some(a => !a.isUndoPlaceholder);

    if (!hasRealMeals && !hasUndoPlaceholders) {
      return (
        <div className="text-center py-16 px-6 backdrop-blur-xl bg-white/30 rounded-2xl shadow-lg border border-white/40">
          <div className="text-6xl mb-4">🥗</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Meals Logged</h3>
          <p className="text-gray-600 max-w-xs mx-auto">
            Use the camera to snap a photo of your food and see your nutrition insights here.
          </p>
        </div>
      );
    }

    return (
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
                    // Show undo row if this is a placeholder
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

                    // Regular meal card
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
                        onDelete={handleOptimisticDelete}
                        onClick={(mealObj) => setSelectedMeal(mealObj)}
                      />
                    );
                  })}
              </div>
            </div>
          );
        })}
      </>
    );
  })()}
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
              // Use white for '+ {others} more' in modal
              const foodData = parseAnalysisData(selectedMeal.AnalysisData, "text-white");
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
                          <Leaf className="w-4 h-4 text-white mr-1.5" />
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

                  {/* Delete with in-button loading + create Undo placeholder (OPTIMISTIC) */}
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

                        // Capture the meal reference immediately (modal will close)
                        const meal = selectedMeal;
                        setDeletingId(meal.ID);

                        // Compute nutrition deltas for instant feedback
                        const n = parseAnalysisData(meal.AnalysisData).nutrition || {};
                        const deltas = {
                          calories: -(n.calories || meal.TotalCalories || 0),
                          protein:  -(n.protein  || meal.TotalProtein  || 0),
                          carbs:    -(n.carbs    || meal.TotalCarbs    || 0),
                          fat:      -(n.fat      || meal.TotalFat      || 0),
                          fiber:    -(n.fiber    || meal.TotalFiber    || 0),
                          mealCountDelta: -1
                        };

                        // Build placeholder that sorts in the same slot
                        const placeholder = {
                          ID: `undo-${meal.ID}`,
                          isUndoPlaceholder: true,
                          CreatedAt: meal.CreatedAt
                        };

                        // --- OPTIMISTIC UI ---
                        // Replace the meal in-place with the placeholder (no flicker/snap-back)
                        setAnalyses(prev => {
                          const idx = prev.findIndex(m => m.ID === meal.ID);
                          if (idx === -1) {
                            // Fallback: remove then append placeholder
                            return prev.filter(m => m.ID !== meal.ID).concat(placeholder);
                          }
                          const next = prev.slice();
                          next.splice(idx, 1, placeholder);
                          return next;
                        });

                        // Start undo countdown
                        setUndoState(prev => ({
                          ...prev,
                          [placeholder.ID]: {
                            originalMeal: meal,
                            expiresAt: Date.now() + UNDO_SECONDS * 1000, // absolute expiry
                            ttlSeconds: UNDO_SECONDS
                          }
                        }));

                        // Update totals immediately
                        applyDailyDelta(deltas);

                        // Close modal immediately for a snappy feel
                        setSelectedMeal(null);

                        // --- Server call; rollback if it fails ---
                        try {
                          const res = await fetch(`${apiBaseUrl}/api/delete-background-analysis`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: meal.ID })
                          });
                          const data = await res.json();
                          if (!data.success) throw new Error(data.message || 'Failed to delete.');
                          if (onMealDelete) onMealDelete(meal.ID);
                        } catch (err) {
                          // Rollback: remove placeholder, restore meal in-place, reverse deltas
                          setAnalyses(prev => {
                            const idx = prev.findIndex(m => m.ID === placeholder.ID);
                            if (idx === -1) return prev; // nothing to rollback
                            const next = prev.slice();
                            next.splice(idx, 1, meal);
                            return next;
                          });

                          setUndoState(prev => {
                            const next = { ...prev };
                            delete next[placeholder.ID];
                            return next;
                          });

                          applyDailyDelta({
                            calories: -deltas.calories,
                            protein:  -deltas.protein,
                            carbs:    -deltas.carbs,
                            fat:      -deltas.fat,
                            fiber:    -deltas.fiber,
                            mealCountDelta: -deltas.mealCountDelta
                          });

                          alert(err.message || 'Failed to delete. Please try again.');
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

// --- MealCard with creative, minimal swipe-left to delete (progress bar) ---
const SWIPE_DELETE_THRESHOLD = 140;  // px
const SWIPE_MAX = 140;               // px

const MealCard = ({ meal, foodData, mealTime, calories, onDelete, onClick }) => {
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [animating, setAnimating] = React.useState(false);
  const [armed, setArmed] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false); // NEW: card is exiting
  const [deletedOnce, setDeletedOnce] = React.useState(false); // NEW: guard

  const startXRef = React.useRef(0);
  const rafRef    = React.useRef(null);
  const elRef     = React.useRef(null);

  const cancelRAF = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const onPointerDown = (e) => {
    if (!e.isPrimary || leaving) return;
    cancelRAF();
    setDragging(true);
    setAnimating(false);
    startXRef.current = e.clientX;
    elRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !e.isPrimary || leaving) return;
    const delta = e.clientX - startXRef.current;
    const nextDx = Math.max(Math.min(delta, 0), -SWIPE_MAX);
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDx(nextDx);
        rafRef.current = null;
        const isNowArmed = Math.abs(nextDx) >= SWIPE_DELETE_THRESHOLD;
        if (isNowArmed !== armed) {
          setArmed(isNowArmed);
          if (isNowArmed && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(10); } catch {}
          }
        }
      });
    }
  };

  const finishInteraction = (e) => {
    if (!dragging) return;
    setDragging(false);
    cancelRAF();
    elRef.current?.releasePointerCapture?.(e?.pointerId);

    if (Math.abs(dx) >= SWIPE_DELETE_THRESHOLD) {
      if (deletedOnce) return;         // guard against double fire
      setDeletedOnce(true);
      setLeaving(true);                // lock input & visuals
      setAnimating(true);

      // Slide out and let parent replace with placeholder immediately
      requestAnimationFrame(() => {
        setDx(-window.innerWidth);
        setTimeout(() => {
          onDelete(meal);              // optimistic replace (in-place)
          // Do NOT reset dx or animating; this component will unmount next render.
        }, 180); // exit timing tuned for snap-free feel
      });

      return;
    }

    // Not past threshold: snap back
    setAnimating(true);
    requestAnimationFrame(() => {
      setDx(0);
      setTimeout(() => {
        setAnimating(false);
        setArmed(false);
      }, 220);
    });
  };

  const onPointerUp = (e) => finishInteraction(e);
  const onPointerCancel = (e) => finishInteraction(e);
  const onPointerLeave = (e) => finishInteraction(e);

  React.useEffect(() => () => cancelRAF(), []);

  const progress = Math.min(1, Math.abs(dx) / SWIPE_DELETE_THRESHOLD);
  const scale = leaving ? 1 : 1 - Math.min(0.03, Math.abs(dx) / 1000);

  return (
    // Keep a fixed height so layout doesn’t jump while swapping for placeholder
    <div className="relative w-full" style={{ touchAction: 'pan-y', height: 84 }}>
      {/* Background delete reveal (only visible while dragging, never after unmount) */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: progress,
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style={{
              transform: `rotate(${armed ? 10 : 0}deg)`,
              transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)',
              strokeWidth: armed ? 2.2 : 2,
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Foreground card */}
      <div
        ref={elRef}
        role="button"
        aria-label={`${foodData.name}, ${Math.round(calories)} kilocalories`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (leaving) return;
          if (e.key === 'Backspace' || e.key === 'Delete') finishInteraction(e); // go through same flow
          if (e.key === 'Enter') onClick(meal);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onClick={() => {
          if (!dragging && Math.abs(dx) < 5 && !leaving) onClick(meal);
        }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl select-none cursor-pointer overflow-hidden
          ${leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${dx}px) scale(${scale})`,
          transition: animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1), box-shadow 180ms ease' : 'none',
          minHeight: 76,
          willChange: 'transform',
          boxShadow: `
            0 10px 30px -10px rgba(0,0,0,${progress * 0.15 + 0.05}),
            inset 0 0 0 1px rgba(0,0,0,0.05)
          `,
        }}
      >
        {/* Bottom progress bar (feedback while swiping) */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{
            width: `${progress * 100}%`,
            transition: dragging ? 'none' : 'width 180ms ease',
            opacity: progress > 0 ? 1 : 0,
          }}
        />

        <div className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            {meal.ImageBase64 && meal.ImageBase64.trim() !== '' ? (
              <img
                src={meal.ImageBase64.startsWith('data:image') ? meal.ImageBase64 : `data:image/jpeg;base64,${meal.ImageBase64}`}
                alt={foodData.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : meal.ImagePath ? (
              <img
                src={meal.ImagePath}
                alt={foodData.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span className="text-2xl">🍽️</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">{foodData.name}</h4>
            <p className="text-sm text-gray-500">{mealTime}</p>
          </div>

          <div className="text-right">
            <p className="font-bold text-lg text-gray-900">{Math.round(calories)}</p>
            <p className="text-[11px] text-gray-500 -mt-0.5 tracking-wide">kcal</p>
          </div>
        </div>
      </div>
    </div>
  );
};
