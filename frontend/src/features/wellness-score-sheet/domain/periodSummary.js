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

/**
 * Collapse daily wellness-score rows into one period-wide total.
 * Sum earned/possible points across the range and merge parameter totals by key.
 */
export function aggregateWellnessPeriodDetails(days = []) {
  if (!Array.isArray(days) || days.length === 0) return null;

  const parameterMap = new Map();
  let totalEarned = 0;
  let totalPossible = 0;

  for (const day of days) {
    totalEarned += Number(day?.totalEarned) || 0;
    totalPossible += Number(day?.totalPossible) || 0;

    for (const parameter of day?.parameters || []) {
      const key = parameter?.key;
      if (!key) continue;

      const existing = parameterMap.get(key);
      if (existing) {
        existing.earnedPoints += Number(parameter?.earnedPoints) || 0;
        existing.maxPoints += Number(parameter?.maxPoints) || 0;
        continue;
      }

      const meta = getParameterMeta(key);
      parameterMap.set(key, {
        key,
        label: parameter?.label || meta?.label || key,
        scoringMode: parameter?.scoringMode || meta?.scoringMode,
        earnedPoints: Number(parameter?.earnedPoints) || 0,
        maxPoints: Number(parameter?.maxPoints) || 0,
      });
    }
  }

  return {
    totalEarned,
    totalPossible,
    percentage: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0,
    dayCount: days.length,
    goalMode: days.find((day) => day?.goalMode)?.goalMode || 'loss',
    parameters: [...parameterMap.values()].sort(compareParameters),
  };
}
