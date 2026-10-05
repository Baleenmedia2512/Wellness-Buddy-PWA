/**
 * Confirm before posting another Herbalife Shake inside one hour.
 * Pure rules — no I/O.
 */
import { parseUtcTimestamp } from '../../../shared/utils/datetimeUtils.js';

export const HERBALIFE_SHAKE_REPOST_WINDOW_MS = 60 * 60 * 1000;

/**
 * @param {unknown} name
 * @returns {boolean}
 */
export function isHerbalifeShakeLabel(name) {
  return String(name || '').trim().toLowerCase().includes('herbalife shake');
}

function pushName(out, name) {
  if (name == null || name === '') return;
  out.push(name);
}

/**
 * @param {object|null|undefined} analysis
 * @returns {boolean}
 */
export function isHerbalifeShakeAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') return false;
  if (String(analysis.processedBy || '').toLowerCase() === 'shake_calculator') return true;

  const names = [];
  for (const list of [analysis.foods, analysis.detailedItems]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && typeof item === 'object') pushName(names, item.name || item.foodName);
    }
  }
  if (analysis.category && typeof analysis.category === 'object') {
    pushName(names, analysis.category.name);
  }
  pushName(names, analysis.name);
  return names.some(isHerbalifeShakeLabel);
}

/**
 * @param {object|null|undefined} row Meal row from food stats (AnalysisData + ProcessedBy)
 * @returns {boolean}
 */
export function mealRowIsHerbalifeShake(row) {
  if (!row || typeof row !== 'object') return false;
  if (String(row.ProcessedBy || row.processedBy || '').toLowerCase() === 'shake_calculator') {
    return true;
  }
  let data = row.AnalysisData ?? row.analysisData ?? null;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return false;
    }
  }
  if (!data || typeof data !== 'object') return false;
  return isHerbalifeShakeAnalysis({
    ...data,
    processedBy: data.processedBy || row.ProcessedBy || row.processedBy,
  });
}

/**
 * @param {unknown} loggedAt
 * @param {Date} [now]
 * @param {number} [windowMs]
 * @returns {boolean}
 */
export function isWithinHerbalifeShakeRepostWindow(
  loggedAt,
  now = new Date(),
  windowMs = HERBALIFE_SHAKE_REPOST_WINDOW_MS,
) {
  const logged = loggedAt instanceof Date ? loggedAt : parseUtcTimestamp(loggedAt);
  const current = now instanceof Date ? now : parseUtcTimestamp(now);
  if (!logged || !current) return false;
  if (Number.isNaN(logged.getTime()) || Number.isNaN(current.getTime())) return false;
  const delta = current.getTime() - logged.getTime();
  return delta >= 0 && delta <= windowMs;
}

/**
 * Most recent Herbalife Shake still inside the repost window.
 * @param {object[]} meals
 * @param {Date} [now]
 * @returns {{ loggedAt: Date, id: string|number|null }|null}
 */
export function latestHerbalifeShakeWithinWindow(meals, now = new Date()) {
  let best = null;
  for (const meal of meals || []) {
    if (!mealRowIsHerbalifeShake(meal)) continue;
    const raw = meal.CreatedAt || meal.createdAt || meal.capturedAt;
    const loggedAt = raw instanceof Date ? raw : parseUtcTimestamp(raw);
    if (!isWithinHerbalifeShakeRepostWindow(loggedAt, now)) continue;
    if (!best || loggedAt.getTime() > best.loggedAt.getTime()) {
      best = { loggedAt, id: meal.ID ?? meal.id ?? null };
    }
  }
  return best;
}
