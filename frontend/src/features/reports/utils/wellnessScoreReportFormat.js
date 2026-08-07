/**
 * Weight delta + score display helpers for Wellness Score Report.
 * Prefers API `difference` when present; falls back to today/previous.
 */

/**
 * @param {number|null|undefined} todayWeight
 * @param {number|null|undefined} previousWeight
 * @param {number|null|undefined} [differenceFromApi]
 * @returns {{
 *   direction: 'down'|'up'|'same'|'none',
 *   deltaKg: number|null,
 *   changeLabel: string,
 * }}
 */
export function computeWeightChange(todayWeight, previousWeight, differenceFromApi) {
  let deltaKg = null;
  if (differenceFromApi != null && Number.isFinite(Number(differenceFromApi))) {
    deltaKg = Number(differenceFromApi);
  } else {
    const today = todayWeight != null ? Number(todayWeight) : NaN;
    const prev = previousWeight != null ? Number(previousWeight) : NaN;
    if (Number.isFinite(today) && Number.isFinite(prev)) {
      deltaKg = Number((today - prev).toFixed(3));
    }
  }

  if (deltaKg == null || !Number.isFinite(deltaKg)) {
    return { direction: 'none', deltaKg: null, changeLabel: '—' };
  }

  if (Math.abs(deltaKg) < 0.0005) {
    return { direction: 'same', deltaKg: 0, changeLabel: '—' };
  }

  const abs = Math.abs(deltaKg);
  const direction = deltaKg < 0 ? 'down' : 'up';
  const changeLabel = abs < 1
    ? `${Math.round(abs * 1000)} g`
    : `${abs.toFixed(2)} kg`;

  return { direction, deltaKg, changeLabel };
}

/**
 * @param {number|null|undefined} kg
 * @returns {string}
 */
export function formatWeightKg(kg) {
  if (kg == null || kg === '') return '';
  const n = Number(kg);
  if (!Number.isFinite(n)) return '';
  return `${n.toFixed(2)} kg`;
}

/**
 * Display percentage / 100 (never earned points).
 * @param {number|null|undefined} score
 * @returns {string}
 */
export function formatWellnessScore(score) {
  if (score == null || score === '') return '—';
  const n = Number(score);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)} / 100`;
}
