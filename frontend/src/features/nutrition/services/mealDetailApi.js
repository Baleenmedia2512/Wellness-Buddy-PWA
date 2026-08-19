/**
 * Network client for single/batch meal detail fetches.
 * All meal-detail I/O goes through mealDetailCache — do not call directly from UI.
 */

/**
 * @param {Object} params
 * @param {string} params.apiBaseUrl
 * @param {string} params.userId
 * @param {string|number} params.mealId
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<object>} meal row (food_nutrition_data_table shape)
 */
export async function fetchMealDetailRow({ apiBaseUrl, userId, mealId, signal }) {
  const url = `${apiBaseUrl}/api/food-corrections/meal?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(mealId)}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    signal,
  });
  const body = await readJsonBody(res);
  if (!res.ok || !body?.success || !body?.data) {
    const err = new Error(body?.message || 'Unable to load food details.');
    err.status = res.status;
    throw err;
  }
  return body.data;
}

/**
 * @param {Object} params
 * @param {string} params.apiBaseUrl
 * @param {string} params.userId
 * @param {Array<string|number>} params.mealIds
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<object[]>}
 */
export async function fetchMealDetailRowsBatch({ apiBaseUrl, userId, mealIds, signal }) {
  if (!mealIds?.length) return [];
  const ids = mealIds.map(String).join(',');
  const url = `${apiBaseUrl}/api/food-corrections/meals?userId=${encodeURIComponent(userId)}&ids=${encodeURIComponent(ids)}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    signal,
  });
  const body = await readJsonBody(res);
  if (!res.ok || !body?.success) {
    const err = new Error(body?.message || 'Unable to load food details.');
    err.status = res.status;
    throw err;
  }
  return Array.isArray(body.data) ? body.data : [];
}

async function readJsonBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: 'Unable to load food details.' };
  }
}
