/**
 * frontend/src/features/nutrition/domain/afreshProductProfiles.js
 *
 * Static nutritional profile for Herbalife Afresh Energy Drink.
 * Values aligned with AIGateway recognition reference (1 cup ~200 ml).
 * Pure constants — zero I/O.
 */
export const AFRESH_PRODUCT = Object.freeze({
  id: 'afresh',
  label: 'Herbalife Afresh Energy Drink',
  unit: 'cup (200 ml)',
  mlPerCup: 200,
  defaultServings: 1,
  minServings: 1,
  maxServings: 8,
  perServing: Object.freeze({
    calories: 15,
    protein: 0,
    carbs: 4,
    fat: 0,
    fiber: 0,
    sugar: 4,
    sodium: 0.02, // g (20 mg)
    cholesterol: 0,
    // Micros (mg / µg as used elsewhere)
    vitamin_c: 15,
    potassium: 30,
  }),
});

/**
 * Scale Afresh profile by cup count → promoteUnknownToFood / analysis shape.
 * Always sets volume_ml (200 ml per cup) so diary does not fall back to 100 ml.
 * @param {number} servings
 */
export function buildAfreshAnalysisResult(servings = 1) {
  const count = Math.max(AFRESH_PRODUCT.minServings, Math.min(AFRESH_PRODUCT.maxServings, Number(servings) || 1));
  const volumeMl = count * AFRESH_PRODUCT.mlPerCup;
  const s = AFRESH_PRODUCT.perServing;
  const nutrition = {
    calories: s.calories * count,
    protein: s.protein * count,
    carbs: s.carbs * count,
    fat: s.fat * count,
    fiber: s.fiber * count,
    sugar: s.sugar * count,
    sodium: s.sodium * count,
    cholesterol: s.cholesterol * count,
    vitamin_c: s.vitamin_c * count,
    potassium: s.potassium * count,
  };
  const name = count === 1
    ? AFRESH_PRODUCT.label
    : `${AFRESH_PRODUCT.label} ×${count}`;
  // Portion label only — volume is in volume_ml so EditableFoodItem shows "1 cup (200ml)" once
  const portion = count === 1 ? '1 cup' : `${count} cups`;
  return {
    foods: [{
      name,
      nutrition,
      portion,
      volume_ml: volumeMl,
      unit: 'ml',
      isLiquid: true,
      weight_g: null,
    }],
    total: nutrition,
    confidence: 'high',
    processedBy: 'afresh_preset',
  };
}
