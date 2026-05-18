/**
 * useStepSensor.js — Capacitor sensor lifecycle + sensor value processor.
 *
 * Owns:
 *   - StepCounterPlugin availability + listener attach/detach
 *   - Push-based stepUpdate listener
 *   - Pull-based fallback poll (POLL_INTERVAL_MS) for Android Doze cases
 *   - processSensorValue: baseline math, midnight rollover, anti-cheat,
 *     quarantine, throttled UI update, auto-save trigger
 *
 * No DB access here — all persistence flows through useStepPersistence.
 */
import { useCallback } from 'react';
import { StepCounterPlugin } from '../../../shared/plugins/stepCounterPlugin';
import { runAntiCheatEngine } from '../services/stepCounterAntiCheat';
import { readBaseline, writeBaseline } from '../services/stepCounterStorage';
import { toDateKey, calcCalories } from '../services/stepCounterCalculations';
import {
import { debugLog } from '../../../shared/utils/logger.js';
  POLL_INTERVAL_MS, UPDATE_THROTTLE_MS, AC_QUARANTINE_RATIO,
} from '../services/stepCounterConstants';

export function useStepSensor({
  refs, setSensorAvailable, setPermissionGranted, setLoading, setError,
  setTodaySteps, setTodayCalories, setLastUpdated, setSuspiciousActivity,
}) {
  const processSensorValue = useCallback((totalSteps) => {
    if (!Number.isFinite(totalSteps)) return;
    const todayKey = toDateKey();

    // Midnight rollover
    if (todayKey !== refs.currentDateRef.current) {
      debugLog('[StepCounter] Day rollover:', refs.currentDateRef.current, '→', todayKey);
      refs.currentDateRef.current = todayKey;
      refs.dbOffsetRef.current = 0;
      refs.dbOffsetLoadedRef.current = true;
      refs.lastSavedStepsRef.current = null;
      refs.todayStepsRef.current = 0;
      refs.todayCaloriesRef.current = 0;
      setTodaySteps(0);
      setTodayCalories(0);
    }

    let baseline = readBaseline(todayKey);
    if (!baseline) { writeBaseline(todayKey, totalSteps); baseline = { sensorTotal: totalSteps }; }
    if (totalSteps < baseline.sensorTotal) {
      debugLog('[StepCounter] Sensor reset — re-baseline', baseline.sensorTotal, '→', totalSteps);
      writeBaseline(todayKey, totalSteps);
      baseline = { sensorTotal: totalSteps };
    }

    const sensorSteps   = Math.max(0, Math.floor(totalSteps - baseline.sensorTotal));
    const rawDailySteps = refs.dbOffsetRef.current + sensorSteps;

    const ac = runAntiCheatEngine(refs);
    let dailySteps = rawDailySteps;
    if (ac.shouldBlock) {
      const prevCommitted = refs.lastSavedStepsRef.current ?? refs.dbOffsetRef.current ?? 0;
      const newRaw = rawDailySteps - prevCommitted;
      if (newRaw > 0) {
        const allowed = Math.floor(newRaw * (1 - AC_QUARANTINE_RATIO));
        refs.acQuarantinedStepsRef.current += (newRaw - allowed);
        dailySteps = prevCommitted + allowed;
        console.warn(`[AntiCheat] Quarantine +${newRaw} → +${allowed} (score=${ac.score})`);
      }
    }

    const newWarning = ac.shouldBlock ? 'fake_detected' : ac.shouldWarn ? 'high_step_rate' : null;
    if (newWarning !== refs.suspiciousActivityRef.current) {
      refs.suspiciousActivityRef.current = newWarning;
      setSuspiciousActivity(newWarning);
    }

    const calories = calcCalories(dailySteps);
    refs.latestSensorTotalRef.current = totalSteps;
    refs.todayStepsRef.current = dailySteps;
    refs.todayCaloriesRef.current = calories;

    if (!refs.dbOffsetLoadedRef.current) return;
    refs.saveStepsToDatabaseRef.current?.();

    const now = Date.now();
    if (now - refs.lastUIUpdateRef.current >= UPDATE_THROTTLE_MS || refs.lastUIUpdateRef.current === 0) {
      refs.lastUIUpdateRef.current = now;
      setTodaySteps(dailySteps);
      setTodayCalories(calories);
      setLastUpdated(new Date());
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps // intentional: listed deps would cause an infinite re-render // intentional: adding this dep causes an infinite re-render loop
  }, []);

  const initStepTracking = useCallback(async () => {
    try {
      const availability = await StepCounterPlugin.isAvailable();
      const available    = !!availability?.available;
      setSensorAvailable(available);
      if (!available) { setPermissionGranted(false); setLoading(false); return; }

      const permission = await StepCounterPlugin.getPermissionStatus();
      const granted    = !!permission?.granted;
      setPermissionGranted(granted);
      if (!granted) { setLoading(false); return; }

      await StepCounterPlugin.startTracking();
      if (refs.sensorListenerRef.current) { await refs.sensorListenerRef.current.remove(); refs.sensorListenerRef.current = null; }

      refs.sensorListenerRef.current = await StepCounterPlugin.addListener('stepUpdate', (event) => {
        const v = Number.parseInt(event?.totalSteps, 10);
        if (Number.isFinite(v)) {
          refs.lastPushTimestampRef.current = Date.now();
          refs.processSensorValueRef.current?.(v);
        }
      });

      const current = await StepCounterPlugin.getCurrentStepCount();
      const v = Number.parseInt(current?.totalSteps, 10);
      if (Number.isFinite(v)) refs.processSensorValueRef.current?.(v); else setLoading(false);
      setTimeout(() => setLoading(false), 3000);

      if (refs.pollIntervalRef.current) clearInterval(refs.pollIntervalRef.current);
      refs.pollIntervalRef.current = setInterval(async () => {
        if (Date.now() - refs.lastPushTimestampRef.current < POLL_INTERVAL_MS * 2) return;
        try {
          const c = await StepCounterPlugin.getCurrentStepCount();
          const cv = Number.parseInt(c?.totalSteps, 10);
          if (Number.isFinite(cv)) refs.processSensorValueRef.current?.(cv);
        } catch (e) { console.warn('[StepCounter] Poll failed:', e.message); }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      console.error('[StepCounter] initStepTracking failed:', err);
      setError('Failed to initialize step counter');
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps // intentional: listed deps would cause an infinite re-render // intentional: adding this dep causes an infinite re-render loop
  }, []);

  return { processSensorValue, initStepTracking };
}
