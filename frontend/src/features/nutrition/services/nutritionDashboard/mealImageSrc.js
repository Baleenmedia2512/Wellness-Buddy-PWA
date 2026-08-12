/**
 * Resolve meal thumbnail / detail image src without embedding ImageBase64 in list APIs.
 */
import { getApiBaseUrl } from '../../../../config/api.config.js';

function asDataUrl(base64) {
  if (!base64 || String(base64).trim() === '') return null;
  const raw = String(base64);
  return raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`;
}

/**
 * @param {{ ImageBase64?: string|null, ImagePath?: string|null, ID?: string|number, id?: string|number }} meal
 * @param {{ userId?: string|number|null, apiBaseUrl?: string|null }} [opts]
 * @returns {string|null}
 */
export function resolveMealImageSrc(meal, { userId, apiBaseUrl } = {}) {
  if (!meal) return null;

  const embedded = asDataUrl(meal.ImageBase64);
  if (embedded) return embedded;

  if (meal.ImagePath && String(meal.ImagePath).trim() !== ''
    && (String(meal.ImagePath).startsWith('http') || String(meal.ImagePath).startsWith('data:'))) {
    return meal.ImagePath;
  }

  const mealId = meal.ID ?? meal.id;
  if (mealId != null && userId != null) {
    const base = apiBaseUrl || getApiBaseUrl();
    return `${base}/api/food-corrections/meal-image?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(mealId)}`;
  }

  if (meal.ImagePath && String(meal.ImagePath).trim() !== '') {
    return meal.ImagePath;
  }
  return null;
}
