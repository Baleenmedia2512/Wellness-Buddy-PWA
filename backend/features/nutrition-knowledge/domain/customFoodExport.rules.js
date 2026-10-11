/**
 * Excel-friendly CSV for custom food submissions (developer nutrition fill-in).
 * Includes macros + vitamins + minerals (same keys as NUTRITION_KEYS).
 */

import { NUTRITION_KEYS } from './nutrition.rules.js';

/** Identity / serving columns first, then full nutrition field set. */
export const CUSTOM_FOOD_META_COLUMNS = Object.freeze([
  'user_id',
  'food_name',
  'unit',
  'quantity',
  'created_at',
  'profile_id',
]);

export const CUSTOM_FOOD_EXPORT_COLUMNS = Object.freeze([
  ...CUSTOM_FOOD_META_COLUMNS,
  ...NUTRITION_KEYS,
]);

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {object[]} submissions — rows from nutrition_custom_food_submissions_table (+ optional master_nutrition)
 * @returns {string} CSV text with header
 */
export function buildCustomFoodExportCsv(submissions = []) {
  const lines = [CUSTOM_FOOD_EXPORT_COLUMNS.join(',')];
  for (const row of submissions) {
    const n = row.master_nutrition && typeof row.master_nutrition === 'object'
      ? row.master_nutrition
      : {};
    const cells = [
      row.user_id,
      row.food_name,
      row.unit,
      row.quantity,
      row.created_at,
      row.profile_id ?? '',
      ...NUTRITION_KEYS.map((key) => (n[key] != null && n[key] !== '' ? n[key] : '')),
    ].map(csvEscape);
    lines.push(cells.join(','));
  }
  return `${lines.join('\n')}\n`;
}
