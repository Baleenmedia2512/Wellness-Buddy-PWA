/**
 * useStepAutoSave.js — owns the two recurring timers.
 *
 * 1. Auto-save tick: fires every AUTO_SAVE_INTERVAL_MS as a safety net so
 *    saves still happen when no sensor events arrive (Doze, throttle, etc.).
 *    The actual save logic + dedup lives in `useStepPersistence`.
 * 2. Midnight reset: schedules a one-shot timer that runs at the next 00:00
 *    local, resets all per-day state, reloads history, then re-arms itself.
 *
 * Both timers are no-ops once cleared on unmount.
 */
import { useCallback } from 'react';
import { writeBaseline } from '../services/stepCounterStorage';
import { toDateKey } from '../services/stepCounterCalculations';
import { AUTO_SAVE_INTERVAL_MS } from '../services/stepCounterConstants';
import { debugLog } from '../../../shared/utils/logger.js';

export function useStepAutoSave({ refs, setTodaySteps, setTodayCalories }) {
  const setupAutoSave = useCallback(() => {
    if (refs.autoSaveTimerRef.current) clearInterval(refs.autoSaveTimerRef.current);
    refs.autoSaveTimerRef.current = setInterval(() => {
      refs.saveStepsToDatabaseRef.current?.();
    }, AUTO_SAVE_INTERVAL_MS);
    debugLog(`[StepCounter] UI timer started (${AUTO_SAVE_INTERVAL_MS / 1000}s interval)`);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);

  const setupMidnightReset = useCallback(() => {
    const now      = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    if (refs.midnightTimerRef.current) clearTimeout(refs.midnightTimerRef.current);
    refs.midnightTimerRef.current = setTimeout(async () => {
      debugLog('[StepCounter] Midnight reset');
      if (refs.latestSensorTotalRef.current !== null) {
        writeBaseline(toDateKey(), refs.latestSensorTotalRef.current);
      }
      refs.todayStepsRef.current     = 0;
      refs.todayCaloriesRef.current  = 0;
      refs.lastSavedStepsRef.current = null;
      refs.dbOffsetRef.current       = 0;
      refs.dbOffsetLoadedRef.current = true;
      refs.currentDateRef.current    = toDateKey();
      setTodaySteps(0);
      setTodayCalories(0);
      await refs.loadDailyHistoryRef.current?.();
      setupMidnightReset(); // re-arm
    }, msUntilMidnight);

    debugLog(`[StepCounter] Midnight reset scheduled in ${Math.floor(msUntilMidnight / 60000)} min`);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);

  return { setupAutoSave, setupMidnightReset };
}
