/**
 * weightFormService.js — pure helpers for the weight slice.
 * No React, no fetch. Validation, formatting and small calculations only.
 */
import {
  formatUtcDate,
  formatBusinessTime,
  isBusinessToday,
  isBusinessYesterday,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../shared/utils/datetimeUtils';

export const WEIGHT_LIMITS = {
  kg: { min: 20, max: 300 },
  lbs: { min: 44, max: 660 },
};

/** Validate the manual entry form. Returns { valid, error, weightValue, bmrValue }. */
export function validateManualEntry({ weight, unit = 'kg', bmr = '' }) {
  const weightValue = parseFloat(weight);
  if (!weight || isNaN(weightValue)) {
    return { valid: false, error: 'Please enter a valid weight' };
  }
  if (weightValue <= 0) {
    return { valid: false, error: 'Weight must be greater than 0' };
  }
  const { min, max } = WEIGHT_LIMITS[unit] || WEIGHT_LIMITS.kg;
  if (weightValue < min || weightValue > max) {
    return { valid: false, error: `Weight must be between ${min} and ${max} ${unit}` };
  }
  let bmrValue = null;
  if (bmr && String(bmr).trim() !== '') {
    bmrValue = parseFloat(bmr);
    if (isNaN(bmrValue) || bmrValue <= 0) {
      return { valid: false, error: 'BMR must be a positive number' };
    }
  }
  return { valid: true, error: '', weightValue, bmrValue };
}

/** Validate an in-place weight edit (always kg). */
export function validateEditWeight(value) {
  const weightValue = parseFloat(value);
  const { min, max } = WEIGHT_LIMITS.kg;
  if (isNaN(weightValue) || weightValue < min || weightValue > max) {
    return { valid: false, error: `Weight must be between ${min} and ${max} kg` };
  }
  return { valid: true, error: '', weightValue };
}

/** Compact "Today · 09:42" / "Yesterday · …" / "Mar 3 · …" label for the history card. */
export function formatHistoryDate(dateString, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (!dateString) return '';
  const time = formatBusinessTime(dateString, timezoneIana, {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (isBusinessToday(dateString, timezoneIana)) return `Today · ${time}`;
  if (isBusinessYesterday(dateString, timezoneIana)) return `Yesterday · ${time}`;
  return `${formatUtcDate(dateString, { month: 'short', day: 'numeric', timeZone: timezoneIana })} · ${time}`;
}

/** Long-form date for the detail modal header. */
export function formatDetailDate(dateString, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  return formatUtcDate(dateString, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: timezoneIana,
  });
}

/** Returns `{ gained, abs, arrow }` or null when diff is negligible. */
export function computeWeightDiff(current, previous) {
  if (previous === null || previous === undefined) return null;
  const diff = parseFloat(current) - parseFloat(previous);
  if (Math.abs(diff) < 0.01) return null;
  const gained = diff > 0;
  return { gained, abs: Math.abs(diff), arrow: gained ? '↑' : '↓' };
}

/** Normalises a raw image string to a usable `<img src>`. */
export function formatWeightImageSrc(raw) {
  if (!raw) return null;
  return raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`;
}

/**
 * Ideal weight range from profile height (BMI 19–23, WHO normal band).
 * Matches App.js `refreshIdealWeight` and profile IdealWeightCards.
 */
export function computeIdealWeightRange(heightCm) {
  const h = parseFloat(heightCm);
  if (!h || h < 50 || h > 250) return null;
  const heightM = h / 100;
  const idealMin = 19 * heightM * heightM;
  const idealMax = 23 * heightM * heightM;
  return {
    min: Math.round(idealMin * 100) / 100,
    value: Math.round(idealMax * 100) / 100,
    unit: 'kg',
    heightCm: Math.round(h),
  };
}

/**
 * Derive weight goal mode from current weight vs ideal BMI range (19–23).
 * @returns {'loss'|'gain'|'maintain'|null}
 */
export function deriveWeightGoalMode({ heightCm, currentWeightKg }) {
  const range = computeIdealWeightRange(heightCm);
  const current = parseFloat(currentWeightKg);
  if (!range || !Number.isFinite(current) || current <= 0) return null;
  if (current > range.value) return 'loss';
  if (current < range.min) return 'gain';
  return 'maintain';
}

/**
 * Numeric ideal-weight target (kg) for the user's current weight vs BMI 19–23.
 * Overweight → BMI 23 upper bound; underweight → BMI 19 lower bound.
 */
export function pickIdealWeightKg(currentKg, idealWeight) {
  if (!idealWeight) return null;
  const current = parseFloat(currentKg);
  if (!Number.isFinite(current)) return idealWeight.value;
  if (current > idealWeight.value + 0.5) return idealWeight.value;
  if (current < idealWeight.min - 0.5) return idealWeight.min;
  return idealWeight.value;
}

/** Pick the display target for the user's current weight vs ideal range. */
export function pickIdealWeightDisplay(currentKg, idealWeight) {
  const kg = pickIdealWeightKg(currentKg, idealWeight);
  if (kg == null) return null;
  return `${Number(kg).toFixed(2)} ${idealWeight.unit}`;
}

/** Human-readable delta since the prior weight log. */
export function formatWeightChangeLabel(current, previous) {
  const diff = computeWeightDiff(current, previous);
  if (!diff) return null;
  const signed = diff.gained ? `+${diff.abs.toFixed(2)}` : `−${diff.abs.toFixed(2)}`;
  return {
    ...diff,
    signedLabel: `${signed} kg`,
    previousLabel: `${parseFloat(previous).toFixed(2)} kg`,
  };
}
