/**
 * Marathon weight comparison — pure formatting helpers.
 * Date resolution lives in marathonCalendar.js; weight lookup is server-side.
 */

import { MARATHON_LAST_DAY_INDEX, listMarathonDayYmds } from './marathonCalendar.js';

/** Shown in profile and WhatsApp when a marathon anchor weight is not logged yet. */
export const MARATHON_WEIGHT_MISSING_LABEL = '—';

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
  if (!isValidMarathonWeightKg(value)) return MARATHON_WEIGHT_MISSING_LABEL;
  return `${roundMarathonWeightKg(Number(value)).toFixed(1)} kg`;
}

/**
 * @param {'increase'|'decrease'|'unchanged'} direction
 * @param {number|null} weightDifference
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

  if (!hasDay0 && !hasDay) return MARATHON_WEIGHT_MISSING_LABEL;
  if (!hasDay0 && hasDay) return `${MARATHON_WEIGHT_MISSING_LABEL} → ${dayLabel}`;
  if (hasDay0 && !hasDay) return `${day0Label} → ${MARATHON_WEIGHT_MISSING_LABEL}`;

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
    partial: day0Weight == null,
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
 * @returns {object|null}
 */
export function buildMarathonWeightComparison({
  previousMarathonEndWeight,
  currentMarathonDay0Weight,
}) {
  return buildMarathonGapProgress({
    previousMarathonEndWeight,
    currentWeight: currentMarathonDay0Weight,
  });
}

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
 * WhatsApp uses emoji arrows so the direction is visible in the caption.
 * @param {'increase'|'decrease'|'unchanged'|null|undefined} direction
 * @returns {string}
 */
