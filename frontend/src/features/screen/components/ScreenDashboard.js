import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone, Clock, TrendingUp, ChevronLeft, ChevronRight, Calendar, RefreshCw, ThumbsUp, Ban } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, LabelList, ReferenceLine, ResponsiveContainer
} from 'recharts';
import {
  fetchScreenTimeHistory,
  formatScreenTime,
  getScreenTimePermissionStatus,
  getTodayScreenTime,
  saveScreenTime,
  backfillMissingScreenTimeDays
} from '../services/screenTimeService';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

const SCREEN_TIME_LIMIT = 2 * 3600; // 2-hour daily limit in seconds.
const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isSmallChartDevice = () =>
  typeof window !== 'undefined' && window.innerWidth < 380;

const GOOD_APP_KEYWORDS = [
  'healthifyme', 'myfitnesspal', 'yazio', 'lose it', 'cronometer', 'fatsecret', 'myplate',
  'lifesum', 'macros', 'nutrition', 'calorie', 'diet', 'food diary', 'fitness', 'workout',
  'gym', 'yoga', 'meditation', 'strava', 'nike', 'duolingo', 'coursera', 'udemy', 'khan',
  'learning', 'study', 'books', 'gmail', 'outlook', 'teams', 'slack', 'zoom', 'meet',
  'docs', 'sheets', 'notion', 'todoist', 'calendar', 'maps', 'clock', 'notes', 'drive',
  'linkedin', 'whatsapp', 'chatgpt'
];

const BAD_APP_KEYWORDS = [
  'instagram', 'facebook', 'tiktok', 'snapchat', 'twitter', ' x ', 'youtube', 'netflix',
  'hotstar', 'disney', 'prime video', 'jiocinema', 'pubg', 'freefire', 'clash', 'roblox',
  'candy crush', 'game', 'reddit', 'pinterest', 'sharechat', 'moj', 'josh', 'reels'
];

const dedupeHistoryByDate = (rows = []) => Object.values(
  rows
    .filter((r) => r?.Date)
    .reduce((acc, r) => {
      const key = r.Date;
      const existing = acc[key];
      if (!existing || (r.TotalScreenTimeSeconds || 0) > (existing.TotalScreenTimeSeconds || 0)) {
        acc[key] = r;
      }
      return acc;
    }, {})
);

