// User profile calorie target fetch — TDEE when activity level is set, else BMR.
import { getProfile } from '../../../user/services/user.api';

export const DEFAULT_CALORIE_TARGET = 1500;

export async function fetchUserCalorieTarget({ apiBaseUrl, email }) {
  if (!email) return DEFAULT_CALORIE_TARGET;
  try {
    // apiBaseUrl retained for call-site compatibility; getProfile uses config base URL.
    void apiBaseUrl;
    const data = await getProfile(email);
    if (data.success && data.data?.calorieTarget) {
      return Math.round(data.data.calorieTarget);
    }
    if (data.success && data.data?.latestBmr) {
      return Math.round(data.data.latestBmr);
    }
    return DEFAULT_CALORIE_TARGET;
  } catch (err) {
    console.error('[fetchUserCalorieTarget] Failed to fetch calorie target:', err);
    return DEFAULT_CALORIE_TARGET;
  }
}

/** @deprecated Use fetchUserCalorieTarget — kept for existing imports. */
export const fetchUserBmr = fetchUserCalorieTarget;

export const DEFAULT_BMR = DEFAULT_CALORIE_TARGET;
