import { useMealItemMutations } from './useMealItemMutations';
import { useMealDeleteMutations } from './useMealDeleteMutations';

/**
 * Composes per-food-item mutations and meal-row delete mutations into a
 * single orchestration hook for NutritionDashboard. Behavior is preserved
 * exactly — see useMealItemMutations and useMealDeleteMutations for details.
 */
export function useMealMutations({
  apiBaseUrl,
  user,
  selectedMeal,
  setSelectedMeal,
  selectedDate,
  resolveUserId,
  setAnalyses,
  setUndoState,
  setError,
  applyDailyDelta,
  fetchDayAnalyses,
  localDetailedItems,
  setLocalDetailedItems,
  localNutrition,
  setLocalNutrition,
  isAutoSaveUpdateRef,
  onMealDelete,
  undoSeconds,
}) {
  const itemMutations = useMealItemMutations({
    apiBaseUrl,
    selectedMeal,
    setSelectedMeal,
    selectedDate,
    resolveUserId,
    setAnalyses,
    fetchDayAnalyses,
    localDetailedItems,
    setLocalDetailedItems,
    localNutrition,
    setLocalNutrition,
    isAutoSaveUpdateRef,
  });

  const deleteMutations = useMealDeleteMutations({
    apiBaseUrl,
    user,
    setAnalyses,
    setUndoState,
    setSelectedMeal,
    applyDailyDelta,
    setError,
    onMealDelete,
    undoSeconds,
  });

  return { ...itemMutations, ...deleteMutations };
}
