/**
 * useStepRefs.js — single bag of mutable refs shared by every step counter
 * hook. Created once on mount; never re-created. Hooks consume what they
 * need and the master `useStepCounter` aggregates them.
 *
 * Why one bag instead of N:
 *   - The original component had ~40 refs that every callback touched.
 *   - Splitting them across hooks would require either prop-drilling each
 *     ref individually or a context, both of which add noise without
 *     reducing complexity.
 *   - A single ref bag keeps each consuming hook's signature short and
 *     allows callbacks to remain stable (deps: []).
 */
import { useRef } from 'react';
import { toDateKey } from '../services/stepCounterCalculations';
import { readPersistedDistance } from '../services/stepCounterStorage';

export function useStepRefs() {
  // Mirrors of state — read by callbacks that must not depend on state
  const todayStepsRef        = useRef(0);
  const todayCaloriesRef     = useRef(0);
  const resolvedUserIdRef    = useRef(null);
  const wrongDateWarningRef  = useRef(null);
  const suspiciousActivityRef = useRef(null);

  // Sensor state
  const latestSensorTotalRef = useRef(null);
  const lastUIUpdateRef      = useRef(0);
  const lastSavedStepsRef    = useRef(null);
  const lastAutoSaveTimeRef  = useRef(0);
  const dbOffsetRef          = useRef(0);
  const dbOffsetLoadedRef    = useRef(false);
  const currentDateRef       = useRef(toDateKey());
  const lastPushTimestampRef = useRef(0);
  const lastResumeTimeRef    = useRef(0);
  const driftDetectedRef     = useRef(false);

  // Timer / listener handles
  const sensorListenerRef  = useRef(null);
  const pollIntervalRef    = useRef(null);
  const autoSaveTimerRef   = useRef(null);
  const midnightTimerRef   = useRef(null);
  const resolveIntervalRef = useRef(null);
  const gpsIntervalRef     = useRef(null);

  // Anti-cheat scoring state
  const acScoreRef            = useRef(0);
  const acEventTimesRef       = useRef([]);
  const acLastGpsMovedRef     = useRef(true);
  const acQuarantinedStepsRef = useRef(0);
  const acSustainedStartRef   = useRef(null);
  const acLastCleanWindowRef  = useRef(0);

  // GPS / outdoor distance
  const outdoorDistanceRef    = useRef(readPersistedDistance(toDateKey()));
  const lastAcceptedGpsPtRef  = useRef(null);
  const gpsLastTsRef          = useRef(0);
  const routeDateRef          = useRef(toDateKey());
  const stepRateWindowRef     = useRef([]);

  // Outdoor steps tracking
  const outdoorStepsRef             = useRef(0);
  const outdoorSessionStartStepsRef = useRef(null);
  const outdoorLastIsOutdoorRef     = useRef(false);

  // Stable callback references (filled in by master hook)
  const saveStepsToDatabaseRef  = useRef(null);
  const processSensorValueRef   = useRef(null);
  const loadDailyHistoryRef     = useRef(null);

  return {
    todayStepsRef, todayCaloriesRef, resolvedUserIdRef,
    wrongDateWarningRef, suspiciousActivityRef,
    latestSensorTotalRef, lastUIUpdateRef, lastSavedStepsRef,
    lastAutoSaveTimeRef, dbOffsetRef, dbOffsetLoadedRef, currentDateRef,
    lastPushTimestampRef, lastResumeTimeRef, driftDetectedRef,
    sensorListenerRef, pollIntervalRef, autoSaveTimerRef, midnightTimerRef,
    resolveIntervalRef, gpsIntervalRef,
    acScoreRef, acEventTimesRef, acLastGpsMovedRef, acQuarantinedStepsRef,
    acSustainedStartRef, acLastCleanWindowRef,
    outdoorDistanceRef, lastAcceptedGpsPtRef, gpsLastTsRef, routeDateRef, stepRateWindowRef,
    outdoorStepsRef, outdoorSessionStartStepsRef, outdoorLastIsOutdoorRef,
    saveStepsToDatabaseRef, processSensorValueRef, loadDailyHistoryRef,
  };
}
