// Per-meal persistence + state-sync orchestrator.
// Wraps mealMutationsApi.updateMealNutrition so React state (analyses,
// selectedMeal, dailyStats) stays consistent with the DB write.
import { updateMealNutrition } from './mealMutationsApi';
import { updateMealDetailCache } from '../mealDetailCache';
import { MICRO_PERSIST_FIELDS } from '../../domain/aggregateFoodTotals';

const round = (n) => Math.round(n || 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const buildTotalsPatch = (newTotals) => {
  const patch = {
    TotalCalories: round(newTotals.calories),
    TotalProtein:  round(newTotals.protein),
    TotalCarbs:    round(newTotals.carbs),
    TotalFat:      round(newTotals.fat),
    TotalFiber:    round(newTotals.fiber),
    TotalSugar:    round(newTotals.sugar ?? 0),
    TotalSodium:   round(newTotals.sodium ?? 0),
    TotalCholesterol: round(newTotals.cholesterol ?? 0),
    ...(newTotals.glycemic_index != null
      ? { GlycemicIndex: Math.round(newTotals.glycemic_index) }
      : {}),
  };
  for (const { aiKey, dbCol } of MICRO_PERSIST_FIELDS) {
    if (newTotals[aiKey] != null) patch[dbCol] = round2(newTotals[aiKey]);
  }
  return patch;
};

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

  updateMealDetailCache(userId, mealId, {
    ID: mealId,
    AnalysisData: analysisDataString,
    ...totalsPatch,
  });

  if (refresh) {
    refresh(selectedDate).catch((e) => console.error('Error reloading stats:', e));
  }
}
