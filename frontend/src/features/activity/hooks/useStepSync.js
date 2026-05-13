/**
 * useStepSync.js — DB offset load + resume/pause + background backfill.
 *
 * Runs once when `resolvedUserId` becomes truthy. Three phases:
 *   1. Fetch today's DB row, set dbOffset, choose the correct sensor
 *      baseline via `pickReopenBaseline`, unlock the UI
 *   2. Reconcile background-service days via `runBackgroundBackfill`,
 *      then if today was backfilled re-anchor dbOffset + baseline
 *   3. Wire Capacitor 'resume' + window 'focus' to refresh dbOffset and
 *      trigger an immediate sensor read; 'pause' + 'blur' flush a save
 */
import { useEffect, useCallback } from 'react';
import { GalleryMonitorPlugin } from '../../../shared/plugins/galleryMonitorPlugin';
import { StepCounterPlugin } from '../../../shared/plugins/stepCounterPlugin';
import { fetchTodayEntry, saveStepsForDate, syncLastSavedFromEntry } from '../services/stepCounterPersistence';
import { runBackgroundBackfill } from '../services/stepCounterBackfillService';
import { writeBaseline, writeSaveAnchors } from '../services/stepCounterStorage';
import { toDateKey, calcCalories } from '../services/stepCounterCalculations';
import { seedFromDbEntry } from '../services/stepCounterSeed';

export function useStepSync({
  refs, resolvedUserId, isNativePlatform, setLastSaved, setLoading,
  setTodaySteps, setTodayCalories, runDriftCheck, checkDeviceDateVsServer,
}) {
  // Re-anchor dbOffset + baseline after a today-backfill.
  const reanchorAfterBackfill = useCallback((todayBackfillSteps) => {
    const todayKey = toDateKey();
    if (todayBackfillSteps <= refs.dbOffsetRef.current) return;
    refs.dbOffsetRef.current       = todayBackfillSteps;
    refs.lastSavedStepsRef.current = todayBackfillSteps;
    if (refs.latestSensorTotalRef.current !== null) {
      writeSaveAnchors(todayKey, refs.latestSensorTotalRef.current, todayBackfillSteps);
      writeBaseline(todayKey, refs.latestSensorTotalRef.current);
      refs.processSensorValueRef.current?.(refs.latestSensorTotalRef.current);
    } else {
      refs.todayStepsRef.current    = todayBackfillSteps;
      refs.todayCaloriesRef.current = calcCalories(todayBackfillSteps);
      setTodaySteps(todayBackfillSteps);
      setTodayCalories(calcCalories(todayBackfillSteps));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 1+2: load DB offset + run backfill (mount-once per userId)
  useEffect(() => {
    if (!resolvedUserId) return;
    let cancelled = false;

    fetchTodayEntry(resolvedUserId)
      .then((entry) => { if (!cancelled) seedFromDbEntry({
        entry, refs, setLastSaved, setLoading, setTodaySteps, setTodayCalories,
      }); })
      .catch((err) => {
        console.warn('[StepCounter] DB offset load failed:', err);
        refs.dbOffsetLoadedRef.current = true;
        if (refs.latestSensorTotalRef.current !== null) refs.processSensorValueRef.current?.(refs.latestSensorTotalRef.current);
        else setLoading(false);
      });

    refs.loadDailyHistoryRef.current?.();

    runBackgroundBackfill(resolvedUserId)
      .then((toFix) => {
        refs.loadDailyHistoryRef.current?.();
        const todayKey = toDateKey();
        const todayBackfill = toFix.find((e) => e.date === todayKey);
        if (todayBackfill) reanchorAfterBackfill(todayBackfill.steps);
      })
      .catch((err) => console.warn('[StepCounter] Backfill failed:', err));

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId]);

  // Phase 3: app resume / pause handlers (native only)
  useEffect(() => {
    if (!isNativePlatform) return;

    const handleResume = async () => {
      runDriftCheck();
      const now = Date.now();
      if (now - refs.lastResumeTimeRef.current < 2000) return;
      refs.lastResumeTimeRef.current = now;
      try {
        const userId = refs.resolvedUserIdRef.current;
        if (userId) {
          try {
            const entry = await fetchTodayEntry(userId);
            const latestDb = entry?.steps || 0;
            if (latestDb > refs.dbOffsetRef.current) {
              refs.dbOffsetRef.current       = latestDb;
              refs.lastSavedStepsRef.current = latestDb;
              syncLastSavedFromEntry(entry, setLastSaved);
              const sensor = refs.latestSensorTotalRef.current;
              if (sensor !== null) {
                writeBaseline(toDateKey(), sensor);
                writeSaveAnchors(toDateKey(), sensor, latestDb);
              }
            }
          } catch (e) { console.warn('[StepCounter] Resume DB sync failed:', e?.message || e); }
        }
        const cur = await StepCounterPlugin.getCurrentStepCount();
        const v = Number.parseInt(cur?.totalSteps, 10);
        if (Number.isFinite(v)) refs.processSensorValueRef.current?.(v);
        checkDeviceDateVsServer();
      } catch (err) { console.error('[StepCounter] Resume handler failed:', err); }
    };

    const handlePause = () => {
      const steps  = refs.todayStepsRef.current;
      const userId = refs.resolvedUserIdRef.current;
      if (!userId || steps <= 0 || refs.wrongDateWarningRef.current) return;
      const dateOnPause = toDateKey();
      saveStepsForDate({ userId, dateKey: dateOnPause, steps, sensorTotal: refs.latestSensorTotalRef.current })
        .catch(() => {});
      GalleryMonitorPlugin.forceSaveTodaySteps().catch(() => {});
    };

    document.addEventListener('resume', handleResume);
    document.addEventListener('pause',  handlePause);
    window.addEventListener('focus',  handleResume);
    window.addEventListener('blur',   handlePause);
    return () => {
      document.removeEventListener('resume', handleResume);
      document.removeEventListener('pause',  handlePause);
      window.removeEventListener('focus',  handleResume);
      window.removeEventListener('blur',   handlePause);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNativePlatform, runDriftCheck, checkDeviceDateVsServer]);
}
