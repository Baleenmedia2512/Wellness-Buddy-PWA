/**
 * diary/domain/share/beverageDayShare.js
 *
 * Resolve water / Afresh WhatsApp suffixes from day-level totals
 * (matching ManualEntry share), with per-entry fallbacks.
 * Pure — zero I/O.
 */

import { DIARY_FOOD_ACTIVITY } from '../activityType';
import { buildDiaryShareSuffix } from './suffixes';

/**
 * @param {{
 *   activityType?: string,
 *   totalMl?: number|null,
 *   totalAfreshScoops?: number|null,
 *   fallbackVolumeMl?: number|null,
 *   fallbackScoops?: number|null,
 *   calories?: number,
 * }} [input]
 * @returns {string|null}
 */
export function resolveBeverageDayShareText({
  activityType = null,
  totalMl = null,
  totalAfreshScoops = null,
  fallbackVolumeMl = null,
  fallbackScoops = null,
  calories = 0,
} = {}) {
  if (activityType === DIARY_FOOD_ACTIVITY.WATER || activityType === 'water') {
    const volumeMl = totalMl != null ? totalMl : fallbackVolumeMl;
    return buildDiaryShareSuffix('water', { volumeMl });
  }
  if (activityType === DIARY_FOOD_ACTIVITY.AFRESH || activityType === 'afresh') {
    const scoops = totalAfreshScoops != null ? totalAfreshScoops : (fallbackScoops ?? 1);
    return buildDiaryShareSuffix('afresh', { scoops, calories });
  }
  return null;
}
