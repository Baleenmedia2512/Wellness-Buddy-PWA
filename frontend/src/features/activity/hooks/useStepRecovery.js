/**
 * useStepRecovery.js — manual refresh button + drift recovery flow.
 *
 * On native:
 *   1. Read current sensor value
 *   2. If silent drift was flagged, re-anchor today's baseline + dbOffset
 *      against the freshly-fetched DB value
 *   3. Force-process the sensor value, then save in-app + ask the BG
 *      service to flush its SharedPreferences value
 *   4. Wait briefly for the service write, then re-fetch DB and re-anchor
 *      one more time so the displayed total reflects what was just saved
 *   5. Reload daily history
 *
 * On web: just reloads history. Both paths surface a brief "✓" toast via
 * setRefreshing/setRefreshDone.
 */
import { useCallback } from 'react';
import { StepCounterPlugin } from '../../../shared/plugins/stepCounterPlugin';
import { GalleryMonitorPlugin } from '../../../shared/plugins/galleryMonitorPlugin';
import {
  fetchTodayEntry, saveStepsForDate, syncLastSavedFromEntry,
} from '../services/stepCounterPersistence';
import { writeBaseline, writeSaveAnchors } from '../services/stepCounterStorage';
import { toDateKey, calcCalories } from '../services/stepCounterCalculations';

export function useStepRecovery({
  refs, isNativePlatform, setRefreshing, setRefreshDone,
  setLastSaved, setTodaySteps, setTodayCalories,
}) {
  const finishToast = () => {
    setRefreshing(false);
    setRefreshDone(true);
    setTimeout(() => setRefreshDone(false), 1500);
  };

  const reanchorAfterDrift = useCallback(async (sensorValue) => {
    const userId = refs.resolvedUserIdRef.current;
    if (!userId) return;
    const todayKey = toDateKey();
    const entry = await fetchTodayEntry(userId);
    const dbSteps = entry?.steps || 0;
    syncLastSavedFromEntry(entry, setLastSaved);
    refs.dbOffsetRef.current       = dbSteps;
    refs.dbOffsetLoadedRef.current = true;
    refs.lastSavedStepsRef.current = dbSteps;
    refs.currentDateRef.current    = todayKey;
    writeBaseline(todayKey, sensorValue);
    writeSaveAnchors(todayKey, sensorValue, dbSteps);
    refs.todayStepsRef.current    = dbSteps;
    refs.todayCaloriesRef.current = calcCalories(dbSteps);
    setTodaySteps(dbSteps);
    setTodayCalories(calcCalories(dbSteps));
    refs.driftDetectedRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);

  const postRefreshDbResync = useCallback(async (sensorValue) => {
    const userId = refs.resolvedUserIdRef.current;
    if (!userId) return;
    const todayKey = toDateKey();
    const entry = await fetchTodayEntry(userId);
    if (entry?.steps > 0) {
      refs.dbOffsetRef.current       = entry.steps;
      refs.lastSavedStepsRef.current = entry.steps;
      syncLastSavedFromEntry(entry, setLastSaved);
      writeBaseline(todayKey, sensorValue);
      writeSaveAnchors(todayKey, sensorValue, entry.steps);
      refs.processSensorValueRef.current?.(sensorValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshDone(false);

    if (!isNativePlatform) {
      try { await refs.loadDailyHistoryRef.current?.(); }
      catch (e) { console.warn('[StepCounter] Web refresh failed:', e?.message || e); }
      finishToast();
      return;
    }

    try {
      const current = await StepCounterPlugin.getCurrentStepCount();
      const v = Number.parseInt(current?.totalSteps, 10);
      if (!Number.isFinite(v)) return;

      if (refs.driftDetectedRef.current) {
        try { await reanchorAfterDrift(v); }
        catch (e) { console.warn('[StepCounter] Refresh re-sync failed:', e?.message || e); }
      }
      refs.processSensorValueRef.current?.(v);

      if (refs.wrongDateWarningRef.current) {
        console.warn('[StepCounter] Refresh DB save blocked — device date mismatch');
      } else {
        const steps = refs.todayStepsRef.current;
        const userId = refs.resolvedUserIdRef.current;
        if (userId && steps > 0) {
          try {
            await saveStepsForDate({ userId, dateKey: toDateKey(), steps, sensorTotal: v });
          } catch (e) { console.warn('[StepCounter] Refresh save failed:', e?.message || e); }
        }
        await GalleryMonitorPlugin.forceSaveTodaySteps();
      }

      await new Promise((r) => setTimeout(r, 1200));
      try { await postRefreshDbResync(v); }
      catch (e) { console.warn('[StepCounter] Post-refresh DB sync failed:', e?.message || e); }
      await refs.loadDailyHistoryRef.current?.();
    } catch (err) {
      console.error('[StepCounter] Manual refresh failed:', err);
    } finally {
      finishToast();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [isNativePlatform]);

  return { handleManualRefresh };
}
