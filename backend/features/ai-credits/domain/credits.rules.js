/**
 * ai-credits domain — pure rules (no I/O).
 */
export const DEFAULT_DAILY_AI_CREDITS = 3;
export const DEFAULT_AI_MODE_ENABLED = true;

/**
 * @param {{ enabled: boolean, dailyLimit: number, used: number, usageDate: string, timezoneIana: string }}
 */
export function buildStatus({ enabled, dailyLimit, used, usageDate, timezoneIana }) {
  const limit = Math.max(0, Number(dailyLimit) || 0);
  const usedSafe = Math.max(0, Number(used) || 0);
  const remaining = Math.max(0, limit - usedSafe);
  const modeOn = Boolean(enabled) && limit > 0;
  return {
    enabled: modeOn,
    dailyLimit: limit,
    used: usedSafe,
    remaining,
    usageDate: usageDate || null,
    timezoneIana: timezoneIana || null,
  };
}

/**
 * @param {{ enabled: boolean, dailyLimit: number, used: number, pendingReservations: number }}
 */
export function canReserve({ enabled, dailyLimit, used, pendingReservations = 0 }) {
  if (!enabled || dailyLimit <= 0) {
    return { allowed: false, reason: 'disabled' };
  }
  const usedSafe = Math.max(0, Number(used) || 0);
  const pending = Math.max(0, Number(pendingReservations) || 0);
  if (usedSafe + pending >= dailyLimit) {
    return { allowed: false, reason: 'limit_reached' };
  }
  return { allowed: true };
}

/**
 * Successful food AI = imageType food AND at least one named food item (or non-empty foods list).
 * @param {{ imageType?: string, details?: object, fastNutrition?: object }|null|undefined} result
 */
export function isSuccessfulFoodAnalysis(result) {
  if (!result || result.imageType !== 'food') return false;
  const foods = result.details?.foods;
  if (Array.isArray(foods) && foods.some((f) => f && (f.name || f.foodName))) return true;
  const macros = result.fastNutrition || result.details?.total || result.details?.nutrition;
  if (macros && Number(macros.calories) > 0) return true;
  return false;
}

/**
 * Normalize admin config payload.
 */
export function normalizeConfig({ dailyAiCredits, aiModeEnabled } = {}) {
  let credits = Number(dailyAiCredits);
  if (!Number.isFinite(credits)) credits = DEFAULT_DAILY_AI_CREDITS;
  credits = Math.max(0, Math.min(1000, Math.round(credits)));
  return {
    dailyAiCredits: credits,
    aiModeEnabled: aiModeEnabled === undefined ? DEFAULT_AI_MODE_ENABLED : Boolean(aiModeEnabled),
  };
}