const ScreenDashboard = ({ user, selectedDate: propDate, setSelectedDate: propSetDate }) => {
  const isNative = Capacitor.isNativePlatform();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [todayDeviceSeconds, setTodayDeviceSeconds] = useState(null);
  const [todayAppUsage, setTodayAppUsage] = useState([]);
  const [avgSeconds, setAvgSeconds] = useState(0);
  const [activePanel, setActivePanel] = useState('summary'); // 'summary' | 'trend'
  const [trendDays, setTrendDays] = useState(7);
  const [panelHeight, setPanelHeight] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showContent, setShowContent] = useState(false);
  const summaryRef = useRef(null);
  const trendRef = useRef(null);
  const [internalDate, setInternalDate] = useState(new Date());
  const selectedDate = propDate ?? internalDate;
  const setSelectedDate = propSetDate ?? setInternalDate;
  const isControlled = propDate !== undefined;

  // Resolve DB user id consistently with ScreenTimePage to avoid dashboard/user-id mismatch.
  const [resolvedUserId, setResolvedUserId] = useState(() => {
    if (user?.id || user?.userId) return user?.id || user?.userId;
    const stored = localStorage.getItem('dbUserId');
    return stored ? Number(stored) : null;
  });

  // When the selected member changes (e.g. coach views another user), update resolvedUserId immediately.
  useEffect(() => {
    const incomingId = user?.id || user?.userId;
    if (incomingId) setResolvedUserId(incomingId);
  }, [user?.id, user?.userId]);

  // True when displaying someone else's data — must never save our device screen time to their account.
  const selfUserId = Number(localStorage.getItem('dbUserId'));
  const isViewingOther = !!(resolvedUserId && selfUserId && Number(resolvedUserId) !== selfUserId);

  useEffect(() => {
    if (resolvedUserId) return;
    let cancelled = false;

    const tryResolve = async () => {
      if (user?.id || user?.userId) {
        if (!cancelled) setResolvedUserId(user?.id || user?.userId);
        return true;
      }

      const stored = localStorage.getItem('dbUserId');
      if (stored) {
        if (!cancelled) setResolvedUserId(Number(stored));
        return true;
      }

      const email = localStorage.getItem('userEmail');
      if (email) {
        try {
          const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
          const res = await fetch(`${apiBaseUrl}/api/user/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (data.success && data.userId) {
            localStorage.setItem('dbUserId', String(data.userId));
            if (!cancelled) setResolvedUserId(data.userId);
            return true;
          }
        } catch (e) {
          console.warn('[ScreenDashboard] userId fallback failed:', e.message);
        }
      }

      return false;
    };

    tryResolve().then((ok) => {
      if (ok || cancelled) return;
      const interval = setInterval(() => {
        tryResolve().then((resolved) => {
          if (resolved) clearInterval(interval);
        });
      }, 1000);
      setTimeout(() => clearInterval(interval), 15000);
    });

    return () => {
      cancelled = true;
    };
  }, [user, resolvedUserId]);

  const loadHistory = useCallback(async ({ showLoader = true } = {}) => {
    if (!resolvedUserId) return;
    if (showLoader) setLoading(true);
    const selfId = Number(localStorage.getItem('dbUserId'));
    const viewingOther = !!(selfId && Number(resolvedUserId) !== selfId);
    try {
      // Only sync device data when viewing our own screen time — never save our data to another member.
      if (isNative && !viewingOther) {
        try {
          const status = await getScreenTimePermissionStatus();
          if (status.granted) {
            const deviceData = await getTodayScreenTime();
            if (typeof deviceData?.totalScreenTimeSeconds === 'number') {
              setTodayDeviceSeconds(Math.max(0, deviceData.totalScreenTimeSeconds));
              setTodayAppUsage(Array.isArray(deviceData?.appUsage) ? deviceData.appUsage : []);
              await saveScreenTime({
                userId: resolvedUserId,
                date: deviceData.date || toDateKey(),
                totalScreenTimeSeconds: Math.max(0, deviceData.totalScreenTimeSeconds)
              });
            }
          }
        } catch (err) {
          console.warn('[ScreenDashboard] Device sync skipped:', err?.message || err);
        }
      }

      const result = await fetchScreenTimeHistory(resolvedUserId, 30, toDateKey());
      if (result?.success && Array.isArray(result.data)) {
        const deduped = dedupeHistoryByDate(result.data).sort((a, b) => a.Date.localeCompare(b.Date));
        setHistoryData(deduped);

        // True 7-day average (includes zero for missing days).
        const byDate = new Map(deduped.map((r) => [r.Date, r.TotalScreenTimeSeconds || 0]));
        const last7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return byDate.get(toDateKey(d)) || 0;
        });
        setAvgSeconds(Math.round(last7.reduce((s, v) => s + v, 0) / 7));
      }
    } catch (err) {
      console.error('[ScreenDashboard] Failed to load history:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [resolvedUserId, isNative]);

  useEffect(() => {
    if (!isNative || !resolvedUserId || isViewingOther) return;
    backfillMissingScreenTimeDays(resolvedUserId)
      .catch((err) => console.warn('âš ï¸ [ScreenDashboard] Initial backfill skipped:', err?.message || err));
  }, [isNative, resolvedUserId, isViewingOther]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);
    try {
      await loadHistory({ showLoader: false });
    } finally {
      setRefreshing(false);
    }
  }, [loadHistory, refreshing]);

  const isToday = (date) => toDateKey(date) === toDateKey();

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction);
    if (newDate <= new Date()) setSelectedDate(newDate);
  };

  const isMobileDevice = () =>
    typeof window !== 'undefined' && window.innerWidth < 768;

  const formatTrendTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0m';
    if (!isMobileDevice()) return formatScreenTime(seconds);

    if (seconds >= 3600) {
      return `${Math.round(seconds / 3600)}h`;
    }
    return `${Math.round(seconds / 60)}m`;
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
    let scrollTimer, contentTimer;
    if (isMobileDevice()) {
      scrollTimer = setTimeout(() => {
        const scrollableDates = generateScrollableDates();
        const selectedIndex = scrollableDates.findIndex(
          (d) => d.date.toDateString() === selectedDate.toDateString()
        );
        console.log('[ScreenDashboard] Scroll attempt - selectedIndex:', selectedIndex, 'isMobile:', isMobileDevice());
        if (selectedIndex !== -1) {
          const el = document.querySelector(`[data-screen-date-index="${selectedIndex}"]`);
          console.log('[ScreenDashboard] Found element:', !!el, 'at index', selectedIndex);
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
  }, [selectedDate]);

  // Sync panel height when panel or data changes
  useEffect(() => {
    const ref = activePanel === 'summary' ? summaryRef : trendRef;
    if (ref.current) setPanelHeight(ref.current.scrollHeight);
  }, [activePanel, historyData, trendDays]);

  // Selected date stats
  const selectedRecord = historyData.find(r => r.Date === toDateKey(selectedDate));
  // Never use live device seconds when viewing another member — always use their DB value.
  const selectedSeconds = (isNative && isToday(selectedDate) && !isViewingOther && typeof todayDeviceSeconds === 'number')
    ? todayDeviceSeconds
    : (selectedRecord?.TotalScreenTimeSeconds || 0);

  const matchApp = (app, keywords) =>
    keywords.some(k => `${app?.appName || ''} ${app?.packageName || ''}`.toLowerCase().includes(k));
  const goodAppsSeconds = todayAppUsage
    .filter((a) => matchApp(a, GOOD_APP_KEYWORDS))
    .reduce((s, a) => s + (a.usageSeconds || 0), 0);
  const badAppsSeconds = todayAppUsage
    .filter((a) => matchApp(a, BAD_APP_KEYWORDS))
    .reduce((s, a) => s + (a.usageSeconds || 0), 0);

  // Per-app colored ring segments with label pointers (mirrors ScreenTimePage)
  const RING_APP_COLORS = ['#10b981','#f97316','#3b82f6','#a855f7','#f59e0b','#ec4899','#06b6d4','#84cc16'];
  const MAX_RING_APPS = 6;
  const appSegments = useMemo(() => {
    if (selectedSeconds === 0 || todayAppUsage.length === 0) return [];
    const usedArc = RING_CIRCUMFERENCE * Math.min(selectedSeconds / SCREEN_TIME_LIMIT, 1);
    const sorted = [...todayAppUsage]
      .filter(a => (a.usageSeconds || 0) >= 60)
      .sort((a, b) => (b.usageSeconds || 0) - (a.usageSeconds || 0));
    if (sorted.length === 0) return [];
    const topApps = sorted.slice(0, MAX_RING_APPS);
    const otherSecs = sorted.slice(MAX_RING_APPS).reduce((s, a) => s + (a.usageSeconds || 0), 0);
    const segments = [];
    let cumArc = 0;
    topApps.forEach((app, idx) => {
      const arc = usedArc * ((app.usageSeconds || 0) / selectedSeconds);
      if (arc < 3) return;
      const midAngle = (cumArc + arc / 2) / RING_CIRCUMFERENCE * 2 * Math.PI;
      const sinA = Math.sin(midAngle), cosA = Math.cos(midAngle);
      segments.push({
        color: RING_APP_COLORS[idx % RING_APP_COLORS.length],
        arc, dashoffset: -cumArc,
        lineX1: 100 + 87 * sinA, lineY1: 100 - 87 * cosA,
        lineX2: 100 + 102 * sinA, lineY2: 100 - 102 * cosA,
        textX: 100 + 113 * sinA, textY: 100 - 113 * cosA,
        textAnchor: sinA > 0.15 ? 'start' : sinA < -0.15 ? 'end' : 'middle',
        name: (app.appName || 'App').split(' ')[0].substring(0, 9),
      });
      cumArc += arc;
    });
    if (otherSecs >= 60) {
      const arc = usedArc * (otherSecs / selectedSeconds);
      if (arc >= 3) {
        const midAngle = (cumArc + arc / 2) / RING_CIRCUMFERENCE * 2 * Math.PI;
        const sinA = Math.sin(midAngle), cosA = Math.cos(midAngle);
        segments.push({
          color: '#9ca3af', arc, dashoffset: -cumArc,
          lineX1: 100 + 87 * sinA, lineY1: 100 - 87 * cosA,
          lineX2: 100 + 102 * sinA, lineY2: 100 - 102 * cosA,
          textX: 100 + 113 * sinA, textY: 100 - 113 * cosA,
          textAnchor: sinA > 0.15 ? 'start' : sinA < -0.15 ? 'end' : 'middle',
          name: 'Other',
        });
      }
    }
    // Spread overlapping labels on each side so they don't collide
    const MIN_GAP = 13;
    const spreadLabels = (items) => {
      if (items.length < 2) return;
      items.sort((a, b) => a.textY - b.textY);
      for (let i = 1; i < items.length; i++)
        if (items[i].textY - items[i - 1].textY < MIN_GAP) items[i].textY = items[i - 1].textY + MIN_GAP;
      for (let i = items.length - 2; i >= 0; i--)
        if (items[i + 1].textY - items[i].textY < MIN_GAP) items[i].textY = items[i + 1].textY - MIN_GAP;
    };
    spreadLabels(segments.filter(s => s.textX >= 100));
    spreadLabels(segments.filter(s => s.textX < 100));
    // Re-aim pointer lines after label positions may have shifted
    segments.forEach(s => {
      const dx = s.textX - s.lineX1, dy = s.textY - s.lineY1;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 8) { const t = (d - 6) / d; s.lineX2 = s.lineX1 + dx * t; s.lineY2 = s.lineY1 + dy * t; }
      s.textAnchor = (s.textX - 100) > 17 ? 'start' : (s.textX - 100) < -17 ? 'end' : 'middle';
    });
    return segments;
  }, [selectedSeconds, todayAppUsage]);
  
  const isOverLimit = selectedSeconds > SCREEN_TIME_LIMIT;
  const usageRatio = Math.min(selectedSeconds / SCREEN_TIME_LIMIT, 1);
  const ringOffset = RING_CIRCUMFERENCE * (1 - usageRatio);

  // Trend data: build a complete day-by-day range so missing dates still render at zero.
  const trendData = useMemo(() => {
    const historyByDate = new Map(historyData.filter((entry) => entry.Date).map((entry) => [entry.Date, entry]));
    const todayKey = toDateKey();

    return Array.from({ length: trendDays }, (_, index) => {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() - (trendDays - 1 - index));
      const dateKey = toDateKey(date);
      
      // Use live todayDeviceSeconds for today only when viewing own data, otherwise use DB history
      let seconds = 0;
      if (isNative && dateKey === todayKey && !isViewingOther && typeof todayDeviceSeconds === 'number') {
        seconds = todayDeviceSeconds;
      } else {
        const entry = historyByDate.get(dateKey);
        seconds = entry?.TotalScreenTimeSeconds ?? 0;
      }

      return {
        key: dateKey,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        seconds,
        hasData: seconds > 0,
      };
    });
  }, [historyData, selectedDate, trendDays, todayDeviceSeconds, isNative, isViewingOther]);

  const screenWithData = trendData.filter(d => d.hasData);
  const avgTrendSeconds = screenWithData.length
    ? Math.round(screenWithData.reduce((s, d) => s + d.seconds, 0) / screenWithData.length)
    : 0;
  const bestDay = screenWithData.reduce((best, d) => (!best || d.seconds < best.seconds ? d : best), null); // best = least
  const daysOverLimit = screenWithData.filter(d => d.seconds > SCREEN_TIME_LIMIT).length;

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
    sampledIndices.push(0); // Always include oldest

    return Array.from(new Set(sampledIndices))
      .sort((a, b) => a - b)
      .map((idx) => trendData[idx]);
  }, [trendData, trendDays]);

  const visibleScreenDotIndices = useMemo(() => {
    const total = trendChartData.length;
    if (total === 0) return new Set();
    return new Set(Array.from({ length: total }, (_, i) => i));
  }, [trendChartData]);

  const visibleScreenTickLabels = useMemo(
    () => Array.from(visibleScreenDotIndices).sort((a, b) => a - b).map(i => trendChartData[i]?.label).filter(Boolean),
    [trendChartData, visibleScreenDotIndices]
  );

  const renderScreenPointLabel = useCallback(
    ({ x, y, index }) => {
      if (x === undefined || y === undefined || index === undefined) return null;
      if (!visibleScreenDotIndices.has(index)) return null;
      const point = trendChartData[index];
      if (!point) return null;
      const text = point.hasData ? formatTrendTime(point.seconds) : '0m';
      const labelFontSize = isSmallChartDevice() ? 7 : 9;
      const labelY = y - (isSmallChartDevice() ? 8 : 11);
      return (
        <text x={x} y={labelY} textAnchor="middle" fill="#9ca3af" fontSize={labelFontSize} fontWeight={500}>
          {text}
        </text>
      );
    },
    [trendChartData, visibleScreenDotIndices]
  );

  if (loading) return <LoadingSpinner context="screen time" />;

  return (
    <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl px-3 md:px-4 pt-3 md:pt-5 pb-8 space-y-4">

      {/* ── Date Navigation ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm rounded-2xl">
        {!isControlled && (
          <div className="flex items-center justify-between px-4 pt-2 pb-0">
            <span className="text-xs font-medium text-gray-500">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
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
                        data-screen-date-index={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`flex-shrink-0 w-12 text-center py-2 px-1 rounded-lg transition-all duration-300 relative backdrop-blur-sm border ${
                          day.isSelected
                            ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg scale-105 border-emerald-300'
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
                            ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg scale-105 border-emerald-300'
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
        <div className="px-4 md:px-5 pt-4 pb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs md:text-sm text-gray-500">
              {activePanel === 'summary' ? 'Daily Summary' : `Screen Time Trend (${trendDays}D)`}
            </p>
            {activePanel === 'summary' && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Refresh screen time data"
                title="Refresh screen time data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
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
                {/* Ring — larger container gives room for outer labels */}
                <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto mb-1">
                  {/* overflow:visible so label text outside SVG bounds renders */}
                  <svg viewBox="-50 -50 300 300" className="w-full h-full" style={{ overflow: 'visible' }}>
                    <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="12" transform="rotate(-90, 100, 100)" />
                    {appSegments.length > 0 ? (
                      appSegments.map((seg, idx) => (
                        <circle
                          key={idx}
                          cx="100" cy="100" r={RING_RADIUS} fill="none"
                          stroke={seg.color}
                          strokeWidth="12" strokeLinecap="butt"
                          strokeDasharray={`${seg.arc} ${RING_CIRCUMFERENCE}`}
                          strokeDashoffset={seg.dashoffset}
                          transform="rotate(-90, 100, 100)"
                          className="transition-all duration-700 ease-out"
                        />
                      ))
                    ) : (
                      <>
                        <circle
                          cx="100" cy="100" r={RING_RADIUS} fill="none"
                          stroke={isOverLimit ? 'url(#screenOverGrad)' : 'url(#screenGrad)'}
                          strokeWidth="12" strokeLinecap="round"
                          strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
                          transform="rotate(-90, 100, 100)"
                          className="transition-all duration-700 ease-out"
                        />
                        <defs>
                          <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#22c55e" />
                          </linearGradient>
                          <linearGradient id="screenOverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#f97316" />
                          </linearGradient>
                        </defs>
                      </>
                    )}
                    {/* App name labels with pointer lines */}
                    {appSegments.map((seg, idx) => (
                      <g key={`lbl-${idx}`}>
                        <line
                          x1={seg.lineX1} y1={seg.lineY1}
                          x2={seg.lineX2} y2={seg.lineY2}
                          stroke={seg.color} strokeWidth="1.2" strokeLinecap="round"
                        />
                        <text
                          x={seg.textX} y={seg.textY}
                          textAnchor={seg.textAnchor} dominantBaseline="middle"
                          fontSize="9" fontWeight="500" fill="#374151"
                        >{seg.name}</text>
                      </g>
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
                    <Smartphone className={`w-4 h-4 sm:w-5 sm:h-5 mb-0.5 ${
                      isOverLimit ? 'text-red-500' : 'text-emerald-500'
                    }`} />
                    <p className={`font-extrabold text-gray-900 leading-none text-center ${
                      formatScreenTime(selectedSeconds).length > 6 ? 'text-lg sm:text-xl' :
                      formatScreenTime(selectedSeconds).length > 4 ? 'text-xl sm:text-2xl' :
                      'text-2xl sm:text-3xl'
                    }`}>
                      {formatScreenTime(selectedSeconds)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 font-medium">
                      / {formatScreenTime(SCREEN_TIME_LIMIT)}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{Math.round(usageRatio * 100)}% of limit</span>
                    {!isOverLimit && (
                      <span>{formatScreenTime(SCREEN_TIME_LIMIT - selectedSeconds)} remaining</span>
                    )}
                    {isOverLimit && (
                      <span className="text-red-500">
                        âš ï¸ Over by {formatScreenTime(selectedSeconds - SCREEN_TIME_LIMIT)}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isOverLimit
                          ? 'bg-gradient-to-r from-red-400 to-orange-400'
                          : 'bg-gradient-to-r from-emerald-400 to-green-500'
                      }`}
                      style={{ width: `${Math.round(usageRatio * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stat cards */}
                <div className={`grid gap-2 w-full ${isViewingOther ? 'grid-cols-1 max-w-[120px] mx-auto' : 'grid-cols-3'}`}>
                  {!isViewingOther && (
                    <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-700 mx-auto mb-1" />
                      <p className="text-base sm:text-lg font-bold text-emerald-800">
                        {todayAppUsage.length > 0 ? formatScreenTime(goodAppsSeconds) : '--'}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-medium">Good</p>
                    </div>
                  )}
                  {!isViewingOther && (
                    <div className="bg-orange-50 rounded-xl p-2.5 text-center">
                      <Ban className="w-3.5 h-3.5 text-orange-600 mx-auto mb-1" />
                      <p className="text-base sm:text-lg font-bold text-orange-700">
                        {todayAppUsage.length > 0 ? formatScreenTime(badAppsSeconds) : '--'}
                      </p>
                      <p className="text-[10px] text-orange-600 font-medium">Distracting</p>
                    </div>
                  )}
                  <div className="bg-green-50 rounded-xl p-2.5 text-center">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600 mx-auto mb-1" />
                    <p className="text-base sm:text-lg font-bold text-green-900">{formatScreenTime(avgSeconds)}</p>
                    <p className="text-[10px] text-green-600 font-medium">7-Day Avg</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Trend Panel ── */}
            <div ref={trendRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-5">
              {/* Trend range selector */}
              <div className="flex items-center justify-between mt-2 mb-3">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Screen Trend</p>
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
                  <p className="text-xs font-semibold text-emerald-900">{formatScreenTime(avgTrendSeconds)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] text-slate-600">Best Day</p>
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {bestDay ? formatScreenTime(bestDay.seconds) : '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-rose-50 px-2 py-1.5">
                  <p className="text-[10px] text-rose-700">Over Limit</p>
                  <p className="text-xs font-semibold text-rose-900">{daysOverLimit}/{trendDays}d</p>
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
                          ticks={visibleScreenTickLabels}
                          padding={{ left: 6, right: 12 }}
                          minTickGap={0}
                          tick={{ fontSize: isSmallChartDevice() ? 8 : 10, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          width={36}
                          tick={{ fontSize: isSmallChartDevice() ? 8 : 10, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={v => formatTrendTime(v)}
                          domain={[0, 'auto']}
                          tickCount={6}
                        />
                        <ReferenceLine
                          y={SCREEN_TIME_LIMIT}
                          stroke="#9ca3af"
                          strokeDasharray="5 5"
                          ifOverflow="extendDomain"
                        />
                        <Line
                          type="linear"
                          dataKey="seconds"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={({ cx, cy, index, payload }) => {
                            if (cx === undefined || cy === undefined || !visibleScreenDotIndices.has(index)) return null;
                            if (!payload) return null;
                            return (
                              <circle
                                key={`screen-dot-${payload.key || index}`}
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
                          <LabelList dataKey="seconds" content={renderScreenPointLabel} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                    <span>Limit: {formatScreenTime(SCREEN_TIME_LIMIT)}</span>
                    <span>Avg: {formatScreenTime(avgTrendSeconds)}</span>
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

export default ScreenDashboard;
