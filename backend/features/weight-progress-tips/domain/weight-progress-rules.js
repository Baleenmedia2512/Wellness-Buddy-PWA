/**
 * weight-progress-rules.js — PURE domain logic for weight progress tips.
 * 
 * NO I/O, NO fetch, NO Date.now() directly.
 * All business rules for detecting reverse progress and generating tips.
 */

const REVERSE_PROGRESS_THRESHOLD_KG = 0.3;

/**
 * Check if user has reverse progress (weight moved wrong direction)
 * @param {{ currentWeight: number, previousWeight: number, goalMode: string }} input
 * @returns {{ hasReverseProgress: boolean, change: number, direction: string }}
 */
export function checkReverseProgress({ currentWeight, previousWeight, goalMode }) {
  if (!currentWeight || !previousWeight || !goalMode) {
    return { hasReverseProgress: false, change: 0, direction: 'none' };
  }

  const change = currentWeight - previousWeight;
  const absChange = Math.abs(change);

  // Change too small - ignore (normal fluctuation)
  if (absChange < REVERSE_PROGRESS_THRESHOLD_KG) {
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
 * Compare today vs yesterday nutrition
 * @param {{ today: object, yesterday: object }} input
 * @returns {{ calories: object, protein: object, carbs: object, fat: object }}
 */
export function compareNutrition({ today, yesterday }) {
  const compareMetric = (metric) => {
    const t = today?.[metric] || 0;
    const y = yesterday?.[metric] || 0;
    return { today: t, yesterday: y, diff: t - y };
  };

  return {
    calories: compareMetric('calories'),
    protein: compareMetric('protein'),
    carbs: compareMetric('carbs'),
    fat: compareMetric('fat'),
  };
}

/**
 * Generate actionable tips based on comparison data
 * @param {{ nutritionDiff: object, waterYesterday: number, goalMode: string, weightChange: number }} input
 * @returns {Array<{ priority: string, message: string, icon: string }>}
 */
export function generateTips({ nutritionDiff, waterYesterday, goalMode, weightChange }) {
  const tips = [];

  // Calorie tips
  const calDiff = nutritionDiff?.calories?.diff || 0;
  if (goalMode === 'loss' && calDiff > 100) {
    tips.push({
      priority: 'high',
      message: `Calorie intake increased by ${Math.round(calDiff)} kcal. Try reducing today.`,
      icon: '🔥',
    });
  } else if (goalMode === 'gain' && calDiff < -100) {
    tips.push({
      priority: 'high',
      message: `Calorie intake decreased by ${Math.abs(Math.round(calDiff))} kcal. Try eating more today.`,
      icon: '🔥',
    });
  }

  // Water tips
  const waterTarget = 2000; // ml (simplified, can be weight-based later)
  if (waterYesterday < waterTarget) {
    tips.push({
      priority: 'medium',
      message: `Water intake was ${waterYesterday} ml. Target: ${waterTarget} ml. Stay hydrated today!`,
      icon: '💧',
    });
  }

  // Macro tips
  const carbDiff = nutritionDiff?.carbs?.diff || 0;
  const fatDiff = nutritionDiff?.fat?.diff || 0;

  if (goalMode === 'loss') {
    if (carbDiff > 20) {
      tips.push({
        priority: 'medium',
        message: `Carbs increased by ${Math.round(carbDiff)}g. Consider reducing refined carbs.`,
        icon: '🍞',
      });
    }
    if (fatDiff > 10) {
      tips.push({
        priority: 'medium',
        message: `Fat increased by ${Math.round(fatDiff)}g. Opt for lean proteins today.`,
        icon: '🥑',
      });
    }
  }

  // Generic tip if no specific issues found
  if (tips.length === 0) {
    tips.push({
      priority: 'low',
      message: 'Track your meals consistently and stay active!',
      icon: '✅',
    });
  }

  return tips.sort((a, b) => {
    const order = { high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
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
