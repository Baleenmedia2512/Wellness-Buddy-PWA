import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Footprints, Flame, TrendingUp, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, LabelList, ReferenceLine, ResponsiveContainer
} from 'recharts';
import { fetchDailyActivity } from '../services/dailyActivityService';
import LoadingSpinner from './LoadingSpinner';
import TouchFeedbackButton from './TouchFeedbackButton';

const CALORIES_PER_STEP = 0.04;
const STEP_GOAL = 10000;
const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ACTIVITY_TYPE = 'walking';

const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const calcCalories = (steps) => Number((steps * CALORIES_PER_STEP).toFixed(2));

const formatDate = (date) =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const isToday = (date) => toDateKey(date) === toDateKey();
const isSmallChartDevice = () =>
  typeof window !== 'undefined' && window.innerWidth < 380;

const StepsDashboard = ({ user, selectedDate: propDate, setSelectedDate: propSetDate }) => {
  const [loading, setLoading] = useState(true);
  const [dailyHistory, setDailyHistory] = useState([]);
  const [internalDate, setInternalDate] = useState(new Date());
  const selectedDate = propDate ?? internalDate;
  const setSelectedDate = propSetDate ?? setInternalDate;
  const isControlled = propDate !== undefined;
  const [activePanel, setActivePanel] = useState('summary'); // 'summary' | 'trend'
  const [trendDays, setTrendDays] = useState(7);
  const [panelHeight, setPanelHeight] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showContent, setShowContent] = useState(false);
  const summaryRef = useRef(null);
  const trendRef = useRef(null);

  const userId = user?.id || user?.userId;

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetchDailyActivity(userId, 30, ACTIVITY_TYPE, toDateKey());
      const trend = response.trend || response.data;
      if (response.success && Array.isArray(trend)) {
        setDailyHistory(trend.map(d => ({ ...d, calories: d.caloriesBurned ?? d.calories ?? 0 })));
      }
    } catch (err) {
      console.error('[StepsDashboard] Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Sync panel height when panel or data changes
  useEffect(() => {
    const ref = activePanel === 'summary' ? summaryRef : trendRef;
    if (ref.current) setPanelHeight(ref.current.scrollHeight);
  }, [activePanel, dailyHistory, trendDays]);

  // Selected date entry
  const selectedKey = toDateKey(selectedDate);
  const selectedEntry = dailyHistory.find(d => d.date === selectedKey);
  const displaySteps = selectedEntry?.steps || 0;
  const displayCalories = selectedEntry?.calories || calcCalories(displaySteps);
  const stepProgress = Math.min(displaySteps / STEP_GOAL, 1);
  const ringOffset = RING_CIRCUMFERENCE * (1 - stepProgress);

  // Trend data: build a complete day-by-day range so missing dates still render at zero.
  const trendData = useMemo(() => {
    const historyByDate = new Map(dailyHistory.map((entry) => [entry.date, entry]));

    return Array.from({ length: trendDays }, (_, index) => {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() - (trendDays - 1 - index));
      const dateKey = toDateKey(date);
      const entry = historyByDate.get(dateKey);
      const steps = entry?.steps ?? 0;

      return {
        key: dateKey,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        steps,
        hasData: steps > 0,
      };
    });
  }, [dailyHistory, selectedDate, trendDays]);

  const stepsWithData = trendData.filter(d => d.hasData);
  const avgSteps = stepsWithData.length
    ? Math.round(stepsWithData.reduce((s, d) => s + d.steps, 0) / stepsWithData.length)
    : 0;
  const bestDay = stepsWithData.reduce((best, d) => (!best || d.steps > best.steps ? d : best), null);
  const daysHitGoal = stepsWithData.filter(d => d.steps >= STEP_GOAL).length;

  const trendChartData = useMemo(() => {
    const total = trendData.length;
    if (total === 0) return [];
    if (trendDays <= 7) return trendData;

    const targetCount = 7;
    if (total <= targetCount) return trendData;

    // Always include today (last), then evenly space backwards
    const sampledIndices = [];
    sampledIndices.push(total - 1); // Always include today
    const step = (total - 1) / (targetCount - 1);
    for (let i = 1; i < targetCount - 1; i++) {
      sampledIndices.push(Math.round(i * step));
    }
    sampledIndices.push(0); // Always include oldest.

    return Array.from(new Set(sampledIndices))
      .sort((a, b) => a - b)
      .map((idx) => trendData[idx]);
  }, [trendData, trendDays]);

  const visibleStepDotIndices = useMemo(() => {
    const total = trendChartData.length;
    if (total === 0) return new Set();
    return new Set(Array.from({ length: total }, (_, i) => i));
  }, [trendChartData]);

  const visibleStepTickLabels = useMemo(
    () => Array.from(visibleStepDotIndices).sort((a, b) => a - b).map(i => trendChartData[i]?.label).filter(Boolean),
    [trendChartData, visibleStepDotIndices]
  );

  const renderStepPointLabel = useCallback(
    ({ x, y, index }) => {
      if (x === undefined || y === undefined || index === undefined) return null;
      if (!visibleStepDotIndices.has(index)) return null;
      const point = trendChartData[index];
      if (!point) return null;
      const text = point.hasData
        ? point.steps >= 1000 ? `${(point.steps / 1000).toFixed(1)}k` : `${point.steps}`
        : '0';
      const labelFontSize = isSmallChartDevice() ? 7 : 9;
      const labelY = y - (isSmallChartDevice() ? 8 : 11);
      return (
        <text x={x} y={labelY} textAnchor="middle" fill="#9ca3af" fontSize={labelFontSize} fontWeight={500}>
          {text}
        </text>
      );
    },
    [trendChartData, visibleStepDotIndices]
  );

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction);
    if (newDate <= new Date()) setSelectedDate(newDate);
  };

  const isMobileDevice = () =>
    typeof window !== 'undefined' && window.innerWidth < 768;

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
        isNewMonth,
      });
    }
    return dates;
  };

  const generateHorizontalCalendarDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -2; i <= 3; i++) {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() + i);
      const prevDate = i > -2 ? new Date(selectedDate) : null;
      if (prevDate) prevDate.setDate(selectedDate.getDate() + (i - 1));
      const isNewMonth = i === -2 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: date > today,
        isNewMonth,
      });
    }
    return dates;
  };

  useEffect(() => {
    let scrollTimer;
    let contentTimer;

    if (!loading && isMobileDevice()) {
      scrollTimer = setTimeout(() => {
        const scrollableDates = generateScrollableDates();
        const selectedIndex = scrollableDates.findIndex(
          (d) => d.date.toDateString() === selectedDate.toDateString()
        );
        console.log('[StepsDashboard] Scroll attempt - selectedIndex:', selectedIndex, 'isMobile:', isMobileDevice());
        if (selectedIndex !== -1) {
          const el = document.querySelector(`[data-steps-date-index="${selectedIndex}"]`);
          console.log('[StepsDashboard] Found element:', !!el, 'at index', selectedIndex);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 300);
    }

    setShowCalendar(false);
    setShowContent(false);
    contentTimer = setTimeout(() => setShowContent(true), 50);

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      if (contentTimer) clearTimeout(contentTimer);
    };
  }, [selectedDate, loading]);

  if (loading) return <LoadingSpinner context="steps" />;

  return (
    <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl px-3 md:px-4 pt-3 md:pt-5 pb-8 space-y-4">

      {/* ── Date Navigation ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm rounded-2xl">
        {!isControlled && (
          <div className="flex items-center justify-between px-4 pt-2 pb-0">
            <span className="text-xs font-medium text-gray-500">{formatDate(selectedDate)}</span>
            <button
              onClick={() => { setShowCalendar(!showCalendar); setCalendarMonth(new Date(selectedDate)); }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Open calendar"
            >
              <Calendar className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        )}
        <div className="w-full">
          {isMobileDevice() ? (
            <div className="px-4 py-3">
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`div::-webkit-scrollbar { display: none; }`}</style>
                <div className="flex space-x-2 pb-1" style={{ minWidth: 'max-content' }}>
                  {generateScrollableDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 relative">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg px-1.5 py-1.5 shadow-sm border border-white/20">
                            <div className="text-xs font-semibold text-gray-600"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: '9px', letterSpacing: '1px' }}
                            >{day.monthName.toUpperCase()}</div>
                          </div>
                        </div>
                      )}
                      <button
                        data-steps-date-index={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`flex-shrink-0 w-12 text-center py-2 px-1 rounded-lg transition-all duration-300 relative backdrop-blur-sm border ${
                          day.isSelected
                            ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300'
                            : day.isToday
                            ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                            : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20'
                        }`}
                      >
                        <div className="text-xs font-medium mb-0.5">{day.dayName}</div>
                        <div className="text-sm font-semibold">{day.dayNumber}</div>
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
                  {generateHorizontalCalendarDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 md:mx-2 relative h-full">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg md:rounded-xl px-1.5 md:px-2 py-2 md:py-3 shadow-sm border border-white/20">
                            <div className="text-xs font-bold text-gray-600 tracking-wider"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '2px' }}
                            >{day.monthName.toUpperCase()}</div>
                          </div>
                        </div>
                      )}
                      <TouchFeedbackButton
                        onClick={() => !day.isFuture && setSelectedDate(day.date)}
                        disabled={day.isFuture}
                        className={`w-12 h-12 md:w-16 md:h-16 text-center rounded-lg md:rounded-2xl transition-all duration-300 relative backdrop-blur-sm border ${
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
                        <div className="text-xs font-medium mb-0.5 md:mb-1">{day.dayName}</div>
                        <div className="text-sm md:text-lg font-semibold">{day.dayNumber}</div>
                        {day.isToday && (
                          <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mx-auto mt-0.5 md:mt-1 ${
                            day.isSelected ? 'bg-white' : 'bg-emerald-500'
                          }`} />
                        )}
                      </TouchFeedbackButton>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <TouchFeedbackButton
                onClick={() => navigateDate(1)}
                disabled={(() => { const n = new Date(selectedDate); n.setDate(selectedDate.getDate() + 1); return n > new Date(); })()}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 ml-2 md:ml-3 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20"
                ariaLabel="Next day"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </TouchFeedbackButton>
            </div>
          )}
        </div>
      </div>

      {/* ── Inline Calendar ── */}
      {!isControlled && (
      <div className={`bg-white shadow-sm overflow-hidden transition-all duration-300 ease-in-out rounded-2xl ${
        showCalendar ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className={`max-w-md mx-auto p-0 md:p-4 transform transition-transform duration-300 ease-in-out ${
          showCalendar ? 'translate-y-0' : '-translate-y-4'
        }`}>
          <div className="bg-white rounded-2xl border-0 md:border md:border-gray-100">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <TouchFeedbackButton
                onClick={() => { const p = new Date(calendarMonth); p.setMonth(p.getMonth() - 1); setCalendarMonth(p); }}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                ariaLabel="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </TouchFeedbackButton>
              <h3 className="text-lg font-semibold text-gray-900">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <TouchFeedbackButton
                onClick={() => { const n = new Date(calendarMonth); n.setMonth(n.getMonth() + 1); setCalendarMonth(n); }}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                ariaLabel="Next month"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </TouchFeedbackButton>
            </div>
            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-1 px-4 pt-4 pb-2">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-sm font-semibold text-gray-500 py-2">{d}</div>
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
                  days.push({ date: prevDate, dayNumber: prevDate.getDate(), isCurrentMonth: false, isToday: prevDate.toDateString() === today.toDateString(), isSelected: prevDate.toDateString() === selectedDate.toDateString(), isFuture: prevDate > today });
                }
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = new Date(year, month, day);
                  days.push({ date, dayNumber: day, isCurrentMonth: true, isToday: date.toDateString() === today.toDateString(), isSelected: date.toDateString() === selectedDate.toDateString(), isFuture: date > today });
                }
                const remainingCells = 42 - days.length;
                for (let day = 1; day <= remainingCells; day++) {
                  const nextDate = new Date(year, month + 1, day);
                  days.push({ date: nextDate, dayNumber: day, isCurrentMonth: false, isToday: nextDate.toDateString() === today.toDateString(), isSelected: nextDate.toDateString() === selectedDate.toDateString(), isFuture: nextDate > today });
                }
                return days.map((day, index) => {
                  const isDisabled = day.isFuture;
                  return (
                    <TouchFeedbackButton
                      key={index}
                      onClick={() => { if (!isDisabled) { setSelectedDate(day.date); setShowCalendar(false); } }}
                      disabled={isDisabled}
                      className={`aspect-square p-2 text-sm font-medium rounded-lg transition-all duration-200 relative ${
                        day.isSelected
                          ? 'bg-emerald-500 text-white shadow-lg transform scale-105'
                          : day.isToday && !day.isSelected
                          ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300 font-bold'
                          : day.isCurrentMonth
                          ? isDisabled ? 'text-gray-400 cursor-not-allowed opacity-50' : 'text-gray-700 hover:bg-emerald-50 hover:scale-105'
                          : isDisabled ? 'text-gray-300 cursor-not-allowed opacity-30' : 'text-gray-400 hover:bg-emerald-50 hover:scale-105'
                      }`}
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
      )}

      {/* ── Summary / Trend Card ── */}
      <div className={`w-full bg-white/70 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100 overflow-hidden transition-all duration-500 ease-out ${
        showContent ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
      }`}>

        {/* Toggle header */}
        <div className="px-4 md:px-5 pt-4 pb-2 flex items-center justify-between">
          <p className="text-xs md:text-sm text-gray-500">
            {activePanel === 'summary' ? 'Daily Summary' : `Step Trend (${trendDays}D)`}
          </p>
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => setActivePanel('summary')}
              className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                activePanel === 'summary' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
              }`}
            >Summary</button>
            <button
              type="button"
              onClick={() => setActivePanel('trend')}
              className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                activePanel === 'trend' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
              }`}
            >Trend</button>
          </div>
        </div>

        {/* Sliding panels */}
        <div
          className="overflow-hidden transition-[height] duration-400 ease-out"
          style={panelHeight ? { height: `${panelHeight}px` } : undefined}
        >
          <div
            className="flex items-start w-[200%] transition-transform duration-500 ease-out"
            style={{ transform: activePanel === 'summary' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            {/* ── Summary Panel ── */}
            <div ref={summaryRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-5">
              <div className="flex flex-col items-center mt-2">
                {/* Ring */}
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 mb-3">
                  <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                    <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="12" />
                    <circle
                      cx="100" cy="100" r={RING_RADIUS} fill="none"
                      stroke="url(#stepsDashGrad)" strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
                      className="transition-all duration-700 ease-out"
                    />
                    <defs>
                      <linearGradient id="stepsDashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Footprints className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 mb-0.5" />
                    <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-none">
                      {displaySteps.toLocaleString()}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 font-medium">
                      / {STEP_GOAL.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{Math.round(stepProgress * 100)}% of goal</span>
                    <span>{(STEP_GOAL - displaySteps > 0 ? STEP_GOAL - displaySteps : 0).toLocaleString()} steps left</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(stepProgress * 100)}%` }}
                    />
                  </div>
                  {stepProgress >= 1 && (
                    <p className="text-xs text-emerald-600 font-semibold text-center mt-1">🎉 Goal reached!</p>
                  )}
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <Footprints className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-1" />
                    <p className="text-base sm:text-lg font-bold text-emerald-900">{displaySteps.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Steps</p>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3 text-center">
                    <Flame className="w-3.5 h-3.5 text-rose-500 mx-auto mb-1" />
                    <p className="text-base sm:text-lg font-bold text-rose-900">{displayCalories}</p>
                    <p className="text-[10px] text-rose-500 font-medium">Calories</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Trend Panel ── */}
            <div ref={trendRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-5">
              {/* Trend range selector */}
              <div className="flex items-center justify-between mt-2 mb-3">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Step Trend</p>
                  <p className="text-sm md:text-base font-semibold text-gray-900">Last {trendDays} days</p>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                  {[7, 14, 30].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTrendDays(n)}
                      className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                        trendDays === n ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
                      }`}
                    >{n}D</button>
                  ))}
                </div>
              </div>

              {/* Mini stat chips */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                  <p className="text-[10px] text-emerald-700">Average</p>
                  <p className="text-xs font-semibold text-emerald-900">{avgSteps.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] text-slate-600">Best Day</p>
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {bestDay ? bestDay.steps.toLocaleString() : '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-teal-50 px-2 py-1.5">
                  <p className="text-[10px] text-teal-700">Goal Days</p>
                  <p className="text-xs font-semibold text-teal-900">{daysHitGoal}/{trendDays}</p>
                </div>
              </div>

              {/* Line Chart */}
              {trendChartData.length === 0 ? (
                <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-400">
                  No trend data available
                </div>
              ) : (
                <>
                  <div className="w-full h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ top: 30, right: 22, left: 0, bottom: 12 }}>
                        <XAxis
                          dataKey="label"
                          interval={0}
                          ticks={visibleStepTickLabels}
                          padding={{ left: 6, right: 12 }}
                          minTickGap={0}
                          tick={{ fontSize: isSmallChartDevice() ? 8 : 10, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          width={34}
                          tick={{ fontSize: isSmallChartDevice() ? 8 : 10, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                          domain={[0, 'auto']}
                          tickCount={6}
                        />
                        <ReferenceLine
                          y={STEP_GOAL}
                          stroke="#9ca3af"
                          strokeDasharray="5 5"
                          ifOverflow="extendDomain"
                        />
                        <Line
                          type="linear"
                          dataKey="steps"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={({ cx, cy, index, payload }) => {
                            if (cx === undefined || cy === undefined || !visibleStepDotIndices.has(index)) return null;
                            if (!payload) return null;
                            return (
                              <circle
                                key={`step-dot-${payload.key || index}`}
                                cx={cx}
                                cy={cy}
                                r={isSmallChartDevice() ? 3 : 4}
                                fill="#10b981"
                              />
                            );
                          }}
                          activeDot={false}
                          isAnimationActive={false}
                        >
                          <LabelList dataKey="steps" content={renderStepPointLabel} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                    <span>Goal: {STEP_GOAL.toLocaleString()} steps</span>
                    <span>Avg: {avgSteps.toLocaleString()} steps</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="pb-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActivePanel('summary')}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              activePanel === 'summary' ? 'w-6 bg-emerald-500' : 'w-2.5 bg-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={() => setActivePanel('trend')}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              activePanel === 'trend' ? 'w-6 bg-emerald-500' : 'w-2.5 bg-gray-300'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default StepsDashboard;
