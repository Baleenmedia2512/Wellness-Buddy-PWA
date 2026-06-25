/**
 * weightFormService.js — pure helpers for the weight slice.
 * No React, no fetch. Validation, formatting and small calculations only.
 */
import { istToLocalDate, formatISTToLocalDate } from '../../../shared/utils/timezoneUtils';

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
export function formatHistoryDate(dateString) {
  const date = istToLocalDate(dateString);
  if (!date) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Today · ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return (
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + time
  );
}

/** Long-form date for the detail modal header. */
export function formatDetailDate(dateString) {
  return formatISTToLocalDate(dateString, {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
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
