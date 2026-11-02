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

/**
 * Inclusive range watch burn map for home carousel (1 request instead of N days).
 * Returns { 'YYYY-MM-DD': number }.
 */
export async function fetchWatchBurnedCaloriesRange({ apiBaseUrl, userId, startDate, endDate }) {
  if (!userId || !startDate || !endDate) return {};
  try {
    const params = new URLSearchParams({
      userId: String(userId),
      startDate: String(startDate),
      endDate: String(endDate),
      _t: String(Date.now()),
    });
    const res = await fetch(
      `${apiBaseUrl}/api/activity/watch-calories?${params.toString()}`,
    );
    const json = await res.json();
    if (!json?.success) return {};
    return json.byDate && typeof json.byDate === 'object' ? json.byDate : {};
  } catch (err) {
    console.warn('[fetchWatchBurnedCaloriesRange] failed:', err);
    return {};
  }
}
