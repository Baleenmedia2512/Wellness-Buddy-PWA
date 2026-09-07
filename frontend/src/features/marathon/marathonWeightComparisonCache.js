/**
 * In-memory cache for marathon Day 0 weight comparison (WhatsApp shares).
 * Populated from profile API and refreshed after weight saves.
 */

/** @type {object|null|undefined} undefined = never set; null = no comparison */
let cachedComparison = undefined;

/**
 * @param {object|null} comparison
 */
export function setMarathonWeightComparisonCache(comparison) {
  cachedComparison = comparison ?? null;
}

/**
 * @returns {object|null}
 */
export function getMarathonWeightComparisonFromCache() {
  return cachedComparison ?? null;
}

/**
 * @param {object|null|undefined} profileData
 */
export function syncMarathonWeightComparisonFromProfile(profileData) {
  if (!profileData || typeof profileData !== 'object') return;
  setMarathonWeightComparisonCache(profileData.marathonWeightComparison ?? null);
}
