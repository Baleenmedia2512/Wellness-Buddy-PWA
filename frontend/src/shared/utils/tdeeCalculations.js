/**
 * TDEE calculations — mirrors backend/utils/tdeeCalculations.js for UI.
 */

export const VALID_PHYSICAL_ACTIVITY_LEVELS = [
  'sedentary',
  'light_active',
  'moderate',
  'very_active',
  'highly_active',
];

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 0.20,
  light_active: 0.30,
  moderate: 0.50,
  very_active: 0.70,
  highly_active: 0.90,
};

export const TEF_RATIO = 0.07;

export const PHYSICAL_ACTIVITY_OPTIONS = [
  {
    id: 'sedentary',
    label: 'Sedentary',
    description: 'Mostly sitting, little or no exercise',
    multiplier: 0.20,
  },
  {
    id: 'light_active',
    label: 'Light Active',
    description: 'Light exercise or walking regularly',
    multiplier: 0.30,
  },
  {
    id: 'moderate',
    label: 'Moderate',
    description: 'Frequent exercise',
    multiplier: 0.50,
  },
  {
    id: 'very_active',
    label: 'Very Active',
    description: 'Daily exercise or outdoor sports',
    multiplier: 0.70,
  },
  {
    id: 'highly_active',
    label: 'Highly Active',
    description: 'Athletes, bodybuilders or intense physical training',
    multiplier: 0.90,
  },
];

export function isValidPhysicalActivityLevel(level) {
  return typeof level === 'string' && VALID_PHYSICAL_ACTIVITY_LEVELS.includes(level);
}

export function getActivityMultiplier(level) {
  if (!isValidPhysicalActivityLevel(level)) return null;
  return ACTIVITY_MULTIPLIERS[level];
}

function toPositiveBmr(bmr) {
  const b = parseFloat(bmr);
  if (!Number.isFinite(b) || b <= 0) return null;
  return b;
}

export function computeTdee(bmr, activityLevel) {
  const b = toPositiveBmr(bmr);
  const mult = getActivityMultiplier(activityLevel);
  if (b === null || mult === null) return null;
  return Math.round(b + b * mult + b * TEF_RATIO);
}

export function resolveCalorieTargetFromProfile({ bmr, physicalActivityLevel }) {
  const tdee = computeTdee(bmr, physicalActivityLevel);
  if (tdee !== null) return tdee;
  const b = toPositiveBmr(bmr);
  return b !== null ? Math.round(b) : null;
}
