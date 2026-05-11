import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, RefreshCw, Clock, BarChart3, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  hasScreenTimePermission,
  getScreenTimePermissionStatus,
  requestScreenTimePermission,
  getTodayScreenTime,
  saveScreenTime,
  fetchScreenTimeHistory,
  formatScreenTime,
  backfillMissingScreenTimeDays
} from '../services/screenTimeService';

const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const PERIOD_OPTIONS = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 }
];

const ScreenTimeCard = ({ userId }) => {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [todayData, setTodayData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAppBreakdown, setShowAppBreakdown] = useState(false);
  const [error, setError] = useState(null);
  const [permissionIssue, setPermissionIssue] = useState(null);

  const isNative = Capacitor.isNativePlatform();

  // Resolve the real DB userId with multi-source fallback
  const [resolvedUserId, setResolvedUserId] = useState(() => {
    if (userId) return userId;
    const stored = localStorage.getItem('dbUserId');
    return stored ? Number(stored) : null;
  });

  useEffect(() => {
    if (resolvedUserId) return;
    let cancelled = false;

    const tryResolve = async () => {
      if (userId) {
        if (!cancelled) setResolvedUserId(userId);
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
          const res = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
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
          console.warn('[ScreenTimeCard] userId fallback failed:', e.message);
        }
      }
      return false;
    };

    tryResolve().then(resolved => {
      if (resolved || cancelled) return;
      const interval = setInterval(() => {
        tryResolve().then(ok => { if (ok) clearInterval(interval); });
      }, 1000);
      setTimeout(() => clearInterval(interval), 15000);
    });

    return () => { cancelled = true; };
  }, [userId, resolvedUserId]);

  // Check permission on mount
  useEffect(() => {
    if (!isNative) {
      setPermissionChecked(true);
      setIsLoading(false);
      return;
    }

    const checkPermission = async () => {
      const status = await getScreenTimePermissionStatus();
      setPermissionGranted(status.granted);
      setPermissionIssue(status.granted ? null : (status.message || null));
      setPermissionChecked(true);
      if (status.granted) {
        await loadData();
      } else {
        setIsLoading(false);
      }
    };
    checkPermission();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  // Re-check permission when app resumes (user may have granted it in settings)
  useEffect(() => {
    if (!isNative) return;

    const handleResume = async () => {
      const status = await getScreenTimePermissionStatus();
      if (status.granted && !permissionGranted) {
        setPermissionGranted(true);
        setPermissionIssue(null);
        await loadData();
      } else if (!status.granted) {
        setPermissionIssue(status.message || null);
      }
    };

    document.addEventListener('resume', handleResume);
    return () => document.removeEventListener('resume', handleResume);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, permissionGranted]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Always fetch device data first
      const deviceData = await getTodayScreenTime();
      setTodayData(deviceData);

      // Try backend operations separately — don't let them block device data
      if (resolvedUserId) {
        try {
          const history = await fetchScreenTimeHistory(resolvedUserId, selectedPeriod, toDateKey());
          if (history) setHistoryData(history);
        } catch (err) {
          console.warn('[ScreenTimeCard] Backend history fetch failed:', err.message);
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
            console.warn('[ScreenTimeCard] Backend save failed:', err.message);
          }
        }
      }
    } catch (err) {
      console.error('[ScreenTimeCard] Error loading data:', err);
      setError('Failed to load screen time data');
    } finally {
      setIsLoading(false);
    }
  }, [resolvedUserId, selectedPeriod]);

  // Reload history when period changes
  useEffect(() => {
    if (permissionGranted && resolvedUserId) {
      fetchScreenTimeHistory(resolvedUserId, selectedPeriod, toDateKey())
        .then(setHistoryData)
        .catch(err => console.error('[ScreenTimeCard] History fetch error:', err));
    }
  }, [selectedPeriod, permissionGranted, resolvedUserId]);

  // On app open: backfill only missing/zero days from install date → today
  useEffect(() => {
    if (!isNative || !permissionGranted || !resolvedUserId) return;

    backfillMissingScreenTimeDays(resolvedUserId)
      .then((saved) => {
        if (saved.length === 0) return;
        fetchScreenTimeHistory(resolvedUserId, selectedPeriod, toDateKey()).then(setHistoryData);
      })
      .catch(err => console.warn('⚠️ [ScreenTimeCard] Backfill failed:', err));
  }, [resolvedUserId, permissionGranted, isNative, selectedPeriod]);

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
      const history = await fetchScreenTimeHistory(resolvedUserId, selectedPeriod, toDateKey());
      setHistoryData(history);
    } catch (err) {
      console.error('[ScreenTimeCard] Refresh error:', err);
      setError('Failed to refresh screen time');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRequestPermission = async () => {
    const result = await requestScreenTimePermission();
    if (result?.message) setPermissionIssue(result.message);

    // Some devices return immediately from settings; re-check after a short delay.
    setTimeout(async () => {
      const status = await getScreenTimePermissionStatus();
      setPermissionGranted(status.granted);
      setPermissionIssue(status.granted ? null : (status.message || permissionIssue));
      if (status.granted) await loadData();
    }, 1200);
    // Permission is granted in system settings, check on resume
  };

  // Non-native fallback
  if (!isNative) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Smartphone className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-800">Screen Time</h3>
        </div>
        <p className="text-sm text-gray-500">
          Screen time tracking is only available on Android devices.
        </p>
      </div>
    );
  }

  // Permission not granted
  if (permissionChecked && !permissionGranted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">Screen Time</h3>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Grant usage access permission to track your daily screen time.
        </p>
        {permissionIssue && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-3">
            {permissionIssue}
          </p>
        )}
        <button
          onClick={handleRequestPermission}
          className="w-full py-2 px-4 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 active:bg-blue-700 transition-colors"
        >
          Open Usage Access Settings
        </button>
        <p className="text-[11px] text-gray-500 mt-2">
          If your phone is managed/restricted and does not allow Usage Access, this module cannot read device screen time.
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading && !todayData) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-800">Screen Time</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  const todaySeconds = todayData?.totalScreenTimeSeconds || 0;
  const appUsage = todayData?.appUsage || [];
  const trackedApps = appUsage.filter(a => a.isTrackedApp);
  const otherApps = appUsage.filter(a => !a.isTrackedApp && !a.isSystemApp);
  const avgSeconds = historyData?.summary?.averageSeconds || 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-800">Screen Time</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* Today's Total */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Today</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatScreenTime(todaySeconds)}
            </p>
          </div>
          {avgSeconds > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Avg ({selectedPeriod}d)</p>
              <p className="text-lg font-semibold text-gray-600">
                {formatScreenTime(avgSeconds)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-1 mb-3">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.days}
            onClick={() => setSelectedPeriod(opt.days)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              selectedPeriod === opt.days
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* History Chart (simple bar representation) */}
      {historyData?.data?.length > 0 && selectedPeriod > 1 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Daily Usage</span>
          </div>
          <div className="flex items-end gap-0.5 h-16">
            {historyData.data
              .filter(r => r.Date)  // skip NULL-date rows (old broken records)
              .slice()
              .sort((a, b) => a.Date.localeCompare(b.Date))
              .slice(-selectedPeriod)
              .map((record, idx) => {
                const maxSeconds = Math.max(...historyData.data.map(r => r.TotalScreenTimeSeconds || 0), 1);
                const heightPercent = ((record.TotalScreenTimeSeconds || 0) / maxSeconds) * 100;
                const dayLabel = new Date(record.Date + 'T00:00:00').toLocaleDateString('en', { weekday: 'narrow' });
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center" title={`${dayLabel}: ${formatScreenTime(record.TotalScreenTimeSeconds)}`}>
                    <div
                      className="w-full bg-blue-400 rounded-t-sm min-h-[2px]"
                      style={{ height: `${Math.max(heightPercent, 3)}%` }}
                    />
                    <span className="text-[9px] text-gray-400 mt-0.5">{dayLabel}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* App Breakdown Toggle */}
      {appUsage.length > 0 && (
        <div>
          <button
            onClick={() => setShowAppBreakdown(!showAppBreakdown)}
            className="flex items-center justify-between w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>App Breakdown ({appUsage.length} apps)</span>
            </div>
            {showAppBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAppBreakdown && (
            <div className="space-y-1.5 mt-1">
              {/* Tracked social/popular apps */}
              {trackedApps.map((app, idx) => (
                <AppUsageRow key={`tracked-${idx}`} app={app} totalSeconds={todaySeconds} highlight />
              ))}
              {/* Other apps */}
              {otherApps.slice(0, 10).map((app, idx) => (
                <AppUsageRow key={`other-${idx}`} app={app} totalSeconds={todaySeconds} />
              ))}
              {otherApps.length > 10 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{otherApps.length - 10} more apps
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AppUsageRow = ({ app, totalSeconds, highlight }) => {
  const percent = totalSeconds > 0 ? Math.round((app.usageSeconds / totalSeconds) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-xs truncate ${highlight ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
            {app.appName}
          </span>
          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
            {formatScreenTime(app.usageSeconds)}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${highlight ? 'bg-blue-500' : 'bg-gray-300'}`}
            style={{ width: `${Math.max(percent, 1)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ScreenTimeCard;
