/**
 * Smartwatch calorie helpers — single source for parsing and daily aggregation.
 *
 * Policy: multiple watch screenshots on the same day → use the **highest**
 * kcal value (not sum, not latest). Lower uploads are ignored for totals.
 */

const KCAL_TOPIC_RE = /(\d+(?:\.\d+)?)\s*kcal/i;

/**
 * @param {string|null|undefined} topic
 * @returns {number}
 */
export function parseWatchKcalFromTopic(topic) {
  const match = String(topic || '').match(KCAL_TOPIC_RE);
  if (!match) return 0;
  const kcal = Math.round(parseFloat(match[1]));
  return Number.isFinite(kcal) && kcal > 0 ? kcal : 0;
}

/**
 * @param {Array<{ Topic?: string|null }>|null|undefined} rows
 * @returns {number}
 */
export function maxWatchCaloriesFromRows(rows) {
  if (!rows?.length) return 0;
  let max = 0;
  for (const row of rows) {
    max = Math.max(max, parseWatchKcalFromTopic(row.Topic ?? row.topic));
  }
  return max;
}

/**
 * Highest step-calorie row for one day (multiple sync rows → max, not sum).
 *
 * @param {Array<{ Steps?: number|null, CaloriesBurned?: number|null }>|null|undefined} rows
 * @returns {number}
 */
export function maxStepCaloriesFromRows(rows) {
  if (!rows?.length) return 0;
  let max = 0;
  for (const row of rows) {
    const burned = Math.abs(Number(row.CaloriesBurned) || 0);
    if ((row.Steps || 0) > 0 || burned > 0) {
      max = Math.max(max, burned);
    }
  }
  return max;
}

/**
 * Daily exercise calories for wellness / activity totals.
 * Multiple watch screenshots → highest kcal only (150 + 300 → 300).
 * Multiple step rows → highest step burn, then add watch (different sources).
 *
 * @param {Array<{ Steps?: number|null, CaloriesBurned?: number|null }>|null|undefined} stepRows
 * @param {Array<{ Topic?: string|null }>|null|undefined} watchRows
 * @returns {number}
 */
export function resolveDailyExerciseCalories(stepRows, watchRows) {
  return maxStepCaloriesFromRows(stepRows) + maxWatchCaloriesFromRows(watchRows);
}
