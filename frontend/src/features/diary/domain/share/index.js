/**
 * diary/domain/share/index.js
 *
 * Activity-specific WhatsApp share caption dispatcher.
 * Extensible: add a builder + case for future activity types.
 */

import { DIARY_FOOD_ACTIVITY } from '../activityType';
import { buildFoodShareText } from './foodShare';
import { buildWaterShareText } from './waterShare';
import { buildAfreshShareText } from './afreshShare';
import { buildShakeShareText } from './shakeShare';
import { buildEducationShareText } from './educationShare';
import { buildWeightShareText } from './weightShare';
import { buildDiaryShareSuffix } from './suffixes';

export { buildFoodShareText } from './foodShare';
export { buildWaterShareText } from './waterShare';
export { buildAfreshShareText } from './afreshShare';
export { buildShakeShareText } from './shakeShare';
export { buildEducationShareText } from './educationShare';
export { buildWeightShareText, resolveWeightDeltaDisplay } from './weightShare';
export { buildDiaryShareSuffix } from './suffixes';

/**
 * Build the WhatsApp caption for a diary entry (rich multi-line template).
 *
 * @param {'food'|'water'|'afresh'|'shake'|'education'|'weight'|string} activityType
 * @param {object} [payload]
 * @returns {string}
 */
export function buildDiaryShareText(activityType, payload = {}) {
  switch (activityType) {
    case DIARY_FOOD_ACTIVITY.WATER:
    case 'water':
      return buildWaterShareText(payload);
    case DIARY_FOOD_ACTIVITY.AFRESH:
    case 'afresh':
      return buildAfreshShareText(payload);
    case DIARY_FOOD_ACTIVITY.SHAKE:
    case 'shake':
      return buildShakeShareText(payload);
    case 'education':
      return buildEducationShareText(payload);
    case 'weight':
      return buildWeightShareText(payload);
    case DIARY_FOOD_ACTIVITY.FOOD:
    case 'food':
    default:
      return buildFoodShareText(payload);
  }
}
