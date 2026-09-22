/**
 * Resolve meal thumbnail / detail image src without embedding ImageBase64 in list APIs.
 */
import { getApiBaseUrl } from '../../../../config/api.config.js';

/**
 * @param {{ ImagePath?: string|null, ID?: string|number, id?: string|number }} meal
 * @param {{ userId?: string|number|null, apiBaseUrl?: string|null }} [opts]
 * @returns {string|null}
 */
export function resolveMealImageSrc(meal, { userId, apiBaseUrl } = {}) {
  if (!meal) return null;

  const path = meal.ImagePath && String(meal.ImagePath).trim();
  if (path && path.startsWith('http')) {
    return path;
  }

  const mealId = meal.ID ?? meal.id;
  if (mealId != null && userId != null) {
    const base = apiBaseUrl || getApiBaseUrl();
    return `${base}/api/food-corrections/meal-image?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(mealId)}`;
  }

  return null;
}
