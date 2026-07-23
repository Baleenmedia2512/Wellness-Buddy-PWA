/**
 * profileBodyMetrics.rules.js — Read-only body metrics for Profile display.
 *
 * Values are sourced from body_parameters_cards (existing columns).
 * Profile never writes these fields — coach BPC flow owns updates.
 */

export const PROFILE_BODY_METRIC_KEYS = [
  'age',
  'gender',
  'fatPercent',
  'visceralFat',
  'bmi',
  'bodyAge',
  'chestCm',
  'waistCm',
  'hipCm',
];

const CARD_COLUMN_BY_KEY = {
  age: 'age',
  gender: 'gender',
  fatPercent: 'fat_percent',
  visceralFat: 'visceral_fat',
  bmi: 'bmi',
  bodyAge: 'body_age',
  chestCm: 'chest_cm',
  waistCm: 'waist_cm',
  hipCm: 'hip_cm',
};

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isBodyMetricEmpty(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Map a body_parameters_cards row to flat read-only profile fields.
 *
 * @param {object|null|undefined} card - body_parameters_cards row (snake_case)
 * @returns {object|null}
 */
export function mapCardToProfileBodyMetrics(card) {
  if (!card) return null;

  const fields = {};
  for (const key of PROFILE_BODY_METRIC_KEYS) {
    const col = CARD_COLUMN_BY_KEY[key];
    fields[key] = card[col] ?? null;
  }
  return fields;
}

/**
 * @param {object|null|undefined} bodyMetrics
 * @returns {boolean}
 */
export function hasAnyProfileBodyMetric(bodyMetrics) {
  if (!bodyMetrics) return false;
  return PROFILE_BODY_METRIC_KEYS.some((key) => !isBodyMetricEmpty(bodyMetrics[key]));
}
