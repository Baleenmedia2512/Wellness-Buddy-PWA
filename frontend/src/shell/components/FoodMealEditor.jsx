/**
 * FoodMealEditor.jsx — full meal editing modal for diary food entries.
 *
 * Wraps MealAnalysisModal with complete editing state management, providing
 * the same functionality as NutritionDashboard:
 *   - Individual food item edit/delete
 *   - Per-item nutrition display and adjustment
 *   - Undo mechanism with countdown for deletions
 *   - Auto-save with optimistic updates
 *
 * Integrates with the unified Diary page (ADR-0003) to preserve all existing
 * behavior from the original dashboard tabs.
 */
import React, { useState, useCallback } from 'react';
import {
  MealAnalysisModal,
  useMealMutations,
} from '../../features/nutrition';

const UNDO_SECONDS = 10; // Match original dashboard timing

function FoodMealEditor({
  foodEditState,
  setFoodEditState,
  foodUndoState,
  setFoodUndoState,
  isAutoSaveUpdateRef,
  itemRefs,
  user,
  apiBaseUrl,
  selectedDate,
  resolveUserId,
  resolvedUserId,
  onClose,
  onMealDelete,
  reloadDiary,
}) {
  // If the parent already resolved the userId (diary context), use it directly
  // to avoid a network round-trip that can fail and break undo.
  const stableResolveUserId = React.useCallback(
    resolvedUserId
      ? () => Promise.resolve(resolvedUserId)
      : resolveUserId,
    [resolvedUserId, resolveUserId],
  );
  const [isClosingModal, setIsClosingModal] = useState(false);

  // Extract state
  const {
    selectedMeal,
    localDetailedItems,
    localNutrition,
    editingStates,
    isEditing,
    isSaving,
    saveStatus,
  } = foodEditState;

  // Update functions
  const setSelectedMeal = useCallback((meal) => {
    setFoodEditState((prev) => ({ ...prev, selectedMeal: meal }));
  }, [setFoodEditState]);

  const setLocalDetailedItems = useCallback((items) => {
    setFoodEditState((prev) => ({ ...prev, localDetailedItems: items }));
  }, [setFoodEditState]);

  const setLocalNutrition = useCallback((nutrition) => {
    setFoodEditState((prev) => ({ ...prev, localNutrition: nutrition }));
  }, [setFoodEditState]);

  const setIsSaving = useCallback((saving) => {
    setFoodEditState((prev) => ({ ...prev, isSaving: saving }));
  }, [setFoodEditState]);

  const setSaveStatus = useCallback((status) => {
    setFoodEditState((prev) => ({ ...prev, saveStatus: status }));
  }, [setFoodEditState]);

  const setError = useState(null)[1]; // Error display handled by modal

  // Dummy functions for hooks (diary doesn't need these, but hooks require them)
  const setAnalyses = () => {};
  const applyDailyDelta = () => {};
  const fetchDayAnalyses = () => reloadDiary();

  // Get mutation handlers
  const {
    handleFoodUpdate,
    handleDeleteFoodItem,
    handleRestoreFoodItem,
    handleDeleteMeal,
    deletingId,
  } = useMealMutations({
    apiBaseUrl,
    user,
    selectedMeal,
    setSelectedMeal,
    selectedDate,
    resolveUserId: stableResolveUserId,
    setAnalyses,
    setUndoState: setFoodUndoState,
    setError,
    applyDailyDelta,
    fetchDayAnalyses,
    localDetailedItems,
    setLocalDetailedItems,
    localNutrition,
    setLocalNutrition,
    isAutoSaveUpdateRef,
    onMealDelete,
    undoSeconds: UNDO_SECONDS,
  });

  // Handle editing state changes
  const handleEditingChange = useCallback(
    (index, isItemEditing, isBlocking = false) => {
      setFoodEditState((prev) => ({
        ...prev,
        editingStates: {
          ...prev.editingStates,
          [index]: isItemEditing,
        },
        isEditing: isItemEditing,
        isSaving: isBlocking,
      }));
    },
    [setFoodEditState]
  );

  const handleCloseModal = () => {
    if (isEditing) {
      if (!window.confirm('You have unsaved changes. Close anyway?')) return;
    }
    setIsClosingModal(true);
    setTimeout(() => {
      onClose();
      setIsClosingModal(false);
    }, 200);
  };

  return (
    <MealAnalysisModal
      selectedMeal={selectedMeal}
      isClosingModal={isClosingModal}
      isEditing={isEditing}
      isSaving={isSaving}
      saveStatus={saveStatus}
      setSaveStatus={setSaveStatus}
      deletingId={deletingId}
      localDetailedItems={localDetailedItems}
      localNutrition={localNutrition}
      resetKey={0}
      itemRefs={itemRefs}
      editingStates={editingStates}
      handleEditingChange={handleEditingChange}
      handleFoodUpdate={handleFoodUpdate}
      handleDeleteFoodItem={handleDeleteFoodItem}
      handleRestoreFoodItem={handleRestoreFoodItem}
      handleCloseModal={handleCloseModal}
      handleDeleteMeal={handleDeleteMeal}
      user={user}
    />
  );
}

export default FoodMealEditor;
