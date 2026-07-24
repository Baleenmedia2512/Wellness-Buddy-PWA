import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * Day meals for contribution sheets (same source nutrition dashboard uses).
 * @returns {Promise<object[]>}
 */
export async function fetchDayMealsForScore({ userId, date, apiBaseUrl }) {
  if (!userId || !date) return [];

  const params = new URLSearchParams({
    userId: String(userId),
    date: String(date),
    detailed: 'true',
    _t: String(Date.now()),
  });

  const res = await fetch(`${apiBaseUrl || getApiBaseUrl()}/api/food-corrections/stats?${params}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to load meal contributions');
  }
  return Array.isArray(payload.data) ? payload.data : [];
}
