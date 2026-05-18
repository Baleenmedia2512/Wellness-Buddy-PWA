import { debugLog } from '../../../shared/utils/logger.js';

/**
 * stepCounterBaselineMath.js — picks the correct sensor baseline on app open.
 *
 * Pure function: takes the inputs the original component computed inline
 * during the DB-offset load effect and returns the chosen baseline.
 *
 *   currentSensor — current raw sensor total
 *   savedSensor   — sensor total at the last successful save (may be null)
 *   savedSteps    — DB step total at the last successful save (may be null)
 *   dbStepsToday  — DB step total now (after any backfill)
 *   driftDetected — silent drift flag from time guard
 *
 * Strategy:
 *   - If drift was detected, force baseline = currentSensor (no carry-over)
 *   - Otherwise prefer savedSensor adjusted by background-added steps
 *     (DB minus our last savedSteps), provided the unsaved gap looks sane
 *   - Falls back to currentSensor when stored anchors are missing/stale
 */
const MAX_UNSAVED = 3000;

export const pickReopenBaseline = ({
  currentSensor, savedSensor, savedSteps, dbStepsToday, driftDetected,
}) => {
  if (driftDetected) return currentSensor;

  const unsavedIfTrusted = Math.max(0, currentSensor - (savedSensor ?? currentSensor));
  const bgAddedSteps =
    (savedSteps !== null && Number.isFinite(savedSteps))
      ? Math.max(0, dbStepsToday - savedSteps)
      : 0;
  const adjustedSensor =
    (savedSensor !== null && bgAddedSteps > 0)
      ? Math.min(currentSensor, savedSensor + bgAddedSteps)
      : savedSensor;

  if (bgAddedSteps > 0) {
    debugLog('[StepCounter] BG correction: savedSensor', savedSensor,
      '+ bgAdded', bgAddedSteps, '→ adjusted', adjustedSensor);
  }

  if (
    adjustedSensor !== null &&
    Number.isFinite(adjustedSensor) &&
    adjustedSensor <= currentSensor &&
    unsavedIfTrusted <= MAX_UNSAVED
  ) return adjustedSensor;

  return currentSensor;
};
