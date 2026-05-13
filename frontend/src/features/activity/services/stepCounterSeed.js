/**
 * stepCounterSeed.js — seeds the in-app counter from the DB row fetched on
 * mount. Picks the right sensor baseline (via `pickReopenBaseline`),
 * unlocks the UI, and either re-processes the sensor value or seeds the
 * UI directly from the DB number.
 *
 * Lives in the services layer because it's pure-ish glue: it mutates the
 * refs it's handed but contains no React, no async, no event listeners.
 */
import { pickReopenBaseline } from './stepCounterBaselineMath';
import { syncLastSavedFromEntry } from './stepCounterPersistence';
import { writeBaseline, readSaveAnchors } from './stepCounterStorage';
import { toDateKey, calcCalories } from './stepCounterCalculations';

export const seedFromDbEntry = ({
  entry, refs, setLastSaved, setLoading, setTodaySteps, setTodayCalories,
}) => {
  const todayKey = toDateKey();
  syncLastSavedFromEntry(entry, setLastSaved);

  if (entry && entry.steps > 0) {
    refs.dbOffsetRef.current       = entry.steps;
    refs.lastSavedStepsRef.current = entry.steps;
    refs.dbOffsetLoadedRef.current = true;
    const currentSensor = refs.latestSensorTotalRef.current;
    if (currentSensor !== null) {
      const { savedSensor, savedSteps } = readSaveAnchors(todayKey);
      const baselineToUse = pickReopenBaseline({
        currentSensor, savedSensor, savedSteps,
        dbStepsToday: entry.steps,
        driftDetected: refs.driftDetectedRef.current,
      });
      writeBaseline(todayKey, baselineToUse);
      refs.processSensorValueRef.current?.(currentSensor);
    } else {
      refs.todayStepsRef.current    = entry.steps;
      refs.todayCaloriesRef.current = calcCalories(entry.steps);
      setTodaySteps(entry.steps);
      setTodayCalories(calcCalories(entry.steps));
      setLoading(false);
    }
  } else {
    refs.dbOffsetLoadedRef.current = true;
    if (refs.latestSensorTotalRef.current !== null) {
      refs.processSensorValueRef.current?.(refs.latestSensorTotalRef.current);
    } else {
      setLoading(false);
    }
  }
};
