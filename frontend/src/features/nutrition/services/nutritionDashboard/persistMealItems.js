// Per-meal persistence + state-sync orchestrator.
// Wraps mealMutationsApi.updateMealNutrition so React state (analyses,
// selectedMeal, dailyStats) stays consistent with the DB write.
import { updateMealNutrition } from './mealMutationsApi';

const round = (n) => Math.round(n || 0);

const buildTotalsPatch = (newTotals) => ({
  TotalCalories: round(newTotals.calories),
  TotalProtein:  round(newTotals.protein),
  TotalCarbs:    round(newTotals.carbs),
  TotalFat:      round(newTotals.fat),
  TotalFiber:    round(newTotals.fiber),
});

/**
 * Save the current items to the backend and propagate the new state into the
 * provided React setters. Throws on failure so callers can roll back UI state.
 */
export async function persistMealItems({
  apiBaseUrl, mealId, userId, newItems, newTotals,
  setAnalyses, syncSelectedMeal, setSelectedMeal, refresh, selectedDate,
  markAutoSave,
}) {
  const { analysisData } = await updateMealNutrition({
    apiBaseUrl, mealId, userId, newItems, newTotals,
  });
  const totalsPatch = buildTotalsPatch(newTotals);
  const analysisDataString = JSON.stringify(analysisData);

  setAnalyses((prev) => prev.map((m) =>
    m.ID === mealId ? { ...m, AnalysisData: analysisDataString, ...totalsPatch } : m,
  ));

  if (syncSelectedMeal) {
    if (markAutoSave) markAutoSave();
    setSelectedMeal((prev) => ({ ...prev, AnalysisData: analysisDataString, ...totalsPatch }));
  }

  if (refresh) {
    refresh(selectedDate).catch((e) => console.error('Error reloading stats:', e));
  }
}
