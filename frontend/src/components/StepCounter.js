import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Activity, Footprints, Flame, ArrowLeft, ShieldAlert, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import { StepCounterPlugin } from '../plugins/stepCounterPlugin';
import { saveDailyActivity, fetchDailyActivity } from '../services/dailyActivityService';
import LoadingSpinner from './LoadingSpinner';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const CALORIES_PER_STEP    = 0.04;
const UPDATE_THROTTLE_MS   = 1000;        // Max one UI update per second
const ACTIVITY_TYPE        = 'walking';
const AUTO_SAVE_INTERVAL_MS = 60_000;     // Auto-save every 60 seconds
const POLL_INTERVAL_MS     = 5000;        // Fallback sensor poll every 5 seconds
const STEP_GOAL            = 10000;
const RING_RADIUS          = 80;
const RING_CIRCUMFERENCE   = 2 * Math.PI * RING_RADIUS;

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS (no React state, safe to call anywhere)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD string for a given Date (or today). */
const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Calories burned from a step count. */
const calcCalories = (steps) => Number((steps * CALORIES_PER_STEP).toFixed(2));

/** localStorage key for the day's sensor baseline. */
const getBaselineKey    = (dateKey) => `step_counter_baseline_${dateKey}`;
const getLastUpdateKey  = ()        => 'step_counter_last_update';

