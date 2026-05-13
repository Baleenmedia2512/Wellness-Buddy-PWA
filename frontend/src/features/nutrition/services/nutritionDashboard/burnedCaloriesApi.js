// Burn-to-Balance support: watch-derived calories burned for a given day.
import { toLocalDateString } from './analysisHelpers';

export async function fetchWatchBurnedCalories({ apiBaseUrl, userId, date }) {
  if (!userId) return 0;
  try {
    const dateStr = toLocalDateString(date);
    const res = await fetch(
      `${apiBaseUrl}/api/activity/watch-calories?userId=${userId}&date=${dateStr}&_t=${Date.now()}`,
    );
    const json = await res.json();
    return json.success ? (json.caloriesBurned || 0) : 0;
  } catch (err) {
    console.warn('[fetchWatchBurnedCalories] failed:', err);
    return 0;
  }
}
