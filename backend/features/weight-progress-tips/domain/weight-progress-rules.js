/**
 * weight-progress-rules.js — PURE domain logic for weight progress tips.
 * 
 * NO I/O, NO fetch, NO Date.now() directly.
 * All business rules for detecting reverse progress and generating tips.
 */

/** Ignore floating-point noise only (not a business threshold). */
const FLOAT_EPSILON_KG = 0.001;

/**
 * Check if user has reverse progress (weight moved wrong direction).
 *
 * Rules (per product spec):
 *   Loss mode — today > previous  => reverse progress
 *   Gain mode — today < previous  => reverse progress
 *
 * @param {{ currentWeight: number, previousWeight: number, goalMode: string }} input
 * @returns {{ hasReverseProgress: boolean, change: number, direction: string }}
 */
export function checkReverseProgress({ currentWeight, previousWeight, goalMode }) {
  if (!currentWeight || !previousWeight || !goalMode) {
    return { hasReverseProgress: false, change: 0, direction: 'none' };
  }

  const change = currentWeight - previousWeight;

  if (Math.abs(change) < FLOAT_EPSILON_KG) {
    return { hasReverseProgress: false, change, direction: 'neutral' };
  }

  // Loss mode: reverse progress = weight increased
  if (goalMode === 'loss' && change > 0) {
    return { hasReverseProgress: true, change, direction: 'increased' };
  }

  // Gain mode: reverse progress = weight decreased
  if (goalMode === 'gain' && change < 0) {
    return { hasReverseProgress: true, change: Math.abs(change), direction: 'decreased' };
  }

  // Progress is favorable
  return { hasReverseProgress: false, change, direction: 'favorable' };
}

/**
 * Compute the target daily calorie intake based on BMR and goal mode.
 * Uses a 15 % deficit for loss and a 15 % surplus for gain.
 * Returns 0 when BMR is unavailable so callers can skip calorie tips gracefully.
 *
 * @param {number|null} bmr
 * @param {string} goalMode  'loss' | 'gain' | 'maintain'
 * @returns {number} target kcal (0 = unknown)
 */
export function computeCalorieTarget(bmr, goalMode) {
  const b = parseFloat(bmr);
  if (!Number.isFinite(b) || b <= 0) return 0;
  if (goalMode === 'loss') return Math.round(b * 0.85);
  if (goalMode === 'gain') return Math.round(b * 1.15);
  return Math.round(b);
}

/**
 * Compute the minimum recommended daily protein intake (g) using 1.2 g / kg body weight.
 * Returns 0 when weight is unavailable.
 *
 * @param {number|null} weightKg
 * @returns {number} target protein in grams (0 = unknown)
 */
export function computeProteinTarget(weightKg) {
  const w = parseFloat(weightKg);
  if (!Number.isFinite(w) || w <= 0) return 0;
  return Math.round(w * 1.2);
}

/** Recommended daily fat intake: 0.75 g per kg body weight. */
export function computeFatTarget(weightKg) {
  const w = parseFloat(weightKg);
  if (!Number.isFinite(w) || w <= 0) return 0;
  return Math.round(w * 0.75);
}

/**
 * Carbs target derived from calorie budget minus protein and fat calories.
 * Clamped to ≥ 0 when protein+fat exceed the calorie target.
 */
export function computeCarbsTarget(bmr, goalMode, weightKg) {
  const calorieTarget = computeCalorieTarget(bmr, goalMode);
  const proteinTarget = computeProteinTarget(weightKg);
  const fatTarget = computeFatTarget(weightKg);
  if (calorieTarget <= 0) return 0;
  const remainingCals = calorieTarget - proteinTarget * 4 - fatTarget * 9;
  return Math.max(0, Math.round(remainingCals / 4));
}

/** Daily step goal shown in yesterday's analysis (matches tip messaging). */
export const STEPS_TARGET = 8000;

/** Recommended sleep hours shown in yesterday's analysis. */
export const SLEEP_TARGET_HRS = 8;

const CALORIES_PER_PROTEIN_G = 4;
const CALORIES_PER_CARB_G = 4;
const CALORIES_PER_FAT_G = 9;

/**
 * Macro targets aligned with the nutrition carousel (carouselRules.computeMacroTargets).
 * Protein = weight × 1.5 g, fat = weight × 0.75 g, carbs derived from BMR budget.
 *
 * @param {number|null} bmr
 * @param {number|null} weightKg
 * @returns {{ proteinTarget: number, fatTarget: number, carbsTarget: number }}
 */
export function computeMacroTargets(bmr, weightKg) {
  const w = parseFloat(weightKg);
  if (!Number.isFinite(w) || w <= 0) {
    return { proteinTarget: 0, fatTarget: 0, carbsTarget: 0 };
  }
  const proteinTarget = Math.round(w * 1.5);
  const fatTarget = Math.round(w * 0.75);
  const b = parseFloat(bmr);
  const effectiveCals = Number.isFinite(b) && b > 0 ? Math.round(b) : 1500;
  const carbsTarget = Math.max(
    0,
    Math.round(
      (effectiveCals - proteinTarget * CALORIES_PER_PROTEIN_G - fatTarget * CALORIES_PER_FAT_G)
      / CALORIES_PER_CARB_G,
    ),
  );
  return { proteinTarget, fatTarget, carbsTarget };
}

/**
 * BMR used as the calorie target in yesterday's analysis (matches Calories carousel card).
 */
