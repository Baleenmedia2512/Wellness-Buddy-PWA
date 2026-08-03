/**
 * Nutrition limits/targets for wellness score — mirrors frontend carouselRules / micronutrientRules.
 * Calories, carbs, fat, sodium, sugar, and cholesterol use daily limits; protein, fiber, vitamins, and minerals use targets.
 * Pure functions only; no I/O.
 */

const SODIUM_CAP_MG = 2300;
const CHOLESTEROL_BASE_MG = 300;
const FIBER_TARGET_G = 25;
const GI_LIMIT = 55;
const CAL_PER_PROTEIN = 4;
const CAL_PER_CARB = 4;
const CAL_PER_FAT = 9;
const FAT_PERCENT_MALE = 20;
const FAT_PERCENT_FEMALE = 30;
const FAT_PERCENT_DEFAULT = 25;

/**
 * Fat % of daily calorie target by gender.
 * Male 20%, Female 30%, Other/unknown 25%.
 *
 * @param {string|null|undefined} gender
 * @returns {number} percent 0–100
 */
export function resolveFatPercent(gender) {
  const g = String(gender || '').trim().toLowerCase();
  if (g === 'female') return FAT_PERCENT_FEMALE;
  if (g === 'male') return FAT_PERCENT_MALE;
  return FAT_PERCENT_DEFAULT;
}

/**
 * Fat limit (g) = round(dailyCalorieTarget × fatPercent / 100 / 9).
 *
 * @param {number} calorieTarget
 * @param {string|null|undefined} gender
 * @returns {number}
 */
export function computeFatLimitGrams(calorieTarget, gender) {
  const effectiveCals = calorieTarget > 0 ? calorieTarget : 1500;
  return Math.round((effectiveCals * resolveFatPercent(gender)) / 100 / CAL_PER_FAT);
}

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
 * @param {{ bmr?: number, weightKg?: number|null, gender?: string|null }}
 * @returns {Record<string, number|null>}
 */
export function computeNutritionTargets({ bmr = 0, weightKg = null, gender = null }) {
  const bmrTarget = bmr > 0 ? bmr : 1500;
  const weight = weightKg > 0 ? weightKg : null;

  let proteinTarget = null;
  let fatLimit = null;
  let carbsLimit = null;
  if (weight) {
    proteinTarget = Math.round(weight * 1.5);
    fatLimit = computeFatLimitGrams(bmrTarget, gender);
    const proteinCals = proteinTarget * CAL_PER_PROTEIN;
    const fatCals = fatLimit * CAL_PER_FAT;
    carbsLimit = Math.max(0, Math.round((bmrTarget - proteinCals - fatCals) / CAL_PER_CARB));
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
    totalCarbs: carbsLimit,
    totalFat: fatLimit,
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

/** GI category thresholds (aligned with nutrition UI: Low ≤55, Medium 56–69, High ≥70). */
export const GI_MEDIUM_MAX = 69;
export const GI_HIGH_MIN = 70;

export { GI_LIMIT };
