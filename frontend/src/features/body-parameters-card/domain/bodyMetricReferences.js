/**
 * bodyMetricReferences.js — Reference ranges for body composition metrics.
 * Matches BodyParamsCardPreview / card.rules business ranges.
 */

export const VISCERAL_FAT_MAX = 9;
export const WAIST_CM_MAX_MALE = 90;
export const WAIST_CM_MAX_FEMALE = 80;
export const CHEST_CM_MIN_MALE = 90;
export const CHEST_CM_MAX_FEMALE = 80;
export const HIP_CM_MAX_MALE = 90;
export const HIP_CM_MIN_FEMALE = 80;

/**
 * @param {string|null|undefined} gender
 * @returns {'male'|'female'|null}
 */
export function normalizeBodyMetricGender(gender) {
  const g = String(gender || '').toLowerCase();
  if (g === 'male') return 'male';
  if (g === 'female') return 'female';
  return null;
}

export function getBmiReference() {
  return '18.5 to 23';
}

/**
 * @param {string|null|undefined} gender
 * @returns {string|null}
 */
export function getFatPercentReference(gender) {
  const g = normalizeBodyMetricGender(gender);
  if (g === 'male') return '10 to 20%';
  if (g === 'female') return '20 to 30%';
  return null;
}

export function getVisceralFatReference() {
  return '≤ 9';
}

/**
 * @param {string|null|undefined} gender
 * @returns {string|null}
 */
export function getWaistCmReference(gender) {
  const g = normalizeBodyMetricGender(gender);
  if (g === 'male') return `≤ ${WAIST_CM_MAX_MALE} cm`;
  if (g === 'female') return `≤ ${WAIST_CM_MAX_FEMALE} cm`;
  return null;
}

/**
 * Male: ≥ 90 cm · Female: ≤ 80 cm
 * @param {string|null|undefined} gender
 * @returns {string|null}
 */
export function getChestCmReference(gender) {
  const g = normalizeBodyMetricGender(gender);
  if (g === 'male') return `≥ ${CHEST_CM_MIN_MALE} cm`;
  if (g === 'female') return `≤ ${CHEST_CM_MAX_FEMALE} cm`;
  return null;
}

/**
 * Male: ≤ 90 cm · Female: ≥ 80 cm
 * @param {string|null|undefined} gender
 * @returns {string|null}
 */
export function getHipCmReference(gender) {
  const g = normalizeBodyMetricGender(gender);
  if (g === 'male') return `≤ ${HIP_CM_MAX_MALE} cm`;
  if (g === 'female') return `≥ ${HIP_CM_MIN_FEMALE} cm`;
  return null;
}

/**
 * @param {number|string|null|undefined} age
 * @returns {string|null}
 */
export function getBodyAgeReference(age) {
  const ageNum = parseInt(age, 10);
  if (Number.isNaN(ageNum)) return null;
  return `≤ ${ageNum} Yrs`;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function parseMetricNumber(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * @returns {{ isOutOfRange: boolean, direction: 'high'|'low'|null } | null}
 * null when value/gender cannot be evaluated.
 */
export function evaluateVisceralFat(value) {
  const n = parseMetricNumber(value);
  if (n == null) return null;
  if (n > VISCERAL_FAT_MAX) return { isOutOfRange: true, direction: 'high' };
  return { isOutOfRange: false, direction: null };
}

export function evaluateWaistCm(value, gender) {
  const g = normalizeBodyMetricGender(gender);
  const n = parseMetricNumber(value);
  if (n == null || !g) return null;
  const max = g === 'male' ? WAIST_CM_MAX_MALE : WAIST_CM_MAX_FEMALE;
  if (n > max) return { isOutOfRange: true, direction: 'high' };
  return { isOutOfRange: false, direction: null };
}

export function evaluateChestCm(value, gender) {
  const g = normalizeBodyMetricGender(gender);
  const n = parseMetricNumber(value);
  if (n == null || !g) return null;
  if (g === 'male') {
    if (n < CHEST_CM_MIN_MALE) return { isOutOfRange: true, direction: 'low' };
    return { isOutOfRange: false, direction: null };
  }
  if (n > CHEST_CM_MAX_FEMALE) return { isOutOfRange: true, direction: 'high' };
  return { isOutOfRange: false, direction: null };
}

export function evaluateHipCm(value, gender) {
  const g = normalizeBodyMetricGender(gender);
  const n = parseMetricNumber(value);
  if (n == null || !g) return null;
  if (g === 'male') {
    if (n > HIP_CM_MAX_MALE) return { isOutOfRange: true, direction: 'high' };
    return { isOutOfRange: false, direction: null };
  }
  if (n < HIP_CM_MIN_FEMALE) return { isOutOfRange: true, direction: 'low' };
  return { isOutOfRange: false, direction: null };
}

const REFERENCE_GETTERS = {
  fatPercent: (m) => getFatPercentReference(m.gender),
  visceralFat: () => getVisceralFatReference(),
  bmi: () => getBmiReference(),
  bodyAge: (m) => getBodyAgeReference(m.age),
  waistCm: (m) => getWaistCmReference(m.gender),
  chestCm: (m) => getChestCmReference(m.gender),
  hipCm: (m) => getHipCmReference(m.gender),
};

/**
 * @param {object|null|undefined} bodyMetrics
 * @returns {Record<string, string|null>}
 */
export function getBodyMetricReferences(bodyMetrics) {
  if (!bodyMetrics) return {};
  return Object.fromEntries(
    Object.entries(REFERENCE_GETTERS).map(([key, getter]) => [key, getter(bodyMetrics)]),
  );
}
