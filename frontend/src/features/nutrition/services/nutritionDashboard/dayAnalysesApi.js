// Day-of-meals fetcher. Returns { success, list, error } — never throws.
// Demo accounts also receive any locally-stored meals matching the date.
import { toLocalDateString } from './analysisHelpers';
import * as Session from '../../../../shared/services/sessionStorage';

function resolveDateString(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return toLocalDateString(date);
}

export async function fetchDayAnalyses({ apiBaseUrl, userId, date }) {
  if (!userId) return { success: false, list: [], error: 'no-user' };

  const dateString = resolveDateString(date);
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
        const demoMeals = JSON.parse(Session.getDemoMealsRaw() || '[]');
        list = [...list, ...demoMeals.filter((m) => m.dateKey === dateString)];
      } catch { /* ignore */ }
    }
    return { success: true, list };
  } catch (error) {
    console.error('[fetchDayAnalyses] Error:', error);
    return { success: false, list: [], error: 'network' };
  }
}

/**
 * Inclusive range meal totals for home carousel (1 request instead of N days).
 * Returns { success, byDate: { 'YYYY-MM-DD': dailyTotals } }.
 */
export async function fetchRangeMealTotals({ apiBaseUrl, userId, startDate, endDate }) {
  if (!userId || !startDate || !endDate) {
    return { success: false, byDate: {}, error: 'no-user' };
  }
  try {
    const params = new URLSearchParams({
      userId: String(userId),
      startDate: String(startDate),
      endDate: String(endDate),
      totalsOnly: 'true',
      _t: String(Date.now()),
    });
    const res = await fetch(
      `${apiBaseUrl}/api/food-corrections/stats?${params.toString()}`,
      { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
    );
    const data = await res.json();
    if (!data?.success) return { success: false, byDate: {}, error: 'api-failed' };
    return { success: true, byDate: data.byDate || {} };
  } catch (error) {
    console.error('[fetchRangeMealTotals] Error:', error);
    return { success: false, byDate: {}, error: 'network' };
  }
}
