/**
 * Marathon Day 0 weight comparison — pure formatting helpers.
 * Date resolution lives in marathonCalendar.js; weight lookup is server-side.
 */

<<<<<<< HEAD
=======
/** Shown in profile and WhatsApp when a marathon anchor weight is not logged yet. */
export const MARATHON_WEIGHT_MISSING_LABEL = '—';

>>>>>>> Phase1_Yasheer
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
<<<<<<< HEAD
=======

/**
 * WhatsApp caption block for Day 0 marathon weight progress.
 * @param {object|null|undefined} comparison
 * @returns {string|null}
 */
/**
 * @param {'increase'|'decrease'|'unchanged'} direction
 * @returns {string}
 */
export function formatMarathonWeightDirectionArrow(direction) {
  if (direction === 'increase') return ' ↑';
  if (direction === 'decrease') return ' ↓';
  return '';
}

/**
 * @param {unknown} value
 * @param {{ withDirection?: boolean, direction?: 'increase'|'decrease'|'unchanged'|null }} [options]
 * @returns {string}
 */
export function formatMarathonWeightDisplayValue(value, { withDirection = false, direction = null } = {}) {
  if (!isValidMarathonWeightKg(value)) return MARATHON_WEIGHT_MISSING_LABEL;
  const kg = roundMarathonWeightKg(Number(value));
  const arrow = withDirection && direction ? formatMarathonWeightDirectionArrow(direction) : '';
  return `${kg.toFixed(1)} kg${arrow}`;
}

/**
 * @param {object|null|undefined} comparison
 * @returns {string[]}
 */
export function formatMarathonWeightWhatsAppNoticeLines(comparison) {
  if (!comparison || typeof comparison !== 'object') return [];

  const hasPrevious = isValidMarathonWeightKg(comparison.previousMarathonEndWeight);
  const hasCurrent = isValidMarathonWeightKg(comparison.currentMarathonDay0Weight);

  if (!comparison.partial && !hasPrevious && !hasCurrent) return [];
  if (!comparison.partial && !(hasPrevious && hasCurrent)) return [];

  let direction = null;
  if (hasPrevious && hasCurrent) {
    const prev = roundMarathonWeightKg(Number(comparison.previousMarathonEndWeight));
    const cur = roundMarathonWeightKg(Number(comparison.currentMarathonDay0Weight));
    direction = comparison.direction || resolveMarathonWeightDirection(prev, cur);
  }

  return [
    `Previous Marathon End weight : ${formatMarathonWeightDisplayValue(comparison.previousMarathonEndWeight)}`,
    `Current Marathon Start weight : ${formatMarathonWeightDisplayValue(comparison.currentMarathonDay0Weight, {
      withDirection: true,
      direction,
    })}`,
  ];
}

export function formatMarathonWeightWhatsAppNotice(comparison) {
  const lines = formatMarathonWeightWhatsAppNoticeLines(comparison);
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Merge a partial/full cached comparison with the weight being shared on Day 0.
 * @param {object|null|undefined} source
 * @param {unknown} currentWeightKg
 * @returns {object|null}
 */
export function mergeMarathonWeightComparisonForShare(source, currentWeightKg) {
  const hasCurrentOverride = isValidMarathonWeightKg(currentWeightKg);
  const currentFromSource = source && typeof source === 'object'
    ? source.currentMarathonDay0Weight
    : null;
  const hasCurrentFromSource = isValidMarathonWeightKg(currentFromSource);
  const previousFromSource = source && typeof source === 'object'
    ? source.previousMarathonEndWeight
    : null;
  const hasPrevious = isValidMarathonWeightKg(previousFromSource);

  const current = hasCurrentOverride
    ? roundMarathonWeightKg(Number(currentWeightKg))
    : (hasCurrentFromSource ? roundMarathonWeightKg(Number(currentFromSource)) : null);
  const previous = hasPrevious
    ? roundMarathonWeightKg(Number(previousFromSource))
    : null;

  if (previous != null && current != null) {
    return buildMarathonWeightComparison({
      previousMarathonEndWeight: previous,
      currentMarathonDay0Weight: current,
    });
  }

  if (previous == null && current == null) return null;

  return {
    partial: true,
    previousMarathonEndWeight: previous,
    currentMarathonDay0Weight: current,
  };
}
>>>>>>> Phase1_Yasheer
