/**
 * Pure weight-delta helpers for Wellness Score Report (shared server/client rules).
 */

/**
 * todayWeight − previousWeight in kg, or null when either value is missing.
 * @param {number|null|undefined} todayWeight
 * @param {number|null|undefined} previousWeight
 * @returns {number|null}
 */
export function computeWeightDifferenceKg(todayWeight, previousWeight) {
  const today = todayWeight != null ? Number(todayWeight) : NaN;
  const prev = previousWeight != null ? Number(previousWeight) : NaN;
  if (!Number.isFinite(today) || !Number.isFinite(prev)) return null;
  return Number((today - prev).toFixed(3));
}

/**
 * Format a kg delta for UI / Excel: grams below 1 kg, else kg with 2 decimals.
 * @param {number|null|undefined} differenceKg
 * @returns {{ direction: 'down'|'up'|'same'|'none', changeLabel: string }}
 */
export function formatWeightDifference(differenceKg) {
  if (differenceKg == null || !Number.isFinite(Number(differenceKg))) {
    return { direction: 'none', changeLabel: '—' };
  }
  const delta = Number(differenceKg);
  if (Math.abs(delta) < 0.0005) {
    return { direction: 'same', changeLabel: '—' };
  }
  const abs = Math.abs(delta);
  const direction = delta < 0 ? 'down' : 'up';
  const changeLabel = abs < 1
    ? `${Math.round(abs * 1000)} g`
    : `${abs.toFixed(2)} kg`;
  return { direction, changeLabel };
}
