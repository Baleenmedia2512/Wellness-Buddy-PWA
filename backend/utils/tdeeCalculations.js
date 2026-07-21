/**
 * TDEE calculations — Physical Activity + TEF on top of BMR.
 *
 * PA  = BMR × activityMultiplier
 * TEF = BMR × 0.07
 * TDEE = BMR + PA + TEF
 */

export const VALID_PHYSICAL_ACTIVITY_LEVELS = [
  'sedentary',
  'light_active',
  'moderate',
  'very_active',
  'highly_active',
];

/** Activity multiplier keyed by stored level. */
export const ACTIVITY_MULTIPLIERS = {
  sedentary: 0.20,
  light_active: 0.30,
  moderate: 0.50,
  very_active: 0.70,
  highly_active: 0.90,
};

export const TEF_RATIO = 0.07;

export const PHYSICAL_ACTIVITY_LABELS = {
  sedentary: 'Sedentary',
  light_active: 'Light Active',
  moderate: 'Moderate',
  very_active: 'Very Active',
  highly_active: 'Highly Active',
};

/**
 * @param {unknown} level
 * @returns {boolean}
 */
export function isValidPhysicalActivityLevel(level) {
  return typeof level === 'string' && VALID_PHYSICAL_ACTIVITY_LEVELS.includes(level);
}

/**
 * @param {unknown} level
 * @returns {number|null}
 */
export function getActivityMultiplier(level) {
  if (!isValidPhysicalActivityLevel(level)) return null;
  return ACTIVITY_MULTIPLIERS[level];
}

function toPositiveBmr(bmr) {
  const b = parseFloat(bmr);
  if (!Number.isFinite(b) || b <= 0) return null;
  return b;
}

/**
 * @param {unknown} bmr
 * @param {unknown} activityLevel
 * @returns {number|null}
 */
export function computePhysicalActivityCalories(bmr, activityLevel) {
  const b = toPositiveBmr(bmr);
  const mult = getActivityMultiplier(activityLevel);
  if (b === null || mult === null) return null;
  return Math.round(b * mult);
}

/**
 * @param {unknown} bmr
 * @returns {number|null}
 */
export function computeTef(bmr) {
  const b = toPositiveBmr(bmr);
  if (b === null) return null;
  return Math.round(b * TEF_RATIO);
}

/**
 * @param {unknown} bmr
 * @param {unknown} activityLevel
 * @returns {number|null}
 */
export function computeTdee(bmr, activityLevel) {
  const b = toPositiveBmr(bmr);
  const mult = getActivityMultiplier(activityLevel);
  if (b === null || mult === null) return null;
  return Math.round(b + b * mult + b * TEF_RATIO);
}

/**
 * Daily calorie target for nutrition/discipline surfaces.
 * Falls back to raw BMR when activity level is not set.
 *
 * @param {{ bmr?: unknown, physicalActivityLevel?: unknown }}
 * @returns {number|null}
 */
export function resolveCalorieTargetFromProfile({ bmr, physicalActivityLevel }) {
  const tdee = computeTdee(bmr, physicalActivityLevel);
  if (tdee !== null) return tdee;
  const b = toPositiveBmr(bmr);
  return b !== null ? Math.round(b) : null;
}

/**
 * @param {{ bmr?: unknown, physicalActivityLevel?: unknown }}
 * @returns {{ bmr: number, physicalActivityCalories: number, tef: number, tdee: number }|null}
 */
export function buildTdeeBreakdown({ bmr, physicalActivityLevel }) {
  const b = toPositiveBmr(bmr);
  const pa = computePhysicalActivityCalories(bmr, physicalActivityLevel);
  const tef = computeTef(bmr);
  const tdee = computeTdee(bmr, physicalActivityLevel);
  if (b === null || pa === null || tef === null || tdee === null) return null;
  return {
    bmr: Math.round(b),
    physicalActivityCalories: pa,
    tef,
    tdee,
  };
}
