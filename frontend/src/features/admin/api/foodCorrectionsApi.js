/**
 * admin/api/foodCorrectionsApi.js
 * ---------------------------------------------------------------------------
 * Admin-scoped API client for the /api/food-corrections endpoint.
 * Exists so FoodCorrectionsDebugPanel does not cross into the food-corrections
 * feature boundary (claude.md §2.2 — no cross-feature imports).
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

/**
 * Fetch all corrections for a single user.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getUserCorrections(userId) {
  const response = await fetch(`${base()}/api/food-corrections?userId=${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}
