import React, { useCallback, useState } from 'react';
import FoodBreakdownModal from './FoodBreakdownModal';
import GlycemicIndexModal from './GlycemicIndexModal';
import {
  extractFoodContributions,
  getNutrientDisplayName,
  getNutrientUnit,
  getNutrientTotal,
  getNutrientTarget,
} from '../domain/foodBreakdown';

export function useNutrientBreakdownModal() {
  const [modalState, setModalState] = useState({ isOpen: false, nutrient: null });

  const handleOpenModal = useCallback((nutrientType) => {
    setModalState({ isOpen: true, nutrient: nutrientType });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState({ isOpen: false, nutrient: null });
  }, []);

  return { modalState, handleOpenModal, handleCloseModal };
}

/**
 * Bottom-sheet host for nutrient food breakdown + GI detail.
 * Same interaction as Home nutrition carousel / Wellness Score contributions.
 */
export default function NutrientBreakdownModals({
  isOpen,
  nutrient,
  onClose,
  analyses = [],
  dailyStats,
  calCard = null,
  proteinTarget,
  fatTarget,
  carbsTarget,
  calorieTarget,
  heartCard,
  lowCarbCard,
}) {
  if (!isOpen || !nutrient) return null;

  if (nutrient === 'glycemicIndex') {
    return (
      <GlycemicIndexModal
        isOpen={isOpen}
        onClose={onClose}
        averageGI={dailyStats?.averageGlycemicIndex ?? null}
        mealCount={dailyStats?.mealCount || 0}
      />
    );
  }

  return (
    <FoodBreakdownModal
      isOpen={isOpen}
      onClose={onClose}
      nutrientName={getNutrientDisplayName(nutrient)}
      unit={getNutrientUnit(nutrient)}
      totalConsumed={getNutrientTotal(
        nutrient, dailyStats, calCard, heartCard, lowCarbCard,
      )}
      target={getNutrientTarget(
        nutrient, proteinTarget, fatTarget, carbsTarget, calorieTarget, heartCard, lowCarbCard,
      )}
      foodBreakdown={extractFoodContributions(analyses, nutrient).breakdown}
    />
  );
}
