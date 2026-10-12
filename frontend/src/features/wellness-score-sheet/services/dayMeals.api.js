import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * Day meals for contribution sheets (same source nutrition dashboard uses).
 * @returns {Promise<object[]>}
 */
export async function fetchDayMealsForScore({ userId, date, apiBaseUrl, viewerUserId = null }) {
  if (!userId || !date) return [];

  const params = new URLSearchParams({
    userId: String(userId),
    date: String(date),
    detailed: 'true',
    _t: String(Date.now()),
  });
  if (viewerUserId != null && viewerUserId !== '' && String(viewerUserId) !== String(userId)) {
    params.set('viewerUserId', String(viewerUserId));
  }

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

/**
 * Meal rows across calendar days for Last N Days / Custom contribution sheets.
 * Fetches days in parallel (same pattern as home carousel `fetchRangeDayAnalyses`).
 * @returns {Promise<object[]>}
 */
export async function fetchRangeMealsForScore({
  userId,
  dates = [],
  apiBaseUrl,
  viewerUserId = null,
}) {
  if (!userId || !Array.isArray(dates) || dates.length === 0) return [];

  const uniqueDates = [...new Set(dates.map((d) => String(d || '').trim()).filter(Boolean))];
  if (uniqueDates.length === 0) return [];
  if (uniqueDates.length === 1) {
    return fetchDayMealsForScore({
      userId,
      date: uniqueDates[0],
      apiBaseUrl,
      viewerUserId,
    });
  }

  const results = await Promise.all(
    uniqueDates.map((date) => fetchDayMealsForScore({
      userId,
      date,
      apiBaseUrl,
      viewerUserId,
    })),
  );
  return results.flat();
}
