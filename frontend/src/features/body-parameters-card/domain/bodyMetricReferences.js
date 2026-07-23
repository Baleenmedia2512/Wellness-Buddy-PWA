/**
 * bodyMetricReferences.js — Reference ranges for body composition metrics.
 * Matches BodyParamsCardPreview / card.rules business ranges.
 */

export function getBmiReference() {
  return '18.5 to 23';
}

/**
 * @param {string|null|undefined} gender
 * @returns {string|null}
 */
export function getFatPercentReference(gender) {
  const g = String(gender || '').toLowerCase();
  if (g === 'male') return '10 to 20%';
  if (g === 'female') return '20 to 30%';
  return null;
}

export function getVisceralFatReference() {
  return '≤ 9';
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

const REFERENCE_GETTERS = {
  fatPercent: (m) => getFatPercentReference(m.gender),
  visceralFat: () => getVisceralFatReference(),
  bmi: () => getBmiReference(),
  bodyAge: (m) => getBodyAgeReference(m.age),
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
