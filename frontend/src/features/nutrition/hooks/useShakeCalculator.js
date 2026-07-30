/**
 * frontend/src/features/nutrition/hooks/useShakeCalculator.js
 *
 * Shake Calculator state. Nutrition uses the same canonical Herbalife Shake
 * profile as the AI path (herbalifeShakeProfile.js), scaled by powder grams
 * from scoop counts — not the old incorrect per-scoop macros.
 */

import { useCallback, useMemo, useState } from 'react';
import { SHAKE_PRODUCTS, SHAKE_PRODUCT_IDS } from '../domain/shakeProductProfiles';
import {
  HERBALIFE_SHAKE_NAME,
  powderGramsFromServings,
  scaleHerbalifeShakeNutrition,
} from '../domain/herbalifeShakeProfile';

function buildDefaultServings() {
  return SHAKE_PRODUCT_IDS.reduce((acc, id) => {
    acc[id] = SHAKE_PRODUCTS[id].defaultServings;
    return acc;
  }, {});
}

export function useShakeCalculator() {
  const [servings, setServingsState] = useState(buildDefaultServings);

  const increment = useCallback((id) => {
    const profile = SHAKE_PRODUCTS[id];
    if (!profile) return;
    setServingsState((prev) => ({
      ...prev,
      [id]: Math.min(prev[id] + 1, profile.maxServings),
    }));
  }, []);

  const decrement = useCallback((id) => {
    const profile = SHAKE_PRODUCTS[id];
    if (!profile) return;
    setServingsState((prev) => ({
      ...prev,
      [id]: Math.max(prev[id] - 1, profile.minServings),
    }));
  }, []);

  const setServings = useCallback((id, value) => {
    const profile = SHAKE_PRODUCTS[id];
    if (!profile) return;
    const clamped = Math.max(profile.minServings, Math.min(profile.maxServings, Number(value) || 0));
    setServingsState((prev) => ({ ...prev, [id]: clamped }));
  }, []);

  const reset = useCallback(() => {
    setServingsState(buildDefaultServings());
  }, []);

  const powderGrams = useMemo(
    () => powderGramsFromServings(servings, SHAKE_PRODUCTS),
    [servings],
  );

  const shakeItem = useMemo(
    () => (powderGrams > 0 ? scaleHerbalifeShakeNutrition(powderGrams) : null),
    [powderGrams],
  );

  const totals = useMemo(() => {
    if (!shakeItem) {
      return {
        calories: 0, protein: 0, carbs: 0, fat: 0,
        fiber: 0, sugar: 0, sodium: 0, cholesterol: 0,
      };
    }
    return { ...shakeItem.nutrition };
  }, [shakeItem]);

  const hasServings = powderGrams > 0;

  /**
   * Payload for saveNutritionAnalysis / promoteUnknownToFood — same shape as AI.
   */
  const buildFoodPayload = useCallback(() => {
    if (!shakeItem) {
      return {
        nutrition: totals,
        detailedItems: [],
        confidence: 'high',
        processedBy: 'shake_calculator',
      };
    }
    const n = shakeItem.nutrition;
    return {
      nutrition: { ...n },
      detailedItems: [{
        name: HERBALIFE_SHAKE_NAME,
        portionDescription: shakeItem.portion,
        weight_g: shakeItem.weight_g,
        volume_ml: shakeItem.volume_ml,
        estimatedWeight: shakeItem.weight_g,
        unit: shakeItem.unit,
        isLiquid: true,
        calories: n.calories,
        protein: n.protein,
        carbs: n.carbs,
        fat: n.fat,
        fiber: n.fiber,
        sugar: n.sugar,
        sodium: n.sodium,
        cholesterol: n.cholesterol,
        glycemic_index: n.glycemic_index,
        nutrition: { ...n },
      }],
      confidence: 'high',
      processedBy: 'shake_calculator',
    };
  }, [shakeItem, totals]);

  return {
    servings,
    totals,
    powderGrams,
    hasServings,
    increment,
    decrement,
    setServings,
    reset,
    buildFoodPayload,
  };
}
