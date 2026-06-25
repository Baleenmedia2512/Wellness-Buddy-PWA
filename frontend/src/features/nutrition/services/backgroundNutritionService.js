// src/services/backgroundNutritionService.js

/**
 * Fetches the most recent background-saved nutrition analysis for a user.
 * Only returns entries processed by the background service and not deleted.
 * @param {string|number} userId
 * @returns {Promise<object|null>} Most recent record or null
 */
export async function fetchLatestBackgroundNutrition(userId) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  try {
    const res = await fetch(`${apiBaseUrl}/api/background-analysis?userId=${userId}&limit=1&offset=0`);
    if (!res.ok) throw new Error('Failed to fetch background nutrition');
    const data = await res.json();
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      // Only return if processed by background_service and not deleted
      const record = data.data.find(
        r => r.ProcessedBy === 'background_service' && !r.IsDeleted
      );
      return record || null;
    }
    return null;
  } catch (err) {
    console.error('[fetchLatestBackgroundNutrition] Error:', err);
    return null;
  }
}
