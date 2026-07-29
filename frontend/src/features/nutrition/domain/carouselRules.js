/**
 * carouselRules — pure business-logic rules for the Nutrition Dashboard carousel.
 *
 * ALL rules are pure functions: given input → output, no I/O, no side-effects.
 * Domain layer per claude.md §3.1.
 *
 * Targets:
 *   Card 1 — Calories:     target = TDEE (BMR + PA + TEF), consumed = food cals, exercise = burned
 *   Card 2 — Macros:       protein = weight×1.5g, fat = calorieTarget×(20%♂/30%♀)/9, carbs = derived
 *   Card 3 — Heart Healthy: fat = macro target, sodium = 2300mg, cholesterol = 300mg
 *   Card 4 — Low Carb:     carbs = macro target, sugar = 50g, fiber = 25g
 */

// ─── Constants ────────────────────────────────────────────────────────────────
export const SODIUM_TARGET_MG      = 2300;
export const CHOLESTEROL_TARGET_MG = 300;
export const SUGAR_TARGET_G        = 50;
export const FIBER_TARGET_G        = 25;
export const CALORIES_PER_PROTEIN_G = 4;
export const CALORIES_PER_CARB_G   = 4;
export const CALORIES_PER_FAT_G    = 9;
/** Fat % of daily calorie target (male). */
export const FAT_PERCENT_MALE = 20;
/** Fat % of daily calorie target (female). */
export const FAT_PERCENT_FEMALE = 30;
/** Midpoint when gender is Other / unknown. */
export const FAT_PERCENT_DEFAULT = 25;

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
 * Fat target (g) = round(dailyCalorieTarget × fatPercent / 100 / 9).
 *
 * @param {number} calorieTarget
 * @param {string|null|undefined} gender
 * @returns {number}
 */
export function computeFatTargetGrams(calorieTarget, gender) {
  const effectiveCals = calorieTarget > 0 ? calorieTarget : 1500;
  return Math.round((effectiveCals * resolveFatPercent(gender)) / 100 / CALORIES_PER_FAT_G);
}

// ─── Card 1: Calories ─────────────────────────────────────────────────────────

/**
 * @param {{ calorieTarget: number, consumedCalories: number, burnedCalories?: number }}
 * @returns {{ target: number, consumed: number, exercise: number, net: number, remaining: number, progressPercent: number }}
 *
 * Formula: Net Calories = Food Calories − Exercise Calories − Smartwatch Burned Calories.
 * Smartwatch burned calories are always treated as exercise calories (product spec).
 *
 * Remaining follows the card label: Goal − Food + Exercise (equivalently target − net).
 * progressPercent uses net food intake clamped at 0 so exercise-only days show 0% progress.
 */
export function computeCaloriesCard({ calorieTarget, consumedCalories, burnedCalories = 0 }) {
  const target   = calorieTarget > 0 ? calorieTarget : 1500;
  const consumed = Math.max(0, consumedCalories || 0);
  const exercise = Math.max(0, burnedCalories || 0);
  // Net = Food − Exercise (may be negative when exercise exceeds food logged today).
  const net = consumed - exercise;
  // Remaining = Goal − Food + Exercise
  const remaining = Math.max(0, target - net);
  const progressNet = Math.max(0, net);
  const progressPercent = Math.round((progressNet / Math.max(target, 1)) * 100);
  return { target, consumed, exercise, net, remaining, progressPercent };
}

// ─── Card 2: Macros ───────────────────────────────────────────────────────────

/**
 * Returns macro targets derived from body weight + calorie target, or nulls
 * when weight is unavailable (new user, DB = 0).
 *
 * Fat target = round(calorieTarget × (20% male / 30% female / 25% other) / 9).
 * Carbs target = (calorieTarget - proteinCals - fatCals) / 4; clamped to ≥ 0.
 *
 * @param {{ latestWeight: number|null, calorieTarget: number, gender?: string|null }}
 * @returns {{ proteinTarget: number|null, fatTarget: number|null, carbsTarget: number|null }}
 */
export function computeMacroTargets({ latestWeight, calorieTarget, gender = null }) {
  if (!latestWeight || latestWeight <= 0) {
    return { proteinTarget: null, fatTarget: null, carbsTarget: null };
  }
  const proteinTarget = Math.round(latestWeight * 1.5);
  const effectiveCals = calorieTarget > 0 ? calorieTarget : 1500;
  const fatTarget     = computeFatTargetGrams(effectiveCals, gender);
  const proteinCals   = proteinTarget * CALORIES_PER_PROTEIN_G;
  const fatCals       = fatTarget     * CALORIES_PER_FAT_G;
  const carbsTarget   = Math.max(0, Math.round((effectiveCals - proteinCals - fatCals) / CALORIES_PER_CARB_G));
  return { proteinTarget, fatTarget, carbsTarget };
}

