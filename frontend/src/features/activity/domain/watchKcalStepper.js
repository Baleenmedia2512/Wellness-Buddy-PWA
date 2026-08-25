/**
 * Calories-burnt stepper bounds for Manual Log.
 * The UI edits a non-negative delta, while save callers may still apply the
 * day's baseline before persisting the final total.
 */

export const WATCH_KCAL_MAX = 10000;
export const WATCH_KCAL_STEP = 1;
export const WATCH_KCAL_QUICK_ADD = [
  { label: '50 kcal', amount: 50 },
  { label: '100 kcal', amount: 100 },
  { label: '250 kcal', amount: 250 },
];

export function parseKcal(value) {
  const n = Number(String(value ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function clampKcal(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}

export function watchKcalBounds(todayBaseline) {
  const baseline = parseKcal(todayBaseline);
  return {
    baseline,
    min: 0,
    max: Math.max(WATCH_KCAL_MAX, baseline),
  };
}

export function nextWatchKcal(current, amount, todayBaseline) {
  const { min, max } = watchKcalBounds(todayBaseline);
  return clampKcal((Number(current) || 0) + amount, min, max);
}
