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
