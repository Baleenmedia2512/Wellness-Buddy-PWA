/**
 * profileBodyMetrics.rules.js — Body metrics for Profile display + merge.
 *
 * Sources (priority):
 *   1. Latest linked body_parameters_cards (coach BCM) when present
 *   2. team_table self-entered optional columns
 *   3. Latest weight_records BodyFat / Bmi for fat% and BMI
 *
 * Profile may write team_table columns; coach BPC sync can update them too.
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

/** Fields coaches enter on BPC — not inferred from weight sync alone. */
export const COACH_RECORDED_BODY_METRIC_KEYS = [
  'age',
  'gender',
  'visceralFat',
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
 * @returns {Record<string, null>}
 */
export function emptyProfileBodyMetrics() {
  const fields = {};
  for (const key of PROFILE_BODY_METRIC_KEYS) {
    fields[key] = null;
  }
  return fields;
}

/**
 * Map a body_parameters_cards row to flat profile body-metric fields.
 *
 * @param {object|null|undefined} card - body_parameters_cards row (snake_case)
 * @returns {object|null}
 */
export function mapCardToProfileBodyMetrics(card) {
  if (!card) return null;

  const fields = emptyProfileBodyMetrics();
  for (const key of PROFILE_BODY_METRIC_KEYS) {
    const col = CARD_COLUMN_BY_KEY[key];
    fields[key] = card[col] ?? null;
  }
  return fields;
}

/**
 * Map team_table optional body-metric columns (+ Gender) to profile fields.
 *
 * @param {object|null|undefined} user - team_table row (PascalCase)
 * @returns {object}
 */
export function mapTeamRowToProfileBodyMetrics(user) {
  const fields = emptyProfileBodyMetrics();
  if (!user) return fields;

  const numOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  fields.age = numOrNull(user.Age);
  fields.visceralFat = numOrNull(user.VisceralFat);
  fields.bodyAge = numOrNull(user.BodyAge);
  fields.chestCm = numOrNull(user.ChestCm);
  fields.waistCm = numOrNull(user.WaistCm);
  fields.hipCm = numOrNull(user.HipCm);

  const g = user.Gender != null ? String(user.Gender).trim() : '';
  fields.gender = (g === 'Male' || g === 'Female') ? g : null;

  return fields;
}

/**
 * Merge body metrics: card overrides team; weight supplies fat%/BMI when empty.
 *
 * @param {{
 *   cardMetrics?: object|null,
 *   teamMetrics?: object|null,
 *   weightFatPercent?: number|null,
 *   weightBmi?: number|null,
 * }} opts
 * @returns {object} always a full key set (nulls allowed)
 */
export function mergeProfileBodyMetrics({
  cardMetrics = null,
  teamMetrics = null,
  weightFatPercent = null,
  weightBmi = null,
} = {}) {
  const out = emptyProfileBodyMetrics();
  const team = teamMetrics || emptyProfileBodyMetrics();
  const card = cardMetrics || emptyProfileBodyMetrics();

  for (const key of PROFILE_BODY_METRIC_KEYS) {
    if (!isBodyMetricEmpty(card[key])) {
      out[key] = card[key];
    } else if (!isBodyMetricEmpty(team[key])) {
      out[key] = team[key];
    }
  }

  if (isBodyMetricEmpty(out.fatPercent) && !isBodyMetricEmpty(weightFatPercent)) {
    const n = Number(weightFatPercent);
    out.fatPercent = Number.isFinite(n) ? n : null;
  }
  if (isBodyMetricEmpty(out.bmi) && !isBodyMetricEmpty(weightBmi)) {
    const n = Number(weightBmi);
    out.bmi = Number.isFinite(n) ? n : null;
  }

  return out;
}

/**
 * @param {object|null|undefined} bodyMetrics
 * @returns {boolean}
 */
export function hasAnyProfileBodyMetric(bodyMetrics) {
  if (!bodyMetrics) return false;
  return PROFILE_BODY_METRIC_KEYS.some((key) => !isBodyMetricEmpty(bodyMetrics[key]));
}

/**
 * True when coach-style BPC fields are present (not only weight-synced fat/BMI).
 *
 * @param {object|null|undefined} bodyMetrics
 * @returns {boolean}
 */
export function hasCoachRecordedBodyMetrics(bodyMetrics) {
  if (!bodyMetrics) return false;
  return COACH_RECORDED_BODY_METRIC_KEYS.some((key) => !isBodyMetricEmpty(bodyMetrics[key]));
}

/**
 * Parse optional numeric body metric for profile update.
 * Empty / null clears (returns null). Undefined means omit from patch.
 *
 * @param {unknown} raw
 * @param {{ min?: number, max?: number, integer?: boolean }} bounds
 * @returns {{ ok: true, value: number|null|undefined } | { ok: false, message: string }}
 */
export function parseOptionalBodyMetric(raw, { min = 0, max = 500, integer = false } = {}) {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === '') return { ok: true, value: null };
  const n = integer ? parseInt(String(raw), 10) : parseFloat(String(raw));
  if (!Number.isFinite(n) || n < min || n > max) {
    return { ok: false, message: `Must be a number between ${min} and ${max}.` };
  }
  return { ok: true, value: n };
}
