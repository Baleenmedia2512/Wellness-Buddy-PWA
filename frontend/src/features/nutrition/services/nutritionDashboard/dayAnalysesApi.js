// Day-of-meals fetcher. Returns { success, list, error } — never throws.
// Demo accounts also receive any locally-stored meals matching the date.
import { toLocalDateString } from './analysisHelpers';

export async function fetchDayAnalyses({ apiBaseUrl, userId, date }) {
  if (!userId) return { success: false, list: [], error: 'no-user' };

  const dateString = toLocalDateString(date);
  const cacheBuster = Date.now();
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/food-corrections/stats?userId=${userId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
      { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
    );
    const data = await res.json();
    if (!data.success) return { success: false, list: [], error: 'api-failed' };

    let list = data.data || [];
    if (userId === 'DEMO_USER') {
      try {
        const demoMeals = JSON.parse(localStorage.getItem('demo_meals') || '[]');
        list = [...list, ...demoMeals.filter((m) => m.dateKey === dateString)];
      } catch { /* ignore */ }
    }
    return { success: true, list };
  } catch (error) {
    console.error('[fetchDayAnalyses] Error:', error);
    return { success: false, list: [], error: 'network' };
  }
}