/**
 * @param {{ consumed: number, target: number|null }}
 * @returns {{ progressPercent: number }}
 */
export function computeMacroProgress({ consumed, target }) {
  if (target == null || target <= 0) return { progressPercent: 0 };
  return { progressPercent: Math.min(100, Math.round((consumed / target) * 100)) };
}

// ─── Card 3: Heart Healthy ────────────────────────────────────────────────────

/**
 * @param {{ consumedFat: number, consumedSodium: number, consumedCholesterol: number, fatTarget: number|null, weight?: number|null }}
 * @returns {{ fat: {consumed:number,target:number|null,pct:number}, sodium: {consumed:number,target:number,pct:number}, cholesterol: {consumed:number,target:number,pct:number} }}
 *
 * Personalized targets (when weight is provided):
 *   sodium       — ~30 mg/kg body weight (AHA), capped at 2300 mg
 *   cholesterol  — 300 mg base; reduced by 1 mg per kg above 70 kg ref; floored at 200 mg
 */
export function computeHeartHealthyCard({ consumedFat, consumedSodium, consumedCholesterol, fatTarget, weight = null }) {
  const sodiumTarget = weight > 0
    ? Math.min(SODIUM_TARGET_MG, Math.round(weight * 30))
    : SODIUM_TARGET_MG;
  const cholesterolTarget = weight > 0
    ? Math.max(200, Math.round(CHOLESTEROL_TARGET_MG - Math.max(0, weight - 70)))
    : CHOLESTEROL_TARGET_MG;

  const fat = {
    consumed: Math.round(consumedFat || 0),
    target: fatTarget,
    pct: fatTarget != null && fatTarget > 0
      ? Math.min(100, Math.round((consumedFat / fatTarget) * 100))
      : 0,
  };
  const sodium = {
    consumed: Math.round(consumedSodium || 0),
    target: sodiumTarget,
    pct: Math.min(100, Math.round(((consumedSodium || 0) / sodiumTarget) * 100)),
  };
  const cholesterol = {
    consumed: Math.round(consumedCholesterol || 0),
    target: cholesterolTarget,
    pct: Math.min(100, Math.round(((consumedCholesterol || 0) / cholesterolTarget) * 100)),
  };
  return { fat, sodium, cholesterol };
}

// ─── Card 4: Low Carb ─────────────────────────────────────────────────────────

/**
 * @param {{ consumedCarbs: number, consumedSugar: number, consumedFiber: number, carbsTarget: number|null, calorieTarget?: number|null }}
 * @returns {{ carbs: {consumed:number,target:number|null,pct:number}, sugar: {consumed:number,target:number,pct:number}, fiber: {consumed:number,target:number,pct:number} }}
 *
 * Personalized targets (when calorieTarget is provided):
 *   sugar — WHO guideline: ≤10 % of daily energy / 4 kcal per gram
 */
export function computeLowCarbCard({ consumedCarbs, consumedSugar, consumedFiber, carbsTarget, calorieTarget = null }) {
  const sugarTarget = calorieTarget > 0
    ? Math.round((calorieTarget * 0.10) / 4)
    : SUGAR_TARGET_G;
  const carbs = {
    consumed: Math.round(consumedCarbs || 0),
    target: carbsTarget,
    pct: carbsTarget != null && carbsTarget > 0
      ? Math.min(100, Math.round((consumedCarbs / carbsTarget) * 100))
      : 0,
  };
  const sugar = {
    consumed: Math.round(consumedSugar || 0),
    target: sugarTarget,
    pct: Math.min(100, Math.round(((consumedSugar || 0) / sugarTarget) * 100)),
  };
  const fiber = {
    consumed: Math.round(consumedFiber || 0),
    target: FIBER_TARGET_G,
    pct: Math.min(100, Math.round(((consumedFiber || 0) / FIBER_TARGET_G) * 100)),
  };
  return { carbs, sugar, fiber };
}

// ─── Card 5: Glycemic Index (disabled — GI now shown on Low Carb card) ────────

/**
 * @param {{ averageGlycemicIndex: number|null, mealCount: number }}
 * @returns {{ averageGI: number|null, mealCount: number, zone: string|null }}
 *
 * GI Zones (carb-weighted average):
 *   Low: ≤55 (green) — Good for blood sugar control
 *   Medium: 56-69 (amber) — Moderate impact
 *   High: ≥70 (red) — Rapid blood sugar spike
 */
export function computeGICard({ averageGlycemicIndex, mealCount }) {
  if (averageGlycemicIndex == null || mealCount === 0) {
    return { averageGI: null, mealCount: 0, zone: null };
  }
  const gi = Math.round(averageGlycemicIndex);
  const zone = gi <= 55 ? 'Low' : gi <= 69 ? 'Medium' : 'High';
  return { averageGI: gi, mealCount, zone };
}
