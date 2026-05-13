// User profile BMR fetch — used as the dashboard's calorie target.
const DEFAULT_BMR = 1500;

export async function fetchUserBmr({ apiBaseUrl, email }) {
  if (!email) return DEFAULT_BMR;
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(email)}&_t=${Date.now()}`,
    );
    if (!res.ok) return DEFAULT_BMR;
    const data = await res.json();
    if (data.success && data.data?.latestBmr) {
      return Math.round(data.data.latestBmr);
    }
    return DEFAULT_BMR;
  } catch (err) {
    console.error('[fetchUserBmr] Failed to fetch BMR:', err);
    return DEFAULT_BMR;
  }
}

export const DEFAULT_CALORIE_TARGET = DEFAULT_BMR;