/** Read today's sensor baseline from localStorage. Returns null if absent/invalid. */
const readBaseline = (dateKey) => {
  try {
    const raw    = localStorage.getItem(getBaselineKey(dateKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.sensorTotal) ? parsed : null;
  } catch {
    return null;
  }
};

/** Persist today's sensor baseline to localStorage. */
const writeBaseline = (dateKey, sensorTotal) => {
  localStorage.setItem(
    getBaselineKey(dateKey),
    JSON.stringify({ sensorTotal, savedAt: Date.now(), date: dateKey })
  );
  localStorage.setItem(getLastUpdateKey(), Date.now().toString());
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Main Step Counter Component
 */
const StepCounter = ({ onBack, userId }) => {
  const isNativePlatform = Capacitor.isNativePlatform();

  // ── UI State (display-only; mutated via setters, never read by callbacks) ──
  const [ready, setReady]                   = useState(false);
  const [loading, setLoading]               = useState(true);
  const [sensorAvailable, setSensorAvailable] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [todaySteps, setTodaySteps]         = useState(0);
  const [todayCalories, setTodayCalories]   = useState(0);
  const [lastUpdated, setLastUpdated]       = useState(null);
  const [error, setError]                   = useState(null);
  const [dailyHistory, setDailyHistory]     = useState([]);
  const [saving, setSaving]                 = useState(false);
  const [lastSaved, setLastSaved]           = useState(null);
  const [historyView, setHistoryView]       = useState('week');
  const [refreshing, setRefreshing]         = useState(false); // manual refresh button
  const [refreshDone, setRefreshDone]       = useState(false); // brief "✓" toast after refresh

  // Resolve the real DB userId with multi-source fallback
  const [resolvedUserId, setResolvedUserId] = useState(() => {
    if (userId) return userId;
    const stored = localStorage.getItem('dbUserId');
    return stored ? Number(stored) : null;
  });

  // ── Refs: always-current mirrors / stable handles ──────────────────────────
  //
  // FIX (core): All mutable values that callbacks (save, poll, cleanup) need are
  // mirrored into refs. This means those callbacks can have stable references
  // (no state in their dep arrays), which stops the chain reaction where every
  // step increments todaySteps → recreates saveStepsToDatabase → recreates
  // setupAutoSave → re-runs the main useEffect → tears down and rebuilds the
  // sensor listener and poll on EVERY step.
  //
  const todayStepsRef        = useRef(0);    // mirror of todaySteps state
  const todayCaloriesRef     = useRef(0);    // mirror of todayCalories state
  const resolvedUserIdRef    = useRef(null); // mirror of resolvedUserId state
  const latestSensorTotalRef = useRef(null); // raw cumulative sensor total
  const lastUIUpdateRef      = useRef(0);    // throttle: timestamp of last setState
  const lastSavedStepsRef    = useRef(null); // dedup: prevents redundant DB writes
  // DB offset: today's steps already saved in DB before this session opened.
  // Added on top of sensor-based steps so the counter continues from where it
  // left off rather than resetting to 0 on every fresh app open.
  const dbOffsetRef            = useRef(0);
  // Guard: block UI updates until DB offset is fetched.
  // Prevents showing a wrong (sensor-only) value before DB data arrives.
  const dbOffsetLoadedRef      = useRef(false);

  // Timer and listener handles
  const sensorListenerRef  = useRef(null);
  const pollIntervalRef    = useRef(null);
  const autoSaveTimerRef   = useRef(null);
  const midnightTimerRef   = useRef(null);
  const resolveIntervalRef = useRef(null);

  // Stable function refs — intervals/cleanup always call the LATEST function
  // version without needing it in their dependency arrays.
  const saveStepsToDatabaseRef = useRef(null);
  const processSensorValueRef  = useRef(null);
  const loadDailyHistoryRef    = useRef(null);

  // Sync value mirrors on every render (synchronous, before effects run)
  resolvedUserIdRef.current = resolvedUserId;

  // ─────────────────────────────────────────────────────────────────────────
  // USER-ID RESOLUTION (multi-source fallback: prop → localStorage → API)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (resolvedUserId) return; // already resolved

    let cancelled = false;

    const tryResolve = async () => {
      if (userId) {
        if (!cancelled) setResolvedUserId(userId);
        return true;
      }
      const stored = localStorage.getItem('dbUserId');
      if (stored) {
        console.log('✅ [StepCounter] userId from localStorage:', stored);
        if (!cancelled) setResolvedUserId(Number(stored));
        return true;
      }
      const email = localStorage.getItem('userEmail');
      if (email) {
        try {
          const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
          const res  = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (data.success && data.userId) {
            console.log('✅ [StepCounter] userId from API fallback:', data.userId);
            localStorage.setItem('dbUserId', String(data.userId));
            if (!cancelled) setResolvedUserId(data.userId);
            return true;
          }
        } catch (e) {
          console.warn('[StepCounter] userId API fallback failed:', e.message);
        }
      }
      return false;
    };

    // Try immediately, then poll every 1 s for up to 30 s
    tryResolve().then(resolved => {
      if (resolved || cancelled) return;
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        tryResolve().then(ok => {
          if (ok || attempts >= 30) clearInterval(interval);
        });
      }, 1000);
      resolveIntervalRef.current = interval;
    });

    return () => {
      cancelled = true;
      if (resolveIntervalRef.current) {
        clearInterval(resolveIntervalRef.current);
        resolveIntervalRef.current = null;
      }
    };
  }, [userId, resolvedUserId]);

  // ─────────────────────────────────────────────────────────────────────────
  // SENSOR VALUE PROCESSOR
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * FIX 1: No DB floor logic.
   *   Old code: dailySteps = Math.max(sensorSteps, dbStepsFloor)
   *   This caused the counter to freeze whenever dbStepsFloor > sensorSteps
   *   (e.g. after a reboot, reinstall, or when the auto-save failed to run).
   *
   *   New code: dailySteps = sensor − baseline  (pure, always live)
   *   If the sensor resets below the stored baseline, we detect it and update
   *   the baseline, so the counter starts fresh from 0 for that session.
   *
   * FIX 2: Writes to refs BEFORE calling setState.
   *   This guarantees that any callback running concurrently (save, poll,
   *   cleanup) reads the correct current value even if React hasn't re-rendered.
   */
  const processSensorValue = useCallback((totalSteps) => {
    if (!Number.isFinite(totalSteps)) {
      console.warn('⚠️ [StepCounter] Invalid sensor value:', totalSteps);
      return;
    }

    const todayKey = toDateKey();
    let baseline   = readBaseline(todayKey);

    // First reading of the day → establish baseline
    if (!baseline) {
      writeBaseline(todayKey, totalSteps);
      baseline = { sensorTotal: totalSteps };
      console.log('✅ [StepCounter] Baseline established:', totalSteps);
    }

    // Sensor reset detection: hardware counter was cleared (device reboot / reinstall).
    // totalSteps is now smaller than our stored baseline → update baseline to match.
    if (totalSteps < baseline.sensorTotal) {
      console.log('🔄 [StepCounter] Sensor reset — updating baseline from', baseline.sensorTotal, 'to', totalSteps);
      writeBaseline(todayKey, totalSteps);
      baseline = { sensorTotal: totalSteps };
    }

    // Calculate steps this sensor session (since baseline was set this app open)
    const sensorSteps = Math.max(0, Math.floor(totalSteps - baseline.sensorTotal));
    // Add DB offset: steps already recorded in DB from earlier sessions today.
    // This means when the app opens and sensor starts at 0 relative to baseline,
    // we still display the correct cumulative daily total (e.g. 3311 + new steps).
    const dailySteps = dbOffsetRef.current + sensorSteps;
    const calories   = calcCalories(dailySteps);

    // Update refs synchronously FIRST so any concurrent callback sees the latest values
    latestSensorTotalRef.current = totalSteps;
    todayStepsRef.current        = dailySteps;
    todayCaloriesRef.current     = calories;

    // Hold UI update until DB offset is loaded — avoids showing a wrong value
    // on first open while the DB fetch is still in-flight.
    if (!dbOffsetLoadedRef.current) return;

    // Throttle React state updates to at most once per UPDATE_THROTTLE_MS
    const now = Date.now();
    if (now - lastUIUpdateRef.current >= UPDATE_THROTTLE_MS || lastUIUpdateRef.current === 0) {
      lastUIUpdateRef.current = now;
      setTodaySteps(dailySteps);
      setTodayCalories(calories);
      setLastUpdated(new Date());
      setLoading(false);
    }

    console.log('🚶 [StepCounter]', { dailySteps, calories, totalSteps, baseline: baseline.sensorTotal });
  }, []); // Stable — reads/writes only refs and localStorage, no state deps

  // ─────────────────────────────────────────────────────────────────────────
  // DATABASE: SAVE
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * FIX 3: Reads todayStepsRef.current (ref) instead of todaySteps (state).
   *
   *   Old code depended on todaySteps state, so every step update recreated
   *   this function → recreated setupAutoSave → re-ran the main useEffect →
   *   rebuilt the sensor listener. The auto-save interval was reset on every
   *   step and therefore NEVER fired during normal walking.
   *
   *   New code reads from refs: the function reference never changes, the
   *   auto-save interval runs undisturbed for the full 60 seconds.
   */
  const saveStepsToDatabase = useCallback(async () => {
    const userId   = resolvedUserIdRef.current;
    const steps    = todayStepsRef.current;
    const calories = todayCaloriesRef.current;

    if (!userId || steps === 0) return;

    // Dedup guard — skip DB write if nothing has changed since last save
    if (lastSavedStepsRef.current === steps) {
      console.log('⏭️ [StepCounter] Auto-save skipped — steps unchanged at', steps);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        userId,
        activityDate:        toDateKey(),
        steps,
        activityType:        ACTIVITY_TYPE,
        caloriesBurned:      calories,
        currentSensorTotal:  latestSensorTotalRef.current
      };
      console.log('💾 [StepCounter] Saving to DB:', payload);
      await saveDailyActivity(payload);
      lastSavedStepsRef.current = steps;
      setLastSaved(new Date());
      console.log('✅ [StepCounter] Saved:', steps, 'steps');
    } catch (err) {
      console.error('❌ [StepCounter] Save failed:', err);
      setError(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, []); // Stable — reads all values from refs, no state in deps

  // ─────────────────────────────────────────────────────────────────────────
  // DATABASE: FETCH HISTORY
  // ─────────────────────────────────────────────────────────────────────────
  const loadDailyHistory = useCallback(async () => {
    const userId = resolvedUserIdRef.current;
    if (!userId) return;
    try {
      const response = await fetchDailyActivity(userId, 30, ACTIVITY_TYPE);
      const trend    = response.trend || response.data;
      if (response.success && Array.isArray(trend)) {
        setDailyHistory(trend.map(d => ({ ...d, calories: d.caloriesBurned ?? d.calories ?? 0 })));
      }
    } catch (err) {
      console.error('❌ [StepCounter] Load history failed:', err);
    }
  }, []); // Stable — reads userId from ref

  // ─────────────────────────────────────────────────────────────────────────
  // MANUAL REFRESH (Requirement 6)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Fallback for when Android Doze or background throttle delays sensor events.
   * User taps the refresh icon in the header to force an immediate sensor read.
   */
  const handleManualRefresh = useCallback(async () => {
    if (!isNativePlatform) return;
    setRefreshing(true);
    setRefreshDone(false);
    try {
      const current = await StepCounterPlugin.getCurrentStepCount();
      const val     = Number.parseInt(current?.totalSteps, 10);
      if (Number.isFinite(val)) {
        processSensorValueRef.current?.(val);
        console.log('🔄 [StepCounter] Manual refresh — sensor total:', val);
      }
    } catch (err) {
      console.error('❌ [StepCounter] Manual refresh failed:', err);
    } finally {
      setRefreshing(false);
      // Show a brief "Done" indicator for 1.5 s so the user sees feedback
      setRefreshDone(true);
      setTimeout(() => setRefreshDone(false), 1500);
    }
  }, [isNativePlatform]);

  // ─────────────────────────────────────────────────────────────────────────
  // SENSOR INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * FIX 4: Uses processSensorValueRef.current inside the listener and poll
   * callbacks instead of capturing processSensorValue directly (which would
   * create a dependency chain). With this pattern:
   *   - initStepTracking has NO state deps → it is stable (deps: [])
   *   - The listener and poll always call the latest processSensorValue via ref
   *   - Re-calling initStepTracking (e.g. after permission grant) safely
   *     removes the old listener before adding a new one
   */
  const initStepTracking = useCallback(async () => {
    console.log('🔧 [StepCounter] Initializing step tracking...');
    try {
      const availability = await StepCounterPlugin.isAvailable();
      const available    = !!availability?.available;
      setSensorAvailable(available);

      if (!available) {
        setPermissionGranted(false);
        setLoading(false);
        return;
      }

      const permission = await StepCounterPlugin.getPermissionStatus();
      const granted    = !!permission?.granted;
      setPermissionGranted(granted);

      if (!granted) {
        setLoading(false);
        return;
      }

      await StepCounterPlugin.startTracking();

      // Remove any existing listener before attaching a new one
      if (sensorListenerRef.current) {
        await sensorListenerRef.current.remove();
        sensorListenerRef.current = null;
      }

      // Push-based: native sensor fires stepUpdate events when steps change
      sensorListenerRef.current = await StepCounterPlugin.addListener('stepUpdate', (event) => {
        const steps = Number.parseInt(event?.totalSteps, 10);
        if (Number.isFinite(steps)) {
          // Call via ref so the listener never holds a stale closure
          processSensorValueRef.current?.(steps);
        } else {
          console.warn('⚠️ [StepCounter] Invalid stepUpdate payload:', event);
        }
      });

      // Seed the UI with the current value immediately on open
      const current      = await StepCounterPlugin.getCurrentStepCount();
      const currentValue = Number.parseInt(current?.totalSteps, 10);
      if (Number.isFinite(currentValue)) {
        processSensorValueRef.current?.(currentValue);
      } else {
        setLoading(false);
      }

      // Safety: ensure loading spinner is cleared after 3 s even if sensor is silent
      setTimeout(() => setLoading(false), 3000);

      // Pull-based fallback: handles Android Doze / background throttle where
      // push events are delayed. Polls every POLL_INTERVAL_MS.
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const c = await StepCounterPlugin.getCurrentStepCount();
          const v = Number.parseInt(c?.totalSteps, 10);
          if (Number.isFinite(v)) processSensorValueRef.current?.(v);
        } catch (e) {
          console.warn('⚠️ [StepCounter] Poll failed:', e.message);
        }
      }, POLL_INTERVAL_MS);

      console.log('✅ [StepCounter] Sensor initialized with push + poll fallback');
    } catch (err) {
      console.error('❌ [StepCounter] initStepTracking failed:', err);
      setError('Failed to initialize step counter');
      setLoading(false);
    }
  }, []); // Stable — no state deps; uses processSensorValueRef internally

  // ─────────────────────────────────────────────────────────────────────────
  // PERMISSION REQUEST
  // ─────────────────────────────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    try {
      const permission = await StepCounterPlugin.requestPermission();
      const granted    = !!permission?.granted;
      setPermissionGranted(granted);
      if (granted) await initStepTracking();
    } catch (err) {
      console.error('❌ [StepCounter] Permission request failed:', err);
      setError('Failed to get permission');
    }
  }, [initStepTracking]); // initStepTracking is stable

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE TIMER
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * FIX 5: Uses saveStepsToDatabaseRef.current in the interval body.
   *   Old: setInterval called saveStepsToDatabase directly → that function
   *        depended on todaySteps state → interval was re-created on every step
   *        → never actually ticked to 60 s during walking.
   *   New: interval body calls the ref → always latest save function, zero deps,
   *        interval runs undisturbed for its full 60-second lifetime.
   */
  const setupAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setInterval(() => {
      saveStepsToDatabaseRef.current?.();
    }, AUTO_SAVE_INTERVAL_MS);
    console.log(`💾 [StepCounter] Auto-save timer started (${AUTO_SAVE_INTERVAL_MS / 1000}s interval)`);
  }, []); // Stable — interval body only references a ref

  // ─────────────────────────────────────────────────────────────────────────
  // MIDNIGHT RESET TIMER
  // ─────────────────────────────────────────────────────────────────────────
  const setupMidnightReset = useCallback(() => {
    const now             = new Date();
    const tomorrow        = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);

    midnightTimerRef.current = setTimeout(async () => {
      console.log('🌙 [StepCounter] Midnight reset');

      // Save final steps of the day — reads from refs, not stale state
      await saveStepsToDatabaseRef.current?.();

      // Write new day's baseline using the last known raw sensor total
      if (latestSensorTotalRef.current !== null) {
        writeBaseline(toDateKey(), latestSensorTotalRef.current);
      }

      // Reset counters for the new day
      todayStepsRef.current     = 0;
      todayCaloriesRef.current  = 0;
      lastSavedStepsRef.current = null;
      setTodaySteps(0);
      setTodayCalories(0);

      // Reload history to include the completed day
      await loadDailyHistoryRef.current?.();

      // Re-schedule for the next midnight
      setupMidnightReset();
    }, msUntilMidnight);

    console.log(`⏰ [StepCounter] Midnight reset scheduled in ${Math.floor(msUntilMidnight / 60000)} min`);
  }, []); // Stable — uses only refs and reschedules itself

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC FUNCTION REFS (runs synchronously on every render, before effects)
  // ─────────────────────────────────────────────────────────────────────────
  // This ensures that intervals, listeners, and cleanup closures always invoke
  // the most up-to-date version of each callback, even if the reference changed.
  saveStepsToDatabaseRef.current = saveStepsToDatabase;
  processSensorValueRef.current  = processSensorValue;
  loadDailyHistoryRef.current    = loadDailyHistory;

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECT 1: SENSOR LIFECYCLE — runs ONCE on mount / cleans up on unmount
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * FIX 6 (root cause): Empty deps array.
   *   Old code had todaySteps and saveStepsToDatabase in the dep array.
   *   Every step update → todaySteps changed → saveStepsToDatabase recreated →
   *   setupAutoSave recreated → this effect re-ran → sensor listener torn down
   *   and rebuilt → counter appeared stuck mid-walk during the re-init window.
   *
   *   All callbacks called here are stable (deps: []) so listing them in deps
   *   would be equivalent to []. We use [] explicitly and suppress the lint
   *   warning to make the intent clear.
   */
  useEffect(() => {
    if (isNativePlatform) {
      initStepTracking();
    } else {
      setLoading(false);
    }
    setupMidnightReset();
    setReady(true);

    return () => {
      // FIX 7: Save using ref (latest steps), not stale todaySteps state
      if (todayStepsRef.current > 0) {
        saveStepsToDatabaseRef.current?.().catch(() => {});
      }
      // Tear down all timers and the native sensor listener
      if (midnightTimerRef.current)  clearTimeout(midnightTimerRef.current);
      if (autoSaveTimerRef.current)  clearInterval(autoSaveTimerRef.current);
      if (pollIntervalRef.current)   clearInterval(pollIntervalRef.current);
      if (isNativePlatform) {
        StepCounterPlugin.stopTracking().catch(() => {});
        sensorListenerRef.current?.remove().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — sensor lifecycle tied to component mount only

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECT 2: DB + AUTO-SAVE — runs once when userId resolves
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedUserId) return;

    // Load today's DB steps as the starting offset for this session.
    // This ensures the counter shows the correct cumulative total on fresh
    // app opens instead of starting from 0 each time.
    fetchDailyActivity(resolvedUserId, 1, ACTIVITY_TYPE)
      .then((response) => {
        const trend = response.trend || response.data;
        if (response.success && Array.isArray(trend)) {
          const todayKey   = toDateKey();
          const todayEntry = trend.find((d) => d.date === todayKey);
          if (todayEntry && todayEntry.steps > 0) {
            dbOffsetRef.current = todayEntry.steps;
            // Update lastSavedStepsRef so the first auto-save doesn't
            // re-save the same DB value we just loaded.
            lastSavedStepsRef.current = todayEntry.steps;
            console.log('🗄️ [StepCounter] DB offset loaded:', todayEntry.steps);
            // Unlock UI — from this point processSensorValue will update the display
            dbOffsetLoadedRef.current = true;
            if (latestSensorTotalRef.current !== null) {
              // Sensor already fired with wrong offset — reprocess to get correct value
              processSensorValueRef.current?.(latestSensorTotalRef.current);
            } else {
              // Sensor hasn't fired yet — seed UI directly from DB
              const offsetCalories = calcCalories(todayEntry.steps);
              todayStepsRef.current    = todayEntry.steps;
              todayCaloriesRef.current = offsetCalories;
              setTodaySteps(todayEntry.steps);
              setTodayCalories(offsetCalories);
              setLoading(false);
            }
          }
        }
      })
      .catch((err) => {
        console.warn('⚠️ [StepCounter] Failed to load DB offset:', err);
        // DB fetch failed — unlock UI anyway so sensor value is shown
        dbOffsetLoadedRef.current = true;
        if (latestSensorTotalRef.current !== null) {
          processSensorValueRef.current?.(latestSensorTotalRef.current);
        } else {
          setLoading(false);
        }
      });

    loadDailyHistoryRef.current?.();
    setupAutoSave(); // starts the 60-second save interval
  }, [resolvedUserId, setupAutoSave]); // setupAutoSave is stable (deps: [])

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECT 3: APP RESUME / FOREGROUND HANDLER (Requirement 7)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNativePlatform) return;

    const handleResume = async () => {
      console.log('📱 [StepCounter] App resumed — refreshing sensor');
      try {
        const current      = await StepCounterPlugin.getCurrentStepCount();
        const currentValue = Number.parseInt(current?.totalSteps, 10);
        if (Number.isFinite(currentValue)) {
          // Update UI via ref (always calls the latest processSensorValue)
          processSensorValueRef.current?.(currentValue);
          // Immediately persist — reads from refs so no stale-closure risk
          await saveStepsToDatabaseRef.current?.();
        }
      } catch (err) {
        console.error('❌ [StepCounter] Resume handler failed:', err);
      }
    };

    document.addEventListener('resume', handleResume);
    window.addEventListener('focus', handleResume);
    return () => {
      document.removeEventListener('resume', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [isNativePlatform]); // isNativePlatform is a stable constant

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED DISPLAY VALUES
  // ─────────────────────────────────────────────────────────────────────────
  const stepProgress = Math.min(todaySteps / STEP_GOAL, 1);
  const ringOffset   = RING_CIRCUMFERENCE * (1 - stepProgress);
  const historyData  = historyView === 'week' ? dailyHistory.slice(-7) : dailyHistory;

  if (loading && !ready) {
    return <LoadingSpinner context="steps" />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/40">

      {/* ──── Header ──── */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-emerald-100/50 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-2 rounded-xl shadow-sm">
              <Footprints className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">Step Counter</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Manual Refresh Button — fallback for Android Doze delays */}
            {isNativePlatform && permissionGranted && (
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                aria-label="Refresh steps"
                title="Refresh Steps"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95
                  ${
                    refreshDone
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                      : refreshing
                      ? 'bg-emerald-100 text-emerald-600 cursor-not-allowed'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:shadow-sm'
                  }`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    refreshing ? 'animate-spin' : refreshDone ? '' : ''
                  }`}
                />
                <span>
                  {refreshing ? 'Refreshing…' : refreshDone ? '✓ Updated' : 'Refresh'}
                </span>
              </button>
            )}
            {saving && (
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Saving..." />
            )}
          </div>
        </div>
      </div>

      {/* ──── Content ──── */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-4 sm:space-y-5">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Permission banner */}
        {isNativePlatform && sensorAvailable && !permissionGranted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">Permission Required</p>
                <p className="text-xs text-amber-700 mb-3">Allow activity recognition to track your steps.</p>
                <button
                  onClick={requestPermission}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Grant Permission
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──── Circular Progress Ring + Stats ──── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
          <div className="flex flex-col items-center">
            {/* Ring */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 mb-4">
              {loading ? (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 animate-pulse" />
              ) : (
                <>
                  <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                    <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                      cx="100" cy="100" r={RING_RADIUS} fill="none"
                      stroke="url(#stepGradient)" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
                      className="transition-all duration-700 ease-out"
                    />
                    <defs>
                      <linearGradient id="stepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Footprints className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 mb-1" />
                    <p className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-none">
                      {todaySteps.toLocaleString()}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">
                      / {STEP_GOAL.toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Goal progress text */}
            {!loading && (
              <p className="text-sm text-gray-500 font-medium mb-1">
                {stepProgress >= 1
                  ? '🎉 Goal reached!'
                  : `${Math.round(stepProgress * 100)}% of daily goal`}
              </p>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-emerald-50 rounded-2xl p-3.5 sm:p-4 text-center">
              <Footprints className="w-4 h-4 text-emerald-600 mx-auto mb-1.5" />
              {loading ? (
                <div className="h-6 w-16 bg-emerald-200/60 rounded-lg animate-pulse mx-auto" />
              ) : (
                <p className="text-lg sm:text-xl font-bold text-emerald-900">{todaySteps.toLocaleString()}</p>
              )}
              <p className="text-xs text-emerald-600 mt-0.5 font-medium">Steps</p>
            </div>
            <div className="bg-rose-50 rounded-2xl p-3.5 sm:p-4 text-center">
              <Flame className="w-4 h-4 text-rose-500 mx-auto mb-1.5" />
              {loading ? (
                <div className="h-6 w-16 bg-rose-200/60 rounded-lg animate-pulse mx-auto" />
              ) : (
                <p className="text-lg sm:text-xl font-bold text-rose-900">{todayCalories}</p>
              )}
              <p className="text-xs text-rose-500 mt-0.5 font-medium">Calories</p>
            </div>
          </div>

          {/* Last updated / saved status line */}
          {!loading && (lastUpdated || lastSaved) && (
            <p className="text-center text-xs text-gray-400 mt-3">
              {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
              {lastSaved   && ` · Saved ${lastSaved.toLocaleTimeString()}`}
            </p>
          )}
        </div>

        {/* ──── History Section ──── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
          {/* Header + Toggle */}
          <div className="flex items-center justify-between mb-4">
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

          {historyData.length > 0 ? (
            <>
              {/* Summary Row */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-xs text-gray-500 font-medium">Avg Steps</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">
                    {Math.round(
                      historyData.reduce((sum, day) => {
                        const isToday = toDateKey(new Date(day.date)) === toDateKey();
                        return sum + (isToday ? todaySteps : (day.steps || 0));
                      }, 0) / historyData.length
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <p className="text-xs text-gray-500 font-medium">Total Calories</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-rose-600">
                    {Math.round(
                      historyData.reduce((sum, day) => {
                        const isToday = toDateKey(new Date(day.date)) === toDateKey();
                        return sum + (isToday ? todayCalories : (day.calories || 0));
                      }, 0)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Daily List */}
              <div className="mt-4 space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
                {[...historyData].reverse().map((day) => {
                  const date            = new Date(day.date);
                  const isToday         = toDateKey(date) === toDateKey();
                  const displaySteps    = isToday ? todaySteps    : (day.steps    || 0);
                  const displayCalories = isToday ? todayCalories : (day.calories || 0);

                  return (
                    <div
                      key={day.date}
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                        isToday ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                          isToday ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gray-300'
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
                        <p className="text-sm font-bold text-gray-900">{displaySteps.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{displayCalories} kcal</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400 font-medium">No activity data yet</p>
              <p className="text-xs text-gray-300 mt-1">Start walking to see your history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepCounter;