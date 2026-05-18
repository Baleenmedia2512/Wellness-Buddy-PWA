/**
 * useScreenTimeData.js — slice-internal IO hook.
 *
 * Owns userId resolution, today/history fetching, manual refresh and
 * backfill. Permission is handled separately by `useScreenPermission`.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getTodayScreenTime, saveScreenTime, fetchScreenTimeHistory,
  backfillMissingScreenTimeDays,
} from '../services/screenTimeService';
import { resolveDbUserId, toDateKey } from '../services/screenIdentityService';

async function persistDevice(userId, deviceData) {
  if (!deviceData?.totalScreenTimeSeconds) return;
  try {
    await saveScreenTime({
      userId,
      date: deviceData.date || toDateKey(),
      totalScreenTimeSeconds: deviceData.totalScreenTimeSeconds,
    });
  } catch (err) {
    console.warn('[ScreenTimeCard] Backend save failed:', err.message);
  }
}

export function useScreenTimeData({ userId, isNative, permissionGranted } = {}) {
  const [resolvedUserId, setResolvedUserId] = useState(() => {
    if (userId) return userId;
    const stored = localStorage.getItem('dbUserId');
    return stored ? Number(stored) : null;
  });
  const [todayData, setTodayData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolve DB userId via multi-source fallback.
  useEffect(() => {
    if (resolvedUserId) return undefined;
    return resolveDbUserId({ userId, onResolved: setResolvedUserId });
  }, [userId, resolvedUserId]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true); setError(null);
      const deviceData = await getTodayScreenTime();
      setTodayData(deviceData);
      if (!resolvedUserId) return;
      try {
        const history = await fetchScreenTimeHistory(resolvedUserId, selectedPeriod, toDateKey());
        if (history) setHistoryData(history);
      } catch (err) { console.warn('[ScreenTimeCard] Backend history fetch failed:', err.message); }
      await persistDevice(resolvedUserId, deviceData);
    } catch (err) {
      console.error('[ScreenTimeCard] Error loading data:', err);
      setError('Failed to load screen time data');
    } finally {
      setIsLoading(false);
    }
  }, [resolvedUserId, selectedPeriod]);

  // Load when permission becomes available; otherwise (web) end the spinner.
  useEffect(() => {
    if (!isNative) { setIsLoading(false); return; }
    if (permissionGranted) loadData();
    else setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [isNative, permissionGranted, resolvedUserId]);

  // Period change → reload only the history.
  useEffect(() => {
    if (!permissionGranted || !resolvedUserId) return;
    fetchScreenTimeHistory(resolvedUserId, selectedPeriod, toDateKey())
      .then(setHistoryData)
      .catch((err) => console.error('[ScreenTimeCard] History fetch error:', err));
  }, [selectedPeriod, permissionGranted, resolvedUserId]);

  // Backfill missing days on open.
  useEffect(() => {
    if (!isNative || !permissionGranted || !resolvedUserId) return;
    backfillMissingScreenTimeDays(resolvedUserId)
      .then((saved) => {
        if (!saved?.length) return null;
        return fetchScreenTimeHistory(resolvedUserId, selectedPeriod, toDateKey())
          .then(setHistoryData);
      })
      .catch((err) => console.warn('[ScreenTimeCard] Backfill failed:', err));
  }, [resolvedUserId, permissionGranted, isNative, selectedPeriod]);

  const refresh = useCallback(async () => {
    if (!resolvedUserId) return;
    setIsRefreshing(true);
    try {
      const deviceData = await getTodayScreenTime();
      await persistDevice(resolvedUserId, deviceData);
      setTodayData(deviceData);
      const history = await fetchScreenTimeHistory(resolvedUserId, selectedPeriod, toDateKey());
      setHistoryData(history);
    } catch (err) {
      console.error('[ScreenTimeCard] Refresh error:', err);
      setError('Failed to refresh screen time');
    } finally {
      setIsRefreshing(false);
    }
  }, [resolvedUserId, selectedPeriod]);

  return {
    todayData, historyData, selectedPeriod, setSelectedPeriod,
    isRefreshing, isLoading, error,
    refresh,
  };
}
