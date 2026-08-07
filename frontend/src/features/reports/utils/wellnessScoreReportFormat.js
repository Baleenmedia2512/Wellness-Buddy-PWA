/**
 * Weight delta display helpers for Wellness Score Report.
 * Frontend calculates difference from todayWeight + previousWeight.
 */

/**
 * @param {number|null|undefined} todayWeight
 * @param {number|null|undefined} previousWeight
 * @returns {{
 *   direction: 'down'|'up'|'same'|'none',
 *   deltaKg: number|null,
 *   changeLabel: string,
 *   comparisonLabel: string,
 * }}
 */
export function computeWeightChange(todayWeight, previousWeight) {
  const today = todayWeight != null ? Number(todayWeight) : NaN;
  const prev = previousWeight != null ? Number(previousWeight) : NaN;

  if (!Number.isFinite(today) || !Number.isFinite(prev)) {
    return {
      direction: 'none',
      deltaKg: null,
      changeLabel: '—',
      comparisonLabel: formatWeightKg(todayWeight) || '—',
    };
  }

  const deltaKg = Number((today - prev).toFixed(3));
  const comparisonLabel = `${formatWeightKg(prev)} → ${formatWeightKg(today)}`;

  if (Math.abs(deltaKg) < 0.0005) {
    return {
      direction: 'same',
      deltaKg: 0,
      changeLabel: '—',
      comparisonLabel,
    };
  }

  const abs = Math.abs(deltaKg);
  const direction = deltaKg < 0 ? 'down' : 'up';
  let changeLabel;
  if (abs < 1) {
    const grams = Math.round(abs * 1000);
    changeLabel = `${grams} g`;
  } else {
    changeLabel = `${abs.toFixed(2)} kg`;
  }

  return { direction, deltaKg, changeLabel, comparisonLabel };
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
 * @param {number|null|undefined} score
 * @param {number|null|undefined} possible
 * @returns {string}
 */
export function formatWellnessScore(score, possible = 100) {
  if (score == null || score === '') return '—';
  const n = Number(score);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n);
  if (possible != null && Number.isFinite(Number(possible))) {
    return `${rounded} / ${Math.round(Number(possible))}`;
  }
  return String(rounded);
}
