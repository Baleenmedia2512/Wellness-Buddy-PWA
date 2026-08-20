import { getParameterMeta, WELLNESS_PARAMETERS } from './parameterRegistry.js';

const PARAMETER_ORDER = new Map(
  WELLNESS_PARAMETERS.map((parameter, index) => [parameter.key, index]),
);

function compareParameters(a, b) {
  const left = PARAMETER_ORDER.get(a.key) ?? Number.MAX_SAFE_INTEGER;
  const right = PARAMETER_ORDER.get(b.key) ?? Number.MAX_SAFE_INTEGER;
  if (left !== right) return left - right;
  return String(a.key).localeCompare(String(b.key));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Collapse daily wellness-score rows into one period-wide daily average.
 * Earned/possible and each parameter use avg pts/day; maxPoints stay at the
 * per-day configured value (missing days count as 0 earned).
 */
export function aggregateWellnessPeriodDetails(days = []) {
  if (!Array.isArray(days) || days.length === 0) return null;

  const dayCount = days.length;
  const parameterMap = new Map();
  let totalEarnedSum = 0;
  let totalPossibleSum = 0;

  for (const day of days) {
    totalEarnedSum += Number(day?.totalEarned) || 0;
    totalPossibleSum += Number(day?.totalPossible) || 0;

    for (const parameter of day?.parameters || []) {
      const key = parameter?.key;
      if (!key) continue;

      const earned = Number(parameter?.earnedPoints) || 0;
      const maxPoints = Number(parameter?.maxPoints) || 0;
      const existing = parameterMap.get(key);

      if (existing) {
        existing.earnedSum += earned;
        if (maxPoints > 0) existing.maxPoints = maxPoints;
        continue;
      }

      const meta = getParameterMeta(key);
      parameterMap.set(key, {
        key,
        label: parameter?.label || meta?.label || key,
        scoringMode: parameter?.scoringMode || meta?.scoringMode,
        earnedSum: earned,
        maxPoints,
      });
    }
  }

  const totalEarned = round1(totalEarnedSum / dayCount);
  const totalPossible = round1(totalPossibleSum / dayCount);

  return {
    totalEarned,
    totalPossible,
    percentage: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0,
    dayCount,
    isAverage: true,
    goalMode: days.find((day) => day?.goalMode)?.goalMode || 'loss',
    parameters: [...parameterMap.values()]
      .map(({ earnedSum, ...parameter }) => ({
        ...parameter,
        earnedPoints: round1(earnedSum / dayCount),
      }))
      .sort(compareParameters),
  };
}
