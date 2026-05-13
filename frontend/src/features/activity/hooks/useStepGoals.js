/**
 * useStepGoals.js — daily goal progress + ring geometry for the SVG.
 *
 * Tiny memo hook that turns `displaySteps` into the values the ring
 * component needs (progress 0–1 and the strokeDashoffset for the
 * progress arc). Goal threshold is the global STEP_GOAL constant.
 */
import { useMemo } from 'react';
import { STEP_GOAL, RING_CIRCUMFERENCE } from '../services/stepCounterConstants';

export function useStepGoals(displaySteps) {
  return useMemo(() => {
    const stepProgress = Math.min((displaySteps || 0) / STEP_GOAL, 1);
    const ringOffset   = RING_CIRCUMFERENCE * (1 - stepProgress);
    return {
      stepGoal: STEP_GOAL,
      stepProgress,
      ringOffset,
      progressPct: Math.round(stepProgress * 100),
      reached: stepProgress >= 1,
    };
  }, [displaySteps]);
}
