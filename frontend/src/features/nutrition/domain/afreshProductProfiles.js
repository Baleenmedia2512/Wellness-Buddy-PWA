/**
 * frontend/src/features/nutrition/domain/afreshProductProfiles.js
 *
 * Static nutritional profile for Herbalife Afresh Energy Drink.
 * Nutrition is per SCOOP of powder — not per cup of water.
 * Users often mix 2–3 scoops in one cup; macros scale by scoop count.
 * Prepared drink volume stays ~200 ml (one cup) for hydration inference.
 * Pure constants — zero I/O.
 */
export const AFRESH_PRODUCT = Object.freeze({
  id: 'afresh',
  label: 'Herbalife Afresh Energy Drink',
  unit: 'scoop',
  /** Typical prepared drink volume (ml) — not multiplied by scoop count. */
  mlPerPreparedDrink: 200,
  defaultScoops: 1,
  minScoops: 1,
  maxScoops: 8,
  /** Nutrition for 1 scoop of Afresh powder. */
  perScoop: Object.freeze({
    calories: 15,
    protein: 0,
    carbs: 4,
    fat: 0,
    fiber: 0,
    sugar: 4,
    sodium: 0.02, // g (20 mg)
    cholesterol: 0,
    vitamin_c: 15,
    potassium: 30,
  }),
});

/** @deprecated Use perScoop — kept for older callers. */
export const AFRESH_PER_SERVING = AFRESH_PRODUCT.perScoop;

/**
 * Scale Afresh profile by scoop count → promoteUnknownToFood / analysis shape.
 * Volume stays one prepared cup (~200 ml) so hydration does not inflate with scoops.
 * @param {number} scoops
 */
export function buildAfreshAnalysisResult(scoops = 1) {
  const count = Math.max(
    AFRESH_PRODUCT.minScoops,
    Math.min(AFRESH_PRODUCT.maxScoops, Number(scoops) || 1),
  );
  const s = AFRESH_PRODUCT.perScoop;
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
    : `${AFRESH_PRODUCT.label} (${count} scoops)`;
  const portion = count === 1 ? '1 scoop' : `${count} scoops`;
  return {
    foods: [{
      name,
      nutrition,
      portion,
      volume_ml: AFRESH_PRODUCT.mlPerPreparedDrink,
      unit: 'ml',
      isLiquid: true,
      weight_g: null,
      scoops: count,
    }],
    total: nutrition,
    confidence: 'high',
    processedBy: 'afresh_preset',
  };
}
