import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone, ArrowLeft, ShieldAlert, Clock, Calendar, TrendingUp, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import {
  hasScreenTimePermission,
  requestScreenTimePermission,
  getTodayScreenTime,
  saveScreenTime,
  fetchScreenTimeHistory,
  formatScreenTime,
  syncAccurateHistoryFromInstall
} from '../services/screenTimeService';
import LoadingSpinner from '../components/LoadingSpinner';

const SCREEN_TIME_LIMIT = 2 * 3600; // 2-hour daily limit (in seconds)
const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ScreenTimePage = ({ userId, onBack }) => {
  const isNative = Capacitor.isNativePlatform();

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
      }
    } catch (err) {
      console.error('[ScreenTime] Load error:', err);
      setError('Failed to load screen time data');
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId]);

  useEffect(() => {
    if (!isNative) { setPermissionChecked(true); setLoading(false); return; }
    const check = async () => {
      const granted = await hasScreenTimePermission();
      setPermissionGranted(granted);
      setPermissionChecked(true);
      if (granted) { await loadData(); } else { setLoading(false); }
    };
    check();
  }, [isNative, loadData]);

  useEffect(() => {
    if (!isNative) return;
    const handleResume = async () => {
      const granted = await hasScreenTimePermission();
      if (granted && !permissionGranted) {
        setPermissionGranted(true);
        await loadData();
      }
    };
    document.addEventListener('resume', handleResume);
    return () => document.removeEventListener('resume', handleResume);
  }, [isNative, permissionGranted, loadData]);

  // Reload history when resolvedUserId becomes available
  useEffect(() => {
    if (resolvedUserId && permissionGranted) {
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

  // On app open: sync accurate UsageStats history from install day → today
  // Covers: Req 1 (from install day), Req 3 (correct on every open), Req 4 (accurate DB values)
  // Also handles Req 5 (reinstall): DB already has old data; this re-syncs recent days
  useEffect(() => {
    if (!isNative || !permissionGranted || !resolvedUserId) return;

    syncAccurateHistoryFromInstall(resolvedUserId)
      .then((synced) => {
        if (synced.length === 0) return;
        console.log('✅ [ScreenTime] Synced', synced.length, 'day(s) from install date');
        fetchScreenTimeHistory(resolvedUserId, 30, toDateKey()).then(h => {
          if (h?.success && Array.isArray(h.data)) {
            setHistoryData(h.data);
            setAvgSeconds(h.summary?.averageSeconds || 0);
          }
        });
      })
      .catch(err => console.warn('⚠️ [ScreenTime] Sync failed:', err));
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
    await requestScreenTimePermission();
  };

  // Derived values
  const todaySeconds = todayData?.totalScreenTimeSeconds || 0;
  const appUsage = todayData?.appUsage || [];
  const trackedApps = appUsage.filter(a => a.isTrackedApp);
  const otherApps = appUsage.filter(a => !a.isTrackedApp && !a.isSystemApp);

  // Ring progress (fills up to limit — over limit means overflow)
  const usageRatio = Math.min(todaySeconds / SCREEN_TIME_LIMIT, 1);
  const ringOffset = RING_CIRCUMFERENCE * (1 - usageRatio);
  const isOverLimit = todaySeconds > SCREEN_TIME_LIMIT;

  // History slicing
  const sortedHistory = [...historyData]
    .filter(r => r.Date)  // skip rows with NULL Date (old broken records)
    .sort((a, b) => a.Date.localeCompare(b.Date));
  const displayHistory = historyView === 'week' ? sortedHistory.slice(-7) : sortedHistory;

  if (loading && !permissionChecked) {
    return <LoadingSpinner context="screen time" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* ──── Header ──── */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-blue-100/50 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-500 p-2 rounded-xl shadow-sm">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">Screen Time</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || !resolvedUserId}
            className="p-2 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ──── Content ──── */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-4 sm:space-y-5">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Non-native fallback */}
        {!isNative && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 text-center">
            <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">Screen time tracking is only available on Android devices.</p>
          </div>
        )}

        {/* Permission prompt */}
        {isNative && permissionChecked && !permissionGranted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">Permission Required</p>
                <p className="text-xs text-amber-700 mb-3">Grant usage access permission to track your daily screen time.</p>
                <button onClick={handleRequestPermission} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  Grant Permission
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──── Circular Progress Ring + Stats ──── */}
        {isNative && permissionGranted && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
            <div className="flex flex-col items-center">
              {/* Ring */}
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 mb-4">
                {loading ? (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 animate-pulse" />
                ) : (
                  <>
                    <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                      <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      <circle cx="100" cy="100" r={RING_RADIUS} fill="none"
                        stroke={isOverLimit ? 'url(#screenOverGradient)' : 'url(#screenGradient)'}
                        strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
                        className="transition-all duration-700 ease-out"
                      />
                      <defs>
                        <linearGradient id="screenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                        <linearGradient id="screenOverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Smartphone className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 ${isOverLimit ? 'text-red-500' : 'text-blue-500'}`} />
                      <p className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-none">
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
              {!loading && (
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
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="bg-blue-50 rounded-2xl p-3.5 sm:p-4 text-center">
                <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1.5" />
                {loading ? (
                  <div className="h-6 w-16 bg-blue-200/60 rounded-lg animate-pulse mx-auto" />
                ) : (
                  <p className="text-lg sm:text-xl font-bold text-blue-900">{formatScreenTime(todaySeconds)}</p>
                )}
                <p className="text-xs text-blue-600 mt-0.5 font-medium">Today</p>
              </div>
              <div className="bg-indigo-50 rounded-2xl p-3.5 sm:p-4 text-center">
                <TrendingUp className="w-4 h-4 text-indigo-500 mx-auto mb-1.5" />
                {loading ? (
                  <div className="h-6 w-16 bg-indigo-200/60 rounded-lg animate-pulse mx-auto" />
                ) : (
                  <p className="text-lg sm:text-xl font-bold text-indigo-900">{formatScreenTime(avgSeconds)}</p>
                )}
                <p className="text-xs text-indigo-500 mt-0.5 font-medium">Daily Avg</p>
              </div>
            </div>
          </div>
        )}

        {/* ──── App Breakdown ──── */}
        {isNative && permissionGranted && appUsage.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
            <button
              onClick={() => setShowAppBreakdown(!showAppBreakdown)}
              className="flex items-center justify-between w-full"
            >
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
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
        {isNative && permissionGranted && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                History
              </h2>
              <div className="flex bg-gray-100 rounded-xl p-0.5">
                <button
                  onClick={() => setHistoryView('week')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyView === 'week' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
                  }`}
                >Week</button>
                <button
                  onClick={() => setHistoryView('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyView === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
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
                      <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
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
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <p className="text-xs text-gray-500 font-medium">Total Usage</p>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-indigo-600">
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
                          isToday ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                            isToday ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : over ? 'bg-red-400' : 'bg-gray-300'
                          }`}>
                            {date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isToday ? 'text-blue-900' : 'text-gray-800'}`}>
                              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {isToday && <span className="ml-1.5 text-xs text-blue-500 font-medium">Today</span>}
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
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
        accent ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 'bg-gray-300'
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
            className={`h-1.5 rounded-full transition-all ${accent ? 'bg-blue-500' : 'bg-gray-300'}`}
            style={{ width: `${Math.max(percent, 1)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ScreenTimePage;
