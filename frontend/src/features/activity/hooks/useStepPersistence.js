/**
 * useStepPersistence.js — saves today's step total to the DB.
 *
 * Stable callback: reads everything from refs so the deps array is empty
 * and the function reference never changes between renders. The sensor
 * processor calls this directly on every step delta; the auto-save timer
 * calls it every 30 s.
 *
 * Guard rails preserved verbatim from the original component:
 *   - Min delta of AUTO_SAVE_STEP_DELTA (10) before any save
 *   - 30 s throttle between successive saves
 *   - Blocked entirely when wrongDateWarningRef is set
 *   - Optimistic update of lastSavedStepsRef, rolled back on failure
 */
import { useCallback } from 'react';
import { saveStepsForDate } from '../services/stepCounterPersistence';
import { toDateKey } from '../services/stepCounterCalculations';
import { AUTO_SAVE_STEP_DELTA, AUTO_SAVE_INTERVAL_MS } from '../services/stepCounterConstants';
import { debugLog } from '../../../shared/utils/logger.js';

export function useStepPersistence({ refs }) {
  const saveStepsToDatabase = useCallback(async () => {
    const userId = refs.resolvedUserIdRef.current;
    if (!userId) return;
    const steps = refs.todayStepsRef.current;
    if (steps <= 0) return;
    if (refs.wrongDateWarningRef.current) {
      console.warn('[StepCounter] Auto-save blocked — device date mismatch');
      return;
    }

    const lastSaved = refs.lastSavedStepsRef.current ?? 0;
    const delta     = steps - lastSaved;
    if (delta < AUTO_SAVE_STEP_DELTA) return;

    const now = Date.now();
    if (now - refs.lastAutoSaveTimeRef.current < AUTO_SAVE_INTERVAL_MS) return;

    refs.lastAutoSaveTimeRef.current = now;
    refs.lastSavedStepsRef.current   = steps; // optimistic

    try {
      await saveStepsForDate({
        userId,
        dateKey: toDateKey(),
        steps,
        sensorTotal: refs.latestSensorTotalRef.current,
      });
      debugLog('[StepCounter] Auto-save:', steps, 'steps (+' + delta + ')');
    } catch (err) {
      refs.lastSavedStepsRef.current = lastSaved; // rollback
      console.warn('[StepCounter] Auto-save failed:', err?.message || err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);

  return { saveStepsToDatabase };
}
