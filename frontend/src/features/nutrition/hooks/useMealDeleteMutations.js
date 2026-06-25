import { useState } from 'react';
import { useNutritionRefresh } from '../../../shared/context/NutritionRefreshContext';
import {
  parseAnalysisData,
  deleteMealById,
} from '../services/nutritionDashboard';

const DEFAULT_UNDO_SECONDS = 5;

function computeDeleteDeltas(meal) {
  const n = parseAnalysisData(meal.AnalysisData).nutrition || {};
  return {
    calories: -(n.calories || meal.TotalCalories || 0),
    protein: -(n.protein || meal.TotalProtein || 0),
    carbs: -(n.carbs || meal.TotalCarbs || 0),
    fat: -(n.fat || meal.TotalFat || 0),
    fiber: -(n.fiber || meal.TotalFiber || 0),
    mealCountDelta: -1,
  };
}

function invertDeltas(deltas) {
  return {
    calories: -deltas.calories,
    protein: -deltas.protein,
    carbs: -deltas.carbs,
    fat: -deltas.fat,
    fiber: -deltas.fiber,
    mealCountDelta: -deltas.mealCountDelta,
  };
}

/**
 * Owns optimistic meal-row deletion with undo + rollback.
 *
 * Both handlers share the same optimistic-replace + rollback flow; the modal
 * variant additionally clears selectedMeal and tracks deletingId for the
 * spinner on the modal delete button.
 */
export function useMealDeleteMutations({
  apiBaseUrl,
  user,
  setAnalyses,
  setUndoState,
  setSelectedMeal,
  applyDailyDelta,
  setError,
  onMealDelete,
  undoSeconds = DEFAULT_UNDO_SECONDS,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const { triggerRefresh } = useNutritionRefresh(); // Global refresh trigger for home cards

  const optimisticDelete = async (meal, { fromModal }) => {
    if (!meal?.ID) return;
    if (fromModal) setDeletingId(meal.ID);

    const deltas = computeDeleteDeltas(meal);
    const placeholder = {
      ID: `undo-${meal.ID}`,
      isUndoPlaceholder: true,
      CreatedAt: meal.CreatedAt,
    };

    setAnalyses((prev) => {
      const idx = prev.findIndex((m) => m.ID === meal.ID);
      if (idx === -1) {
        // Modal flow may race ahead of list; ensure placeholder is appended.
        return fromModal
          ? prev.filter((m) => m.ID !== meal.ID).concat(placeholder)
          : prev;
      }
      const next = prev.slice();
      next.splice(idx, 1, placeholder);
      return next;
    });

    setUndoState((prev) => ({
      ...prev,
      [placeholder.ID]: {
        originalMeal: meal,
        expiresAt: Date.now() + undoSeconds * 1000,
        ttlSeconds: undoSeconds,
      },
    }));

    applyDailyDelta(deltas);
    if (fromModal) setSelectedMeal(null);

    try {
      await deleteMealById({ apiBaseUrl, id: meal.ID, userId: user?.id });
      if (onMealDelete) onMealDelete(meal.ID);
      // Trigger global nutrition refresh (updates home cards)
      triggerRefresh({ immediate: true, source: 'meal-delete' });
    } catch (err) {
      // Rollback on failure
      setAnalyses((prev) => {
        const idx = prev.findIndex((m) => m.ID === placeholder.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, meal);
        return next;
      });
      setUndoState((prev) => {
        const next = { ...prev };
        delete next[placeholder.ID];
        return next;
      });
      applyDailyDelta(invertDeltas(deltas));
      setError(err.message || 'Failed to delete. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      if (fromModal) setDeletingId(null);
    }
  };

  const handleDeleteMeal = (meal) => optimisticDelete(meal, { fromModal: true });
  const handleOptimisticDelete = (meal) =>
    optimisticDelete(meal, { fromModal: false });

  return { deletingId, handleDeleteMeal, handleOptimisticDelete };
}
