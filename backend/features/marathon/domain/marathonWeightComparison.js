/**
 * Marathon weight comparison — pure domain rules.
 */

import { MARATHON_LAST_DAY_INDEX } from './marathonCalendar.js';

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
 * @param {number} baselineWeight
 * @param {number} compareWeight
 * @returns {'increase'|'decrease'|'unchanged'}
 */
export function resolveMarathonWeightDirection(baselineWeight, compareWeight) {
  const diff = roundMarathonWeightKg(compareWeight - baselineWeight);
  if (Math.abs(diff) < 0.01) return 'unchanged';
  return diff > 0 ? 'increase' : 'decrease';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatMarathonKgValue(value) {
  if (!isValidMarathonWeightKg(value)) return '—';
  return `${roundMarathonWeightKg(Number(value)).toFixed(1)} kg`;
}

/**
 * @param {'increase'|'decrease'|'unchanged'} direction
 * @param {number|null} weightDifference signed kg
 * @returns {string}
 */
export function formatMarathonDayChangeSuffix(direction, weightDifference) {
  if (direction === 'unchanged' || weightDifference == null) return '';
  const abs = roundMarathonWeightKg(Math.abs(weightDifference));
  const arrow = direction === 'decrease' ? '↓' : '↑';
  return ` ${arrow} ${abs.toFixed(1)} kg`;
}

/**
 * @param {unknown} day0Weight
 * @param {unknown} dayWeight
 * @returns {string}
 */
export function formatMarathonDayComparisonLine(day0Weight, dayWeight) {
  const day0Label = formatMarathonKgValue(day0Weight);
  const dayLabel = formatMarathonKgValue(dayWeight);
  const hasDay0 = isValidMarathonWeightKg(day0Weight);
  const hasDay = isValidMarathonWeightKg(dayWeight);

  if (!hasDay0 && !hasDay) return '—';
  if (!hasDay0 && hasDay) return `— → ${dayLabel}`;
  if (hasDay0 && !hasDay) return `${day0Label} → —`;

  const baseline = roundMarathonWeightKg(Number(day0Weight));
  const current = roundMarathonWeightKg(Number(dayWeight));
  const weightDifference = roundMarathonWeightKg(current - baseline);
  const direction = resolveMarathonWeightDirection(baseline, current);
  if (direction === 'unchanged') return `${day0Label} → ${dayLabel}`;
  return `${day0Label} → ${dayLabel}${formatMarathonDayChangeSuffix(direction, weightDifference)}`;
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
 * @param {unknown} input.day
 * @param {string} input.ymd
 * @param {unknown} input.day0Weight
 * @param {unknown} input.dayWeight
 * @returns {object}
 */
export function buildMarathonDayEntry({ day, ymd, day0Weight, dayWeight }) {
  const roundedDay0 = isValidMarathonWeightKg(day0Weight)
    ? roundMarathonWeightKg(Number(day0Weight))
    : null;
  const roundedDay = isValidMarathonWeightKg(dayWeight)
    ? roundMarathonWeightKg(Number(dayWeight))
    : null;

  let weightDifference = null;
  let direction = null;
  if (roundedDay0 != null && roundedDay != null && day > 0) {
    weightDifference = roundMarathonWeightKg(roundedDay - roundedDay0);
    direction = resolveMarathonWeightDirection(roundedDay0, roundedDay);
  }

  const displayLine = day === 0
    ? formatMarathonKgValue(day0Weight)
    : formatMarathonDayComparisonLine(day0Weight, dayWeight);

  return {
    day,
    ymd,
    day0Weight: roundedDay0,
    dayWeight: roundedDay,
    weightDifference,
    direction,
    displayLine,
  };
}

/**
 * @param {object} input
 * @param {string} input.currentDay0Ymd
 * @param {number} input.marathonNumber
 * @param {number} input.currentMarathonDay
 * @param {string[]} input.dayYmds
 * @param {Record<number, unknown>} input.weightsByDay
 * @returns {object}
 */
export function buildMarathonRunningProgress({
  currentDay0Ymd,
  marathonNumber,
  currentMarathonDay,
  dayYmds,
  weightsByDay,
  previousMarathonEndWeight = null,
  previousDay10Ymd = null,
}) {
  const day0Raw = weightsByDay[0];
  const day0Weight = isValidMarathonWeightKg(day0Raw)
    ? roundMarathonWeightKg(Number(day0Raw))
    : null;

  const days = dayYmds.map((ymd, day) => buildMarathonDayEntry({
    day,
    ymd,
    day0Weight: day0Raw,
    dayWeight: weightsByDay[day] ?? null,
  }));

  const currentDay = days[currentMarathonDay] ?? null;
  const previous = isValidMarathonWeightKg(previousMarathonEndWeight)
    ? roundMarathonWeightKg(Number(previousMarathonEndWeight))
    : null;
  const crossMarathonCurrentWeight = currentMarathonDay === 0
    ? day0Weight
    : (currentDay?.dayWeight ?? null);

  let weightDifference = null;
  let direction = null;
  let changeLabel = null;
  if (previous != null && crossMarathonCurrentWeight != null) {
    weightDifference = roundMarathonWeightKg(crossMarathonCurrentWeight - previous);
    direction = resolveMarathonWeightDirection(previous, crossMarathonCurrentWeight);
    changeLabel = formatMarathonWeightChangeLabel(weightDifference, direction);
  }

  return {
    mode: 'running',
    partial: day0Weight == null || days.some((entry) => entry.day > 0 && entry.day <= currentMarathonDay && entry.dayWeight == null),
    marathonNumber,
    marathonDay: currentMarathonDay,
    currentDay0Ymd,
    previousDay10Ymd,
    day0Weight,
    currentMarathonDay0Weight: day0Weight,
    previousMarathonEndWeight: previous,
    currentWeight: crossMarathonCurrentWeight,
    weightDifference,
    direction,
    changeLabel,
    days,
    currentDay,
  };
}

/**
 * @param {object} input
 * @param {unknown} input.previousMarathonEndWeight
 * @param {unknown} input.currentWeight
 * @param {string} [input.previousDay10Ymd]
 * @param {string} [input.upcomingDay0Ymd]
 * @param {number} [input.upcomingMarathonNumber]
 * @returns {object}
 */
export function buildMarathonGapProgress({
  previousMarathonEndWeight,
  currentWeight,
  previousDay10Ymd = null,
  upcomingDay0Ymd = null,
  upcomingMarathonNumber = null,
}) {
  const previous = isValidMarathonWeightKg(previousMarathonEndWeight)
    ? roundMarathonWeightKg(Number(previousMarathonEndWeight))
    : null;
  const current = isValidMarathonWeightKg(currentWeight)
    ? roundMarathonWeightKg(Number(currentWeight))
    : null;

  let weightDifference = null;
  let direction = null;
  let changeLabel = null;
  if (previous != null && current != null) {
    weightDifference = roundMarathonWeightKg(current - previous);
    direction = resolveMarathonWeightDirection(previous, current);
    changeLabel = formatMarathonWeightChangeLabel(weightDifference, direction);
  }

  return {
    mode: 'gap',
    partial: previous == null || current == null,
    marathonNumber: upcomingMarathonNumber,
    marathonDay: null,
    currentDay0Ymd: upcomingDay0Ymd,
    previousDay10Ymd,
    upcomingDay0Ymd,
    day0Weight: null,
    currentMarathonDay0Weight: null,
    previousMarathonEndWeight: previous,
    currentWeight: current,
    weightDifference,
    direction,
    changeLabel,
    days: null,
    currentDay: null,
  };
}

/**
 * @param {object} input
 * @param {unknown} input.previousMarathonEndWeight
 * @param {unknown} input.currentMarathonDay0Weight
 * @param {string} [input.previousDay10Ymd]
 * @param {string} [input.currentDay0Ymd]
 * @returns {object|null}
 */
export function buildMarathonWeightComparison({
  previousMarathonEndWeight,
  currentMarathonDay0Weight,
  previousDay10Ymd = null,
  currentDay0Ymd = null,
}) {
  const gap = buildMarathonGapProgress({
    previousMarathonEndWeight,
    currentWeight: currentMarathonDay0Weight,
    previousDay10Ymd,
    upcomingDay0Ymd: currentDay0Ymd,
  });
  if (gap.partial) return gap;
  return gap;
}
