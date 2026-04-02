import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone, ArrowLeft, ShieldAlert, Clock, Calendar, TrendingUp, RefreshCw, ChevronDown, ChevronUp, ThumbsUp, Ban } from 'lucide-react';
import {
  hasScreenTimePermission,
  getScreenTimePermissionStatus,
  requestScreenTimePermission,
  getTodayScreenTime,
  saveScreenTime,
  fetchScreenTimeHistory,
  formatScreenTime,
  backfillMissingScreenTimeDays,
  getAccurateScreenTimeHistory,
} from '../services/screenTimeService';
import LoadingSpinner from '../components/LoadingSpinner';

const SCREEN_TIME_LIMIT = 2 * 3600; // 2-hour daily limit (in seconds)
const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const NUTRITION_APP_KEYWORDS = [
  'healthifyme',
  'myfitnesspal',
  'yazio',
  'lose it',
  'cronometer',
  'fatsecret',
  'myplate',
  'lifesum',
  'macros',
  'nutrition',
  'calorie',
  'diet',
  'food diary'
];

const RECOMMENDED_NUTRITION_APPS = ['Wellness Valley', 'HealthifyMe', 'MyFitnessPal', 'YAZIO', 'Cronometer'];

const GOOD_APP_KEYWORDS = [
  'wellness','healthifyme','myfitnesspal','yazio','lose it','cronometer','fatsecret','myplate',
  'lifesum','macros','nutrition','calorie','diet','food diary','fitness','workout',
  'gym','yoga','meditation','strava','nike','duolingo','coursera','udemy','khan',
  'learning','study','books','gmail','outlook','teams','slack','zoom','meet',
  'docs','sheets','notion','todoist','calendar','maps','clock','notes'
];

const BAD_APP_KEYWORDS = [
  'instagram','facebook','tiktok','snapchat','twitter',' x ','youtube','netflix',
  'hotstar','disney','prime video','jiocinema','pubg','freefire','clash','roblox',
  'candy crush','game','reddit','pinterest','sharechat','moj','josh','reels'
];

