import { useState } from 'react';
import {
  recalculateTotals,
  resolveFoodItemIndex,
  persistMealItems as persistMealItemsService,
} from '../services/nutritionDashboard';

/**
 * Saving state + per-food-item mutations inside the meal-detail modal:
 * persist wrapper, edit, delete (immediate/finalize), restore.
 * setIsSaving is exposed so the editing state machine in NutritionDashboard
 * can toggle the saving flag while a row is mid-save.
 */
export function useMealItemMutations({
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
}) {
  const [isSaving, setIsSaving] = useState(false);

  const persistMealItems = async (newItems, newTotals, options = {}) => {
    if (!selectedMeal?.ID) return;

    const { syncSelectedMeal = true, refreshStats = true } = options;

    setIsSaving(true);
    try {
      const resolvedUserId = await resolveUserId();
      if (!resolvedUserId) {
        throw new Error('User not authenticated or not found in database');
      }

      await persistMealItemsService({
        apiBaseUrl,
        mealId: selectedMeal.ID,
        userId: resolvedUserId,
        newItems,
        newTotals,
        setAnalyses,
        syncSelectedMeal,
        setSelectedMeal,
        refresh: refreshStats ? fetchDayAnalyses : null,
        selectedDate,
        markAutoSave: () => {
          isAutoSaveUpdateRef.current = true;
        },
      });
    } catch (error) {
      console.error('[useMealItemMutations] Failed to persist meal items:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleFoodUpdate = async (index, updatedFood) => {
    const newItems = [...localDetailedItems];
    newItems[index] = updatedFood;
    setLocalDetailedItems(newItems);

    const newTotals = recalculateTotals(newItems);
    setLocalNutrition(newTotals);

    try {
      await persistMealItems(newItems, newTotals);
    } catch (error) {
      console.error('Error updating meal:', error);
      throw error;
    }
  };

  const handleDeleteFoodItem = async (index, options = {}) => {
    const phase = options?.phase || 'finalize';
    const snapshot = options?.itemSnapshot || null;

    if (!Array.isArray(localDetailedItems) || localDetailedItems.length === 0)
      return;

    const targetIndex = resolveFoodItemIndex(localDetailedItems, index, snapshot);
    if (targetIndex === -1) return;

    const previousTotals = localNutrition;

    const newItems = localDetailedItems.filter((_, i) => i !== targetIndex);
    const newTotals = recalculateTotals(newItems);

    if (phase === 'immediate') {
      // Persist deletion in backend; keep row visible for undo UI.
      setLocalNutrition(newTotals);
      try {
        await persistMealItems(newItems, newTotals, {
          syncSelectedMeal: false,
          refreshStats: false,
        });
      } catch (error) {
        console.error('Error deleting food item:', error);
        setLocalNutrition(previousTotals);
        throw error;
      }
      return;
    }

    // Finalize phase: remove row from local UI after undo timer ends.
    setLocalDetailedItems(newItems);
    setLocalNutrition(newTotals);
  };

  const handleRestoreFoodItem = async (index, snapshot) => {
    const previousItems = localDetailedItems;
    const previousTotals = localNutrition;

    let restoreItems = localDetailedItems;
    const existingIndex = resolveFoodItemIndex(localDetailedItems, index, snapshot);

    // If row was already removed in UI, reinsert before persisting restore.
    if (existingIndex === -1 && snapshot) {
      const insertAt = Math.max(0, Math.min(index, localDetailedItems.length));
      restoreItems = [
        ...localDetailedItems.slice(0, insertAt),
        snapshot,
        ...localDetailedItems.slice(insertAt),
      ];
      setLocalDetailedItems(restoreItems);
    }

    const restoreTotals = recalculateTotals(restoreItems);
    setLocalNutrition(restoreTotals);

    try {
      await persistMealItems(restoreItems, restoreTotals);
    } catch (error) {
      console.error('Error restoring food item:', error);
      setLocalDetailedItems(previousItems);
      setLocalNutrition(previousTotals);
      throw error;
    }
  };

  return {
    isSaving,
    setIsSaving,
    persistMealItems,
    handleFoodUpdate,
    handleDeleteFoodItem,
    handleRestoreFoodItem,
  };
}
