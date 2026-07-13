/**
 * Shared helpers for testimonial create/edit form fields.
 */

export const DURATION_UNITS = Object.freeze(['days', 'months']);

/** Strip to digits only — used for typing and paste. */
export function sanitizeDurationDigits(raw) {
  if (raw == null) return '';
  return String(raw).replace(/\D/g, '').slice(0, 4);
}

/** Parse stored durationText into form fields (backward compatible). */
export function parseDurationText(durationText) {
  const trimmed = String(durationText || '').trim();
  const match = trimmed.match(/^(\d+)\s*(days?|months?)$/i);
  if (!match) {
    return { durationValue: '', durationUnit: 'months' };
  }
  const unit = match[2].toLowerCase().startsWith('day') ? 'days' : 'months';
  return {
    durationValue: match[1],
    durationUnit: unit,
  };
}

const MAX_DURATION_AMOUNT = 9999;
const MIN_WEIGHT_KG = 1;
const MAX_WEIGHT_KG = 500;

/**
 * Validate a weight field before submit (1–500 kg, no zero/empty).
 * @returns {string|null} Error message, or null when valid.
 */
export function validateWeightKg(value, label = 'Weight') {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return `${label} is required`;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n < MIN_WEIGHT_KG || n > MAX_WEIGHT_KG) {
    return `${label} must be between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg`;
  }
  return null;
}

/**
 * Validate duration number + unit before submit.
 * @returns {string|null} Error message, or null when valid.
 */
export function validateDurationFields(durationUnit, durationValue) {
  const digits = String(durationValue ?? '').replace(/\D/g, '');
  if (!digits) return 'Duration is required';
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1) return 'Duration must be at least 1';
  if (n > MAX_DURATION_AMOUNT) return `Duration must be ${MAX_DURATION_AMOUNT} or less`;
  if (!DURATION_UNITS.includes(durationUnit)) return 'Select days or months for duration';
  return null;
}

/** Build API durationText from unit + numeric value. Returns '' when invalid. */
export function formatDurationText(durationUnit, durationValue) {
  if (validateDurationFields(durationUnit, durationValue)) return '';
  const n = parseInt(String(durationValue || '').replace(/\D/g, ''), 10);
  const unit = DURATION_UNITS.includes(durationUnit) ? durationUnit : 'months';
  return `${n} ${unit}`;
}

/** CSS class for portrait testimonial thumbnails — contain shows full photo without cropping. */
export const PORTRAIT_IMAGE_CLASS =
  'w-full aspect-[9/16] object-contain bg-gray-50 rounded-2xl border-2';

export const PORTRAIT_IMAGE_CLASS_SM =
  'w-full aspect-[9/16] object-contain bg-gray-50 rounded-xl border border-gray-200';
