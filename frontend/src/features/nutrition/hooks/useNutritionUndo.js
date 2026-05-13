// useNutritionUndo — owns the soft-delete placeholder + undo state for meals.
// Delegates server I/O to mealMutationsApi; rolls back optimistic state on failure.
import { useState, useCallback } from 'react';
import {
  parseAnalysisData,
  deleteMealById,
  undoMealDelete,
} from '../services/nutritionDashboard';

export const UNDO_SECONDS = 5;

const negate = (d) => ({
  calories: -d.calories, protein: -d.protein, carbs: -d.carbs,
  fat: -d.fat, fiber: -d.fiber, mealCountDelta: -d.mealCountDelta,
});

const buildDeltas = (meal, sign = -1) => {
  const n = parseAnalysisData(meal.AnalysisData).nutrition || {};
  return {
    calories: sign * (n.calories || meal.TotalCalories || 0),
    protein:  sign * (n.protein  || meal.TotalProtein  || 0),
    carbs:    sign * (n.carbs    || meal.TotalCarbs    || 0),
    fat:      sign * (n.fat      || meal.TotalFat      || 0),
    fiber:    sign * (n.fiber    || meal.TotalFiber    || 0),
    mealCountDelta: sign,
  };
};

export function useNutritionUndo({ apiBaseUrl, userIdForDelete, setAnalyses, applyDailyDelta, onMealDelete, setError }) {
  const [undoState, setUndoState] = useState({});

  const deleteMealOptimistic = useCallback(async (meal) => {
    const deltas = buildDeltas(meal, -1);
    const placeholder = { ID: `undo-${meal.ID}`, isUndoPlaceholder: true, CreatedAt: meal.CreatedAt };

    setAnalyses((prev) => {
      const idx = prev.findIndex((m) => m.ID === meal.ID);
      if (idx === -1) return prev;
      const next = prev.slice(); next.splice(idx, 1, placeholder); return next;
    });
    setUndoState((prev) => ({
      ...prev,
      [placeholder.ID]: { originalMeal: meal, expiresAt: Date.now() + UNDO_SECONDS * 1000, ttlSeconds: UNDO_SECONDS },
    }));
    applyDailyDelta(deltas);

    try {
      await deleteMealById({ apiBaseUrl, id: meal.ID, userId: userIdForDelete });
      if (onMealDelete) onMealDelete(meal.ID);
    } catch (err) {
      setAnalyses((prev) => {
        const idx = prev.findIndex((m) => m.ID === placeholder.ID);
        if (idx === -1) return prev;
        const next = prev.slice(); next.splice(idx, 1, meal); return next;
      });
      setUndoState((prev) => { const n = { ...prev }; delete n[placeholder.ID]; return n; });
      applyDailyDelta(negate(deltas));
      if (setError) {
        setError(err.message || 'Failed to delete. Please try again.');
        setTimeout(() => setError(null), 5000);
      }
    }
  }, [apiBaseUrl, userIdForDelete, setAnalyses, applyDailyDelta, onMealDelete, setError]);

  const expireUndo = useCallback((pid) => {
    setAnalyses((prev) => prev.filter((a) => a.ID !== pid));
    setUndoState((prev) => { const n = { ...prev }; delete n[pid]; return n; });
  }, [setAnalyses]);

  const restoreUndo = useCallback(async (pid) => {
    const entry = undoState[pid];
    const orig = entry?.originalMeal;
    if (!orig) return;
    const deltas = buildDeltas(orig, +1);

    setAnalyses((prev) => prev.filter((a) => a.ID !== pid).concat(orig));
    applyDailyDelta(deltas);
    setUndoState((prev) => { const n = { ...prev }; delete n[pid]; return n; });

    try {
      await undoMealDelete({ apiBaseUrl, id: orig.ID, userId: userIdForDelete });
    } catch (err) {
      setAnalyses((prev) => prev.filter((a) => a.ID !== orig.ID).concat({ ID: pid, isUndoPlaceholder: true, CreatedAt: orig.CreatedAt }));
      applyDailyDelta(negate(deltas));
      setUndoState((prev) => ({ ...prev, [pid]: { originalMeal: orig, expiresAt: entry.expiresAt, ttlSeconds: entry.ttlSeconds } }));
      throw err;
    }
  }, [undoState, apiBaseUrl, userIdForDelete, setAnalyses, applyDailyDelta]);

  return { undoState, deleteMealOptimistic, restoreUndo, expireUndo };
}
