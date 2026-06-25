import React from 'react';
import NutritionAnalysisPanel from './NutritionAnalysisPanel';

/**
 * Modal shell that mounts NutritionAnalysisPanel for the currently selected meal.
 * Pure presentation pass-through — orchestration lives in NutritionDashboard +
 * useMealMutations.
 */
function MealAnalysisModal({
  selectedMeal,
  isClosingModal,
  isEditing,
  isSaving,
  saveStatus,
  setSaveStatus,
  deletingId,
  localDetailedItems,
  localNutrition,
  resetKey,
  itemRefs,
  editingStates,
  handleEditingChange,
  handleFoodUpdate,
  handleDeleteFoodItem,
  handleRestoreFoodItem,
  handleCloseModal,
  handleDeleteMeal,
  user,
}) {
  return (
    <NutritionAnalysisPanel
      selectedMeal={selectedMeal}
      isClosingModal={isClosingModal}
      isEditing={isEditing}
      isSaving={isSaving}
      saveStatus={saveStatus}
      setSaveStatus={setSaveStatus}
      deletingId={deletingId}
      localDetailedItems={localDetailedItems}
      localNutrition={localNutrition}
      resetKey={resetKey}
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

export default MealAnalysisModal;
