/**
 * Marathon Day 0 weight comparison — pure formatting helpers.
 * Date resolution lives in marathonCalendar.js; weight lookup is server-side.
 */

/** @param {unknown} value */
export function isValidMarathonWeightKg(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) && n > 0;
}

/** @param {number} value */
export function roundMarathonWeightKg(value) {
  return Math.round(value * 10) / 10;
}

/**
 * @param {number} previousMarathonEndWeight
 * @param {number} currentMarathonDay0Weight
 * @returns {'increase'|'decrease'|'unchanged'}
 */
export function resolveMarathonWeightDirection(previousMarathonEndWeight, currentMarathonDay0Weight) {
  const diff = roundMarathonWeightKg(currentMarathonDay0Weight - previousMarathonEndWeight);
  if (Math.abs(diff) < 0.01) return 'unchanged';
  return diff > 0 ? 'increase' : 'decrease';
}

/**
 * @param {number} weightDifference signed kg delta
 * @param {'increase'|'decrease'|'unchanged'} direction
 * @returns {string}
 */
export function formatMarathonWeightChangeLabel(weightDifference, direction) {
  if (direction === 'unchanged') return '0 kg — No Change';
  const abs = roundMarathonWeightKg(Math.abs(weightDifference));
  const signed = direction === 'increase' ? `+${abs.toFixed(1)}` : `−${abs.toFixed(1)}`;
  const suffix = direction === 'increase' ? '↑ Increase' : '↓ Decrease';
  return `${signed} kg ${suffix}`;
}

/**
 * @param {object} input
 * @param {unknown} input.previousMarathonEndWeight
 * @param {unknown} input.currentMarathonDay0Weight
 * @returns {object|null}
 */
export function buildMarathonWeightComparison({
  previousMarathonEndWeight,
  currentMarathonDay0Weight,
}) {
  if (!isValidMarathonWeightKg(previousMarathonEndWeight)
    || !isValidMarathonWeightKg(currentMarathonDay0Weight)) {
    return null;
  }

  const previous = roundMarathonWeightKg(Number(previousMarathonEndWeight));
  const current = roundMarathonWeightKg(Number(currentMarathonDay0Weight));
  const weightDifference = roundMarathonWeightKg(current - previous);
  const direction = resolveMarathonWeightDirection(previous, current);

  return {
    previousMarathonEndWeight: previous,
    currentMarathonDay0Weight: current,
    weightDifference,
    direction,
    changeLabel: formatMarathonWeightChangeLabel(weightDifference, direction),
  };
}

/**
 * WhatsApp caption block for Day 0 marathon weight progress.
 * @param {object|null|undefined} comparison
 * @returns {string|null}
 */
export function formatMarathonWeightWhatsAppNotice(comparison) {
  if (!comparison || typeof comparison !== 'object') return null;
  const previous = comparison.previousMarathonEndWeight;
  const current = comparison.currentMarathonDay0Weight;
  const changeLabel = comparison.changeLabel;
  if (!isValidMarathonWeightKg(previous) || !isValidMarathonWeightKg(current) || !changeLabel) {
    return null;
  }
  const prev = roundMarathonWeightKg(Number(previous));
  const cur = roundMarathonWeightKg(Number(current));
  return [
    `Previous Marathon End: ${prev.toFixed(1)} kg`,
    `Current Marathon Start: ${cur.toFixed(1)} kg`,
    `Weight Change: ${changeLabel}`,
  ].join('\n');
}
