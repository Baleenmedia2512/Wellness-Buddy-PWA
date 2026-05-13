/**
 * useStepCalculations.js — derives the display-time view-model.
 *
 * Picks between "self" (live sensor + DB history) and "other member" data
 * (loaded by useStepCharts when a coach selects a team member). Returns
 * the values the UI components consume — no decisions about what to show,
 * just data selection.
 */
import { useMemo } from 'react';

export function useStepCalculations({
  selectedMember, memberData,
  todaySteps, todayCalories, dailyHistory, loading,
}) {
  return useMemo(() => {
    const isViewingOther = !!(selectedMember && !selectedMember.isSelf);
    return {
      isViewingOther,
      displaySteps:    isViewingOther ? memberData.steps    : todaySteps,
      displayCalories: isViewingOther ? memberData.calories : todayCalories,
      displayHistory:  isViewingOther ? memberData.history  : dailyHistory,
      displayLoading:  isViewingOther ? memberData.loading  : loading,
    };
  }, [selectedMember, memberData, todaySteps, todayCalories, dailyHistory, loading]);
}
