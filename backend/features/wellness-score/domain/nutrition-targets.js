/**
 * Nutrition targets for wellness score — mirrors frontend carouselRules / micronutrientRules.
 * Pure functions only; no I/O.
 */

const SODIUM_CAP_MG = 2300;
const CHOLESTEROL_BASE_MG = 300;
const FIBER_TARGET_G = 25;
const GI_LIMIT = 55;
const CAL_PER_PROTEIN = 4;
const CAL_PER_CARB = 4;
const CAL_PER_FAT = 9;

const MICRO_RDA = {
  totalVitaminA: 900,
  totalVitaminC: 90,
  totalVitaminD: 20,
  totalVitaminE: 15,
  totalVitaminK: 120,
  totalVitaminB1: 1.2,
  totalVitaminB2: 1.3,
  totalVitaminB3: 16,
  totalVitaminB6: 1.7,
  totalVitaminB9: 400,
  totalVitaminB12: 2.4,
  totalCalcium: 1000,
  totalIron: 18,
  totalMagnesium: 420,
  totalPotassium: 3500,
  totalZinc: 11,
  totalPhosphorus: 700,
};

/**
 * @param {{ bmr?: number, weightKg?: number|null }}
 * @returns {Record<string, number|null>}
 */
export function computeNutritionTargets({ bmr = 0, weightKg = null }) {
  const bmrTarget = bmr > 0 ? bmr : 1500;
  const weight = weightKg > 0 ? weightKg : null;

  let proteinTarget = null;
  let fatTarget = null;
  let carbsTarget = null;
  if (weight) {
    proteinTarget = Math.round(weight * 1.5);
    fatTarget = Math.round(weight * 0.75);
    const proteinCals = proteinTarget * CAL_PER_PROTEIN;
    const fatCals = fatTarget * CAL_PER_FAT;
    carbsTarget = Math.max(0, Math.round((bmrTarget - proteinCals - fatCals) / CAL_PER_CARB));
  }

  const sodiumLimit = weight
    ? Math.min(SODIUM_CAP_MG, Math.round(weight * 30))
    : SODIUM_CAP_MG;
  const cholesterolLimit = weight
    ? Math.max(200, Math.round(CHOLESTEROL_BASE_MG - Math.max(0, weight - 70)))
    : CHOLESTEROL_BASE_MG;
  const sugarLimit = Math.round((bmrTarget * 0.10) / CAL_PER_CARB);

  const targets = {
    totalCalories: bmrTarget,
    totalCarbs: carbsTarget,
    totalFat: fatTarget,
    totalProtein: proteinTarget,
    totalSodium: sodiumLimit,
    totalCholesterol: cholesterolLimit,
    totalSugar: sugarLimit,
    totalFiber: FIBER_TARGET_G,
    averageGlycemicIndex: GI_LIMIT,
    ...MICRO_RDA,
  };

  return targets;
}

export { GI_LIMIT };
