// Burn-to-Balance support: watch-derived calories burned for a given day.
import { toLocalDateString } from './analysisHelpers';

function resolveDateString(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return toLocalDateString(date);
}

export async function fetchWatchBurnedCalories({ apiBaseUrl, userId, date }) {
  if (!userId) return 0;
  try {
    const dateStr = resolveDateString(date);
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