const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ScreenTimePage = ({ userId, onBack, user, userRole = 'user' }) => {
  const isNative = Capacitor.isNativePlatform();
  const isCoach = userRole === 'coach' || userRole === 'coCoach' || userRole === 'admin' || userRole === 'developer';

  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [todayData, setTodayData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [avgSeconds, setAvgSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyView, setHistoryView] = useState('week');
  const [showAppBreakdown, setShowAppBreakdown] = useState(false);
  const [permissionIssue, setPermissionIssue] = useState(null);

  // Viewing other member (coaches only)
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberData, setMemberData] = useState({ todaySeconds: 0, history: [], avg: 0, loading: false });

  useEffect(() => {
    if (!selectedMember || selectedMember.isSelf) {
      setMemberData({ todaySeconds: 0, history: [], avg: 0, loading: false });
      return;
    }
    const memberId = selectedMember.id || selectedMember.userId;
    setMemberData(prev => ({ ...prev, loading: true }));
    fetchScreenTimeHistory(memberId, 30, toDateKey())
      .then(res => {
        if (res?.success && Array.isArray(res.data)) {
          const todayRecord = res.data.find(r => r.Date === toDateKey());
          setMemberData({
            todaySeconds: todayRecord?.TotalScreenTimeSeconds || 0,
            history: res.data,
            avg: res.summary?.averageSeconds || 0,
            loading: false,
          });
        } else {
          setMemberData({ todaySeconds: 0, history: [], avg: 0, loading: false });
        }
      })
      .catch(() => setMemberData({ todaySeconds: 0, history: [], avg: 0, loading: false }));
  }, [selectedMember]);

  const [resolvedUserId, setResolvedUserId] = useState(() => {
    if (userId) return userId;
    const stored = localStorage.getItem('dbUserId');
    return stored ? Number(stored) : null;
  });

  useEffect(() => {
    if (resolvedUserId) return;
    let cancelled = false;
    const tryResolve = async () => {
      if (userId) { if (!cancelled) setResolvedUserId(userId); return true; }
      const stored = localStorage.getItem('dbUserId');
      if (stored) { if (!cancelled) setResolvedUserId(Number(stored)); return true; }
      const email = localStorage.getItem('userEmail');
      if (email) {
        try {
          const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
          const res = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (data.success && data.userId) {
            localStorage.setItem('dbUserId', String(data.userId));
            if (!cancelled) setResolvedUserId(data.userId);
            return true;
          }
        } catch (e) { console.warn('[ScreenTime] userId fallback failed:', e.message); }
      }
      return false;
    };
    tryResolve().then(ok => {
      if (ok || cancelled) return;
      const interval = setInterval(() => {
        tryResolve().then(resolved => { if (resolved) clearInterval(interval); });
      }, 1000);
      setTimeout(() => clearInterval(interval), 15000);
    });
    return () => { cancelled = true; };
  }, [userId, resolvedUserId]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const deviceData = await getTodayScreenTime();
      setTodayData(deviceData);

      if (resolvedUserId) {
        try {
          const history = await fetchScreenTimeHistory(resolvedUserId, 30, toDateKey());
          if (history?.success && Array.isArray(history.data)) {
            setHistoryData(history.data);
            setAvgSeconds(history.summary?.averageSeconds || 0);
          }
        } catch (err) {
          console.warn('[ScreenTime] History fetch failed:', err.message);
        }
        // Save using already-fetched deviceData — no second plugin call
        if (deviceData?.totalScreenTimeSeconds > 0) {
          const localDate = deviceData.date || toDateKey();
          try {
            await saveScreenTime({
              userId: resolvedUserId,
              date: localDate,
              totalScreenTimeSeconds: deviceData.totalScreenTimeSeconds
            });
          } catch (err) {
            console.warn('[ScreenTime] Save failed:', err.message);
          }
        }

        // Re-sync yesterday's accurate OS data (full 24-hour reading available after midnight)
        if (isNative) {
          try {
            const recentOsData = await getAccurateScreenTimeHistory(2);
            const yesterday = toDateKey(new Date(Date.now() - 86400000));
            const yesterdayEntry = recentOsData?.history?.find(e => e.date === yesterday);
            if (yesterdayEntry && typeof yesterdayEntry.seconds === 'number') {
              await saveScreenTime({
                userId: resolvedUserId,
                date: yesterdayEntry.date,
                totalScreenTimeSeconds: yesterdayEntry.seconds
              });
              const refreshed = await fetchScreenTimeHistory(resolvedUserId, 30, toDateKey());
              if (refreshed?.success && Array.isArray(refreshed.data)) {
                setHistoryData(refreshed.data);
                setAvgSeconds(refreshed.summary?.averageSeconds || 0);
              }
            }
          } catch (err) {
            console.warn('[ScreenTime] Yesterday re-sync failed:', err.message);
          }
        }
      }
    } catch (err) {
      console.error('[ScreenTime] Load error:', err);
      setError('Failed to load screen time data');
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId, isNative]);

  useEffect(() => {
    if (!isNative) { setPermissionChecked(true); loadData(); return; }
    const check = async () => {
      const status = await getScreenTimePermissionStatus();
      setPermissionGranted(status.granted);
      setPermissionIssue(status.granted ? null : (status.message || null));
      setPermissionChecked(true);
      if (status.granted) { await loadData(); } else { setLoading(false); }
    };
    check();
  }, [isNative, loadData]);

  useEffect(() => {
    if (!isNative) return;
    const handleResume = async () => {
      const status = await getScreenTimePermissionStatus();
      if (status.granted) {
        if (!permissionGranted) setPermissionGranted(true);
        setPermissionIssue(null);
        await loadData();

        // On every resume, backfill only missing/zero days (smart — skips already-saved days).
        if (resolvedUserId) {
          try {
            await backfillMissingScreenTimeDays(resolvedUserId);
            const h = await fetchScreenTimeHistory(resolvedUserId, 30, toDateKey());
            if (h?.success && Array.isArray(h.data)) {
              setHistoryData(h.data);
              setAvgSeconds(h.summary?.averageSeconds || 0);
            }
          } catch (err) {
            console.warn('⚠️ [ScreenTime] Resume sync failed:', err);
          }
        }
      } else {
        setPermissionIssue(status.message || null);
      }
    };
    document.addEventListener('resume', handleResume);
    return () => document.removeEventListener('resume', handleResume);
  }, [isNative, permissionGranted, loadData, resolvedUserId]);

  // Reload history when resolvedUserId becomes available
  useEffect(() => {
    if (resolvedUserId && (permissionGranted || !isNative)) {
      fetchScreenTimeHistory(resolvedUserId, 30, toDateKey())
        .then(h => {
          if (h?.success && Array.isArray(h.data)) {
            setHistoryData(h.data);
            setAvgSeconds(h.summary?.averageSeconds || 0);
          }
        })
        .catch(() => {});
    }
  }, [resolvedUserId, permissionGranted]);

  // On app open: backfill only days missing from DB (or saved as 0) from install date → today.
  // Today + yesterday are always refreshed with fresh accurate OS readings.
  useEffect(() => {
    if (!isNative || !permissionGranted || !resolvedUserId) return;

    backfillMissingScreenTimeDays(resolvedUserId)
      .then((saved) => {
        if (saved.length > 0) {
          fetchScreenTimeHistory(resolvedUserId, 30, toDateKey()).then(h => {
            if (h?.success && Array.isArray(h.data)) {
              setHistoryData(h.data);
              setAvgSeconds(h.summary?.averageSeconds || 0);
            }
          });
        }
      })
      .catch(err => console.warn('⚠️ [ScreenTime] Backfill failed:', err));
  }, [resolvedUserId, permissionGranted, isNative]);

  const handleRefresh = async () => {
    if (!resolvedUserId) return;
    setIsRefreshing(true);
    try {
      const deviceData = await getTodayScreenTime();
      if (deviceData?.totalScreenTimeSeconds > 0) {
        const localDate = deviceData.date || toDateKey();
        await saveScreenTime({
          userId: resolvedUserId,
          date: localDate,
          totalScreenTimeSeconds: deviceData.totalScreenTimeSeconds
        });
      }
      setTodayData(deviceData);
      const history = await fetchScreenTimeHistory(resolvedUserId, 30, toDateKey());
      if (history?.success && Array.isArray(history.data)) {
        setHistoryData(history.data);
        setAvgSeconds(history.summary?.averageSeconds || 0);
      }
    } catch (err) {
      setError('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRequestPermission = async () => {
    const result = await requestScreenTimePermission();
    if (result?.message) setPermissionIssue(result.message);

    setTimeout(async () => {
      const status = await getScreenTimePermissionStatus();
      setPermissionGranted(status.granted);
      setPermissionIssue(status.granted ? null : (status.message || result?.message || null));
      if (status.granted) await loadData();
    }, 1200);
  };

  // Derived values
  const isViewingOther = !!(selectedMember && !selectedMember.isSelf);
  const todaySeconds = isViewingOther ? memberData.todaySeconds : (todayData?.totalScreenTimeSeconds || 0);
  const displayAvgSeconds = isViewingOther ? memberData.avg : avgSeconds;
  const rawHistoryData = isViewingOther ? memberData.history : historyData;
  const displayLoading = isViewingOther ? memberData.loading : loading;

  const appUsage = todayData?.appUsage || [];
  const trackedApps = appUsage.filter(a => a.isTrackedApp);
  const otherApps = appUsage.filter(a => !a.isTrackedApp && !a.isSystemApp);
  const nutritionApps = appUsage
    .filter((app) => {
      const haystack = `${app?.appName || ''} ${app?.packageName || ''}`.toLowerCase();
      return NUTRITION_APP_KEYWORDS.some((keyword) => haystack.includes(keyword));
    })
    .sort((a, b) => (b?.usageSeconds || 0) - (a?.usageSeconds || 0));
  const topNutritionApp = nutritionApps[0] || null;

  const matchApp = (app, keywords) =>
    keywords.some(k => `${app?.appName || ''} ${app?.packageName || ''}`.toLowerCase().includes(k));
  const goodAppsSeconds = appUsage.filter(a => matchApp(a, GOOD_APP_KEYWORDS)).reduce((s, a) => s + (a.usageSeconds || 0), 0);
  const badAppsSeconds  = appUsage.filter(a => matchApp(a, BAD_APP_KEYWORDS)).reduce((s, a) => s + (a.usageSeconds || 0), 0);
  const otherAppsSeconds = todaySeconds - goodAppsSeconds - badAppsSeconds;

  // Individual app ring segments (top 6 apps + Other) with label pointer lines
  const RING_APP_COLORS = ['#10b981','#f97316','#3b82f6','#a855f7','#f59e0b','#ec4899','#06b6d4','#84cc16'];
  const MAX_RING_APPS = 6;
  const appRingSegments = (() => {
    if (todaySeconds === 0 || appUsage.length === 0) return [];
    const usedArc = RING_CIRCUMFERENCE * Math.min(todaySeconds / SCREEN_TIME_LIMIT, 1);
    const sorted = [...appUsage]
      .filter(a => (a.usageSeconds || 0) >= 60)
      .sort((a, b) => (b.usageSeconds || 0) - (a.usageSeconds || 0));
    if (sorted.length === 0) return [];
    const topApps = sorted.slice(0, MAX_RING_APPS);
    const otherSecs = sorted.slice(MAX_RING_APPS).reduce((s, a) => s + (a.usageSeconds || 0), 0);
    const segments = [];
    let cumArc = 0;
    topApps.forEach((app, idx) => {
      const arc = usedArc * ((app.usageSeconds || 0) / todaySeconds);
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
      const arc = usedArc * (otherSecs / todaySeconds);
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
  })();

  // Ring progress (fills up to limit — over limit means overflow)
  const usageRatio = Math.min(todaySeconds / SCREEN_TIME_LIMIT, 1);
  const ringOffset = RING_CIRCUMFERENCE * (1 - usageRatio);
  const isOverLimit = todaySeconds > SCREEN_TIME_LIMIT;

  // History slicing — deduplicate by Date first (keep highest seconds per date)
  const deduplicatedHistory = Object.values(
    rawHistoryData
      .filter(r => r.Date)
      .reduce((acc, r) => {
        const existing = acc[r.Date];
        if (!existing || (r.TotalScreenTimeSeconds || 0) > (existing.TotalScreenTimeSeconds || 0)) {
          acc[r.Date] = r;
        }
        return acc;
      }, {})
  );
  const sortedHistory = deduplicatedHistory.sort((a, b) => a.Date.localeCompare(b.Date));
  const displayHistory = historyView === 'week' ? sortedHistory.slice(-7) : sortedHistory;

  // Weekly avg: sum last 7 days ÷ 7 (zero for days with no data — true average)
  const last7 = sortedHistory.slice(-7);
  const weeklyAvgSeconds = Math.round(
    last7.reduce((s, r) => s + (r.TotalScreenTimeSeconds || 0), 0) / 7
  );

  if (loading && !permissionChecked) {
    return <LoadingSpinner context="screen time" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-green-50/40">
      {/* ──── Header ──── */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-emerald-100/50 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="bg-gradient-to-br from-emerald-500 to-green-500 p-2 rounded-xl shadow-sm">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Screen Time</h1>
              {isViewingOther && (
                <p className="text-xs text-emerald-600 font-medium">Viewing {selectedMember.userName}'s data</p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || !resolvedUserId || isViewingOther}
            className="p-2 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ──── Content ──── */}
      <div className="max-w-lg mx-auto px-3 sm:px-4 pt-4 pb-8 space-y-3 sm:space-y-4">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Non-native info note */}
        {!isNative && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium">Live tracking requires the Android app. Showing saved history.</p>
          </div>
        )}

        {/* Permission prompt */}
        {isNative && permissionChecked && !permissionGranted && !isViewingOther && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">Permission Required</p>
                <p className="text-xs text-amber-700 mb-3">Grant usage access permission to track your daily screen time.</p>
                {permissionIssue && (
                  <p className="text-xs text-amber-800 bg-amber-100/70 border border-amber-200 rounded-lg px-2.5 py-2 mb-3">
                    {permissionIssue}
                  </p>
                )}
                <button onClick={handleRequestPermission} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  Open Usage Access Settings
                </button>
                <p className="text-[11px] text-amber-700/90 mt-2">
                  Some managed/restricted phones block Usage Access, so screen time cannot be read on those devices.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ──── Circular Progress Ring + Stats ──── */}
        {(isViewingOther || !isNative || permissionGranted) && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-4 sm:p-6">
            <div className="flex flex-col items-center">
              {/* Ring — py adds vertical breathing room for top/bottom labels */}
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 mx-auto pb-1">
                {displayLoading ? (
                  <div className="absolute inset-[14%] rounded-full bg-gradient-to-br from-emerald-100 to-green-100 animate-pulse" />
                ) : (
                  <>
                    {/* overflow:visible so SVG labels render outside the box without clipping */}
                    <svg viewBox="-50 -50 300 300" className="w-full h-full" style={{ overflow: 'visible' }}>
                      {/* Track */}
                      <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="10" transform="rotate(-90, 100, 100)" />
                      {/* App segments */}
                      {appRingSegments.length > 0 ? (
                        appRingSegments.map((seg, idx) => (
                          <circle key={idx} cx="100" cy="100" r={RING_RADIUS} fill="none"
                            stroke={seg.color} strokeWidth="10" strokeLinecap="butt"
                            strokeDasharray={`${seg.arc} ${RING_CIRCUMFERENCE}`}
                            strokeDashoffset={seg.dashoffset}
                            transform="rotate(-90, 100, 100)"
                            className="transition-all duration-700 ease-out"
                          />
                        ))
                      ) : (
                        <>
                          <circle cx="100" cy="100" r={RING_RADIUS} fill="none"
                            stroke={isOverLimit ? 'url(#screenOverGradient)' : 'url(#screenGradient)'}
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
                            transform="rotate(-90, 100, 100)"
                            className="transition-all duration-700 ease-out"
                          />
                          <defs>
                            <linearGradient id="screenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#22c55e" />
                            </linearGradient>
                            <linearGradient id="screenOverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#ef4444" />
                              <stop offset="100%" stopColor="#f97316" />
                            </linearGradient>
                          </defs>
                        </>
                      )}
                      {/* App name labels with pointer lines */}
                      {appRingSegments.map((seg, idx) => (
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
                      <Smartphone className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 ${isOverLimit ? 'text-red-500' : 'text-emerald-500'}`} />
                      <p className={`font-extrabold text-gray-900 leading-none text-center ${
                        formatScreenTime(todaySeconds).length > 6 ? 'text-2xl sm:text-3xl' :
                        formatScreenTime(todaySeconds).length > 4 ? 'text-3xl sm:text-3xl' :
                        'text-3xl sm:text-4xl'
                      }`}>
                        {formatScreenTime(todaySeconds)}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">
                        / {formatScreenTime(SCREEN_TIME_LIMIT)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Status text */}
              {!displayLoading && (
                <p className={`text-sm font-medium mb-1 ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                  {isOverLimit
                    ? `⚠️ Over limit by ${formatScreenTime(todaySeconds - SCREEN_TIME_LIMIT)}`
                    : todaySeconds === 0
                      ? 'No screen time recorded yet'
                      : `${formatScreenTime(SCREEN_TIME_LIMIT - todaySeconds)} remaining`}
                </p>
              )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-4">
              <div className="bg-emerald-50 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 text-center">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-700 mx-auto mb-0.5" />
                {displayLoading ? (
                  <div className="h-4 w-10 bg-emerald-200/60 rounded-lg animate-pulse mx-auto" />
                ) : (
                  <p className="text-sm sm:text-base font-bold text-emerald-800 leading-tight">
                    {appUsage.length > 0 ? formatScreenTime(goodAppsSeconds) : '--'}
                  </p>
                )}
                <p className="text-[9px] sm:text-[10px] text-emerald-700 mt-0.5 font-medium">Good</p>
              </div>
              <div className="bg-orange-50 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 text-center">
                <Ban className="w-3.5 h-3.5 text-orange-600 mx-auto mb-0.5" />
                {displayLoading ? (
                  <div className="h-4 w-10 bg-orange-200/60 rounded-lg animate-pulse mx-auto" />
                ) : (
                  <p className="text-sm sm:text-base font-bold text-orange-700 leading-tight">
                    {appUsage.length > 0 ? formatScreenTime(badAppsSeconds) : '--'}
                  </p>
                )}
                <p className="text-[9px] sm:text-[10px] text-orange-600 mt-0.5 font-medium">Distracting</p>
              </div>
              <div className="bg-green-50 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 text-center">
                <TrendingUp className="w-3.5 h-3.5 text-green-600 mx-auto mb-0.5" />
                {displayLoading ? (
                  <div className="h-4 w-10 bg-green-200/60 rounded-lg animate-pulse mx-auto" />
                ) : (
                  <p className="text-sm sm:text-base font-bold text-green-900 leading-tight">
                    {formatScreenTime(weeklyAvgSeconds)}
                  </p>
                )}
                <p className="text-[9px] sm:text-[10px] text-green-600 mt-0.5 font-medium">7-Day Avg</p>
              </div>
            </div>
          </div>
        )}

        {/* ──── App Breakdown ──── */}
        {!isViewingOther && isNative && permissionGranted && appUsage.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-4 sm:p-6">
            <button
              onClick={() => setShowAppBreakdown(!showAppBreakdown)}
              className="flex items-center justify-between w-full"
            >
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                App Breakdown ({appUsage.length})
              </h2>
              {showAppBreakdown ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {showAppBreakdown && (
              <div className="space-y-2.5 mt-4">
                {trackedApps.map((app, idx) => (
                  <AppRow key={`t-${idx}`} app={app} totalSeconds={todaySeconds} accent />
                ))}
                {otherApps.slice(0, 10).map((app, idx) => (
                  <AppRow key={`o-${idx}`} app={app} totalSeconds={todaySeconds} />
                ))}
                {otherApps.length > 10 && (
                  <p className="text-xs text-gray-400 text-center pt-1">+{otherApps.length - 10} more apps</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ──── History Section ──── */}
        {(isViewingOther || !isNative || permissionGranted) && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                History
              </h2>
              <div className="flex bg-gray-100 rounded-xl p-0.5">
                <button
                  onClick={() => setHistoryView('week')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyView === 'week' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                  }`}
                >Week</button>
                <button
                  onClick={() => setHistoryView('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyView === 'month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                  }`}
                >Month</button>
              </div>
            </div>

            {displayHistory.length > 0 ? (
              <>
                {/* Summary Row */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <p className="text-xs text-gray-500 font-medium">Avg Usage</p>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {formatScreenTime(
                        displayHistory.length > 0
                          ? Math.round(displayHistory.reduce((s, r) => s + (r.TotalScreenTimeSeconds || 0), 0) / displayHistory.length)
                          : 0
                      )}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Clock className="w-3.5 h-3.5 text-green-500" />
                      <p className="text-xs text-gray-500 font-medium">Total Usage</p>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-emerald-600">
                      {formatScreenTime(displayHistory.reduce((s, r) => s + (r.TotalScreenTimeSeconds || 0), 0))}
                    </p>
                  </div>
                </div>

                {/* Daily List */}
                <div className="mt-4 space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
                  {[...displayHistory].reverse().map((record) => {
                    const date = new Date(record.Date + 'T00:00:00');
                    const isToday = toDateKey(date) === toDateKey();
                    const seconds = isToday ? todaySeconds : (record.TotalScreenTimeSeconds || 0);
                    const over = seconds > SCREEN_TIME_LIMIT;

                    return (
                      <div
                        key={record.Date}
                        className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                          isToday ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                            isToday ? 'bg-gradient-to-br from-emerald-500 to-green-500' : over ? 'bg-red-400' : 'bg-gray-300'
                          }`}>
                            {date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isToday ? 'text-emerald-900' : 'text-gray-800'}`}>
                              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {isToday && <span className="ml-1.5 text-xs text-emerald-500 font-medium">Today</span>}
                            </p>
                            <p className="text-xs text-gray-400">{date.toLocaleDateString('en-US', { weekday: 'long' })}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${over ? 'text-red-600' : 'text-gray-900'}`}>{formatScreenTime(seconds)}</p>
                          {over && <p className="text-xs text-red-400">Over limit</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">No history data yet</p>
                <p className="text-xs text-gray-300 mt-1">Screen time will be recorded daily</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AppRow = ({ app, totalSeconds, accent }) => {
  const percent = totalSeconds > 0 ? Math.round((app.usageSeconds / totalSeconds) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
        accent ? 'bg-gradient-to-br from-emerald-500 to-green-500' : 'bg-gray-300'
      }`}>
        {(app.appName || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-sm truncate ${accent ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
            {app.appName}
          </span>
          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
            {formatScreenTime(app.usageSeconds)}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${accent ? 'bg-emerald-500' : 'bg-gray-300'}`}
            style={{ width: `${Math.max(percent, 1)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ScreenTimePage;
