/**
 * BMR calculations — Katch-McArdle equation.
 * Single source of truth for deriving BMR from weight (kg) and body fat %.
 *
 * LBM = Weight × (1 - Body Fat % / 100)
 * BMR = 370 + (21.6 × LBM)
 */

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 500;
const MIN_BODY_FAT_PCT = 1;
const MAX_BODY_FAT_PCT = 70;

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function toPositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * @param {unknown} weightKg
 * @returns {boolean}
 */
export function isValidWeightKg(weightKg) {
  const w = toPositiveNumber(weightKg);
  return w !== null && w >= MIN_WEIGHT_KG && w <= MAX_WEIGHT_KG;
}

/**
 * @param {unknown} bodyFatPercent
 * @returns {boolean}
 */
export function isValidBodyFatPercent(bodyFatPercent) {
  const bf = toPositiveNumber(bodyFatPercent);
  return bf !== null && bf >= MIN_BODY_FAT_PCT && bf <= MAX_BODY_FAT_PCT;
}

/**
 * Lean body mass in kg. Returns null when inputs are invalid.
 *
 * @param {unknown} weightKg
 * @param {unknown} bodyFatPercent
 * @returns {number|null}
 */
export function computeLeanBodyMass(weightKg, bodyFatPercent) {
  if (!isValidWeightKg(weightKg) || !isValidBodyFatPercent(bodyFatPercent)) {
    return null;
  }
  const w = parseFloat(weightKg);
  const bf = parseFloat(bodyFatPercent);
  const lbm = w * (1 - bf / 100);
  if (!Number.isFinite(lbm) || lbm <= 0) return null;
  return Math.round(lbm * 10) / 10;
}

/**
 * Katch-McArdle BMR in kcal/day. Returns null when inputs are invalid.
 *
 * @param {unknown} weightKg
 * @param {unknown} bodyFatPercent
 * @returns {number|null} rounded integer kcal, or null
 */
export function computeKatchMcArdleBmr(weightKg, bodyFatPercent) {
  const lbm = computeLeanBodyMass(weightKg, bodyFatPercent);
  if (lbm === null) return null;
  const bmr = 370 + 21.6 * lbm;
  if (!Number.isFinite(bmr) || bmr <= 0) return null;
  return Math.round(bmr);
}

/**
 * Prefer Katch-McArdle when weight + body fat are valid; otherwise keep fallback.
 *
 * @param {{ weightKg: unknown, bodyFatPercent: unknown, fallbackBmr?: unknown }} input
 * @returns {number|null}
 */
export function resolveBmrFromBodyMetrics({ weightKg, bodyFatPercent, fallbackBmr = null }) {
  const calculated = computeKatchMcArdleBmr(weightKg, bodyFatPercent);
  if (calculated !== null) return calculated;

  const fallback = toPositiveNumber(fallbackBmr);
  return fallback !== null ? Math.round(fallback) : null;
}

/**
 * Resolve BMR for persistence: manual entry wins when provided; otherwise Katch-McArdle.
 *
 * @param {{ weightKg: unknown, bodyFatPercent: unknown, manualBmr?: unknown }} input
 * @returns {number|null}
 */
export function resolveBmrForSave({ weightKg, bodyFatPercent, manualBmr = null }) {
  const manual = toPositiveNumber(manualBmr);
  if (manual !== null) return Math.round(manual);
  return computeKatchMcArdleBmr(weightKg, bodyFatPercent);
}