export function computeDisplayCalorieTarget(bmr) {
  const b = parseFloat(bmr);
  if (!Number.isFinite(b) || b <= 0) return 0;
  return Math.round(b);
}

/**
 * Generate actionable, yesterday-focused tips.
 *
 * Each tip explains what the user could have done differently YESTERDAY based on
 * their actual recorded values compared to their personal targets.
 *
 * @param {{
 *   yesterdayNutrition: { calories: number, protein: number, carbs: number, fat: number },
 *   waterYesterday: number,
 *   waterTarget: number,
 *   calorieTarget: number,
 *   proteinTarget: number,
 *   goalMode: string,
 *   weightChange: number,
 *   activityYesterday: { steps: number, caloriesBurned: number, activityType: string|null }|null,
 * }} input
 * @returns {Array<{ priority: string, message: string, icon: string }>}
 */
export function generateTips({
  yesterdayNutrition,
  waterYesterday,
  waterTarget,
  calorieTarget,
  proteinTarget,
  goalMode,
  weightChange,
  activityYesterday,
}) {
  const tips = [];

  const calories = yesterdayNutrition?.calories || 0;
  const protein = yesterdayNutrition?.protein || 0;
  const carbs = yesterdayNutrition?.carbs || 0;
  const fat = yesterdayNutrition?.fat || 0;

  // ── Calorie tips (compare yesterday vs personal target) ───────────────────
  if (calorieTarget > 0) {
    if (goalMode === 'loss' && calories > calorieTarget + 100) {
      const over = Math.round(calories - calorieTarget);
      tips.push({
        priority: 'high',
        message: `Yesterday you consumed ${Math.round(calories)} kcal — ${over} kcal over your target of ${calorieTarget} kcal. Reducing meal portions or swapping high-calorie foods would have helped.`,
        icon: '🔥',
      });
    } else if (goalMode === 'gain' && calories < calorieTarget - 100) {
      const under = Math.round(calorieTarget - calories);
      tips.push({
        priority: 'high',
        message: `Yesterday you consumed only ${Math.round(calories)} kcal — ${under} kcal below your target of ${calorieTarget} kcal. Adding a calorie-dense snack (nuts, avocado, whole milk) would have helped.`,
        icon: '🔥',
      });
    }
  }

  // ── Protein tips ──────────────────────────────────────────────────────────
  if (proteinTarget > 0 && protein < proteinTarget * 0.8) {
    const shortfall = Math.round(proteinTarget - protein);
    tips.push({
      priority: goalMode === 'gain' ? 'high' : 'medium',
      message: `Yesterday's protein was ${Math.round(protein)} g — ${shortfall} g below your target of ${proteinTarget} g. Including more chicken, eggs, lentils, or Greek yoghurt would have helped.`,
      icon: '🥩',
    });
  }

  // ── Carbohydrate tips (loss mode) ─────────────────────────────────────────
  if (goalMode === 'loss' && carbs > 200) {
    tips.push({
      priority: 'medium',
      message: `Yesterday's carbohydrate intake was ${Math.round(carbs)} g. Swapping refined carbs (white rice, bread, sugary drinks) for vegetables or whole grains would have reduced this.`,
      icon: '🍞',
    });
  }

  // ── Fat tips (loss mode) ──────────────────────────────────────────────────
  if (goalMode === 'loss' && fat > 70) {
    tips.push({
      priority: 'medium',
      message: `Yesterday's fat intake was ${Math.round(fat)} g. Choosing lean proteins and reducing fried or processed foods would have made a difference.`,
      icon: '🥑',
    });
  }

  // ── Water tips ────────────────────────────────────────────────────────────
  if (waterYesterday === 0) {
    tips.push({
      priority: 'medium',
      message: `No water intake was recorded yesterday. Aim for at least ${Math.round(waterTarget / 1000)} L (${waterTarget} ml) daily — dehydration can slow your metabolism.`,
      icon: '💧',
    });
  } else if (waterYesterday < waterTarget * 0.8) {
    const short = waterTarget - waterYesterday;
    tips.push({
      priority: 'medium',
      message: `Yesterday you drank ${waterYesterday} ml — ${short} ml below your daily target of ${waterTarget} ml. Keeping a water bottle nearby would have helped you hit your goal.`,
      icon: '💧',
    });
  }

  // ── Activity tips ─────────────────────────────────────────────────────────
  const steps = activityYesterday?.steps ?? 0;
  if (steps < 5000) {
    const msg =
      steps === 0
        ? `No physical activity was recorded yesterday. Even a 30-minute walk (≈ 4,000 steps) burns calories and supports your ${goalMode === 'loss' ? 'weight loss' : 'muscle gain'} goal.`
        : `Yesterday's step count was ${steps.toLocaleString()} steps. Aiming for 8,000–10,000 steps boosts your metabolism and reduces fat storage.`;
    tips.push({ priority: 'medium', message: msg, icon: '🏃' });
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  if (tips.length === 0) {
    tips.push({
      priority: 'low',
      message: 'Keep tracking your meals and staying active — consistency is the key to reaching your goal!',
      icon: '✅',
    });
  }

  return tips.sort((a, b) => {
    const order = { high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  });
}

/**
 * Calculate water target based on weight
 * @param {number} weightKg
 * @returns {number} target in ml
 */
export function calculateWaterTarget(weightKg) {
  if (!weightKg || weightKg <= 0) return 2000;
  return Math.round((weightKg / 20) * 1000);
}
