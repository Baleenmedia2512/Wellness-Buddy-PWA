// User profile calorie target fetch — TDEE when activity level is set, else BMR.
export const DEFAULT_CALORIE_TARGET = 1500;

export async function fetchUserCalorieTarget({ apiBaseUrl, email }) {
  if (!email) return DEFAULT_CALORIE_TARGET;
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(email)}&_t=${Date.now()}`,
    );
    if (!res.ok) return DEFAULT_CALORIE_TARGET;
    const data = await res.json();
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