export function formatMarathonWeightWhatsAppDirectionEmoji(direction) {
  if (direction === 'increase') return ' ⬆️';
  if (direction === 'decrease') return ' ⬇️';
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
 * @param {object|null|undefined} progress
 * @returns {string[]}
 */
export function formatMarathonCrossMarathonWhatsAppLines(progress) {
  if (!progress || typeof progress !== 'object') return [];

  const hasPrevious = isValidMarathonWeightKg(progress.previousMarathonEndWeight);
  const hasCurrent = isValidMarathonWeightKg(progress.currentWeight);
  if (!hasPrevious && !hasCurrent) return [];

  let direction = progress.direction ?? null;
  if (hasPrevious && hasCurrent) {
    direction = direction || resolveMarathonWeightDirection(
      progress.previousMarathonEndWeight,
      progress.currentWeight,
    );
  }

  return [
    `Previous Marathon End weight : ${formatMarathonWeightDisplayValue(progress.previousMarathonEndWeight)}`,
    `Current Weight : ${formatMarathonWeightDisplayValue(progress.currentWeight)}${formatMarathonWeightWhatsAppDirectionEmoji(direction)}`,
  ];
}

/**
 * @param {object|null|undefined} progress
 * @param {{ inMarathon?: boolean, marathonDay?: number|null, showMarathonStartReminder?: boolean }} [state]
 * @returns {string[]}
 */
export function formatMarathonWeightWhatsAppNoticeLines(progress, state = {}) {
  if (!progress || typeof progress !== 'object') return [];

  if (progress.mode === 'running' && state.inMarathon && Number.isInteger(state.marathonDay)) {
    if (state.marathonDay === 0) {
      return formatMarathonCrossMarathonWhatsAppLines(progress);
    }

    const dayEntry = progress.currentDay
      ?? progress.days?.[state.marathonDay]
      ?? null;
    if (!dayEntry?.displayLine) return [];
    return [dayEntry.displayLine];
  }

  if (progress.mode === 'gap' && !state.inMarathon) {
    return formatMarathonCrossMarathonWhatsAppLines(progress);
  }

  return [];
}

export function formatMarathonWeightWhatsAppNotice(progress, state = {}) {
  const lines = formatMarathonWeightWhatsAppNoticeLines(progress, state);
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Merge cached/server progress with the weight being shared right now.
 * @param {object|null|undefined} source
 * @param {unknown} currentWeightKg
 * @param {number|null} [marathonDay]
 * @returns {object|null}
 */
function buildMinimalRunningShareProgress({
  dayIndex,
  currentWeightKg,
  source = null,
}) {
  const weightsByDay = {};
  if (source?.mode === 'running' && Array.isArray(source.days)) {
    source.days.forEach((entry) => {
      weightsByDay[entry.day] = entry.dayWeight;
    });
  }
  if (isValidMarathonWeightKg(source?.day0Weight)) {
    weightsByDay[0] = source.day0Weight;
  } else if (isValidMarathonWeightKg(source?.currentMarathonDay0Weight)) {
    weightsByDay[0] = source.currentMarathonDay0Weight;
  }
  if (isValidMarathonWeightKg(currentWeightKg)) {
    weightsByDay[dayIndex] = currentWeightKg;
    if (dayIndex === 0) weightsByDay[0] = currentWeightKg;
  }

  const previousMarathonEndWeight = source?.previousMarathonEndWeight ?? null;
  const previousDay10Ymd = source?.previousDay10Ymd ?? null;
  const currentDay0Ymd = source?.currentDay0Ymd ?? null;

  if (currentDay0Ymd) {
    const dayYmds = listMarathonDayYmds(currentDay0Ymd);
    return buildMarathonRunningProgress({
      currentDay0Ymd,
      marathonNumber: source?.marathonNumber ?? 1,
      currentMarathonDay: dayIndex,
      dayYmds,
      weightsByDay,
      previousMarathonEndWeight,
      previousDay10Ymd,
    });
  }

  const day0Weight = weightsByDay[0] ?? null;
  const todayWeight = weightsByDay[dayIndex] ?? null;
  const currentDay = buildMarathonDayEntry({
    day: dayIndex,
    ymd: source?.days?.[dayIndex]?.ymd ?? '',
    day0Weight,
    dayWeight: todayWeight,
  });

  const roundedDay0 = isValidMarathonWeightKg(day0Weight)
    ? roundMarathonWeightKg(Number(day0Weight))
    : null;
  const previous = isValidMarathonWeightKg(previousMarathonEndWeight)
    ? roundMarathonWeightKg(Number(previousMarathonEndWeight))
    : null;
  const crossMarathonCurrentWeight = dayIndex === 0
    ? roundedDay0
    : (isValidMarathonWeightKg(todayWeight) ? roundMarathonWeightKg(Number(todayWeight)) : null);

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
    partial: true,
    marathonNumber: source?.marathonNumber ?? 1,
    marathonDay: dayIndex,
    currentDay0Ymd,
    previousDay10Ymd,
    day0Weight: roundedDay0,
    currentMarathonDay0Weight: roundedDay0,
    previousMarathonEndWeight: previous,
    currentWeight: crossMarathonCurrentWeight,
    weightDifference,
    direction,
    changeLabel,
    days: [currentDay],
    currentDay,
  };
}

export function mergeMarathonWeightComparisonForShare(source, currentWeightKg, marathonDay = null) {
  const dayIndex = Number.isInteger(marathonDay)
    ? marathonDay
    : (source?.mode === 'running' && Number.isInteger(source?.marathonDay)
      ? source.marathonDay
      : null);

  if (Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex <= MARATHON_LAST_DAY_INDEX) {
    const weightsByDay = {};
    let dayYmds = [];
    let currentDay0Ymd = source?.currentDay0Ymd ?? null;
    let marathonNumber = source?.marathonNumber ?? 1;

    if (source?.mode === 'running' && Array.isArray(source.days) && source.days.length > 0) {
      source.days.forEach((entry) => {
        weightsByDay[entry.day] = entry.dayWeight;
      });
      dayYmds = source.days.map((entry) => entry.ymd);
      currentDay0Ymd = source.currentDay0Ymd ?? dayYmds[0] ?? null;
      marathonNumber = source.marathonNumber ?? marathonNumber;
    } else if (currentDay0Ymd) {
      dayYmds = listMarathonDayYmds(currentDay0Ymd);
    }

    weightsByDay[0] = source?.day0Weight ?? source?.currentMarathonDay0Weight ?? weightsByDay[0] ?? null;
    if (isValidMarathonWeightKg(currentWeightKg)) {
      weightsByDay[dayIndex] = currentWeightKg;
      if (dayIndex === 0) weightsByDay[0] = currentWeightKg;
    }

    if (currentDay0Ymd && dayYmds.length > 0) {
      return buildMarathonRunningProgress({
        currentDay0Ymd,
        marathonNumber,
        currentMarathonDay: dayIndex,
        dayYmds,
        weightsByDay,
        previousMarathonEndWeight: source?.previousMarathonEndWeight ?? null,
        previousDay10Ymd: source?.previousDay10Ymd ?? null,
      });
    }

    return buildMinimalRunningShareProgress({
      dayIndex,
      currentWeightKg,
      source,
    });
  }

  if (!source || typeof source !== 'object') {
    if (!isValidMarathonWeightKg(currentWeightKg)) return null;
    return buildMarathonGapProgress({
      previousMarathonEndWeight: null,
      currentWeight: currentWeightKg,
    });
  }

  const previous = source.previousMarathonEndWeight ?? null;
  const current = isValidMarathonWeightKg(currentWeightKg)
    ? currentWeightKg
    : (source.currentWeight ?? source.currentMarathonDay0Weight ?? null);

  return buildMarathonGapProgress({
    previousMarathonEndWeight: previous,
    currentWeight: current,
    previousDay10Ymd: source.previousDay10Ymd ?? null,
    upcomingDay0Ymd: source.upcomingDay0Ymd ?? source.currentDay0Ymd ?? null,
    upcomingMarathonNumber: source.marathonNumber ?? null,
  });
}
