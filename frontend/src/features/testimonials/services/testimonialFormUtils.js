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

/** Build API durationText from unit + numeric value. */
export function formatDurationText(durationUnit, durationValue) {
  const n = parseInt(String(durationValue || '').replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1) return '';
  const unit = DURATION_UNITS.includes(durationUnit) ? durationUnit : 'months';
  return `${n} ${unit}`;
}

/** CSS class for portrait testimonial thumbnails — contain shows full photo without cropping. */
export const PORTRAIT_IMAGE_CLASS =
  'w-full aspect-[9/16] object-contain bg-gray-50 rounded-2xl border-2';

export const PORTRAIT_IMAGE_CLASS_SM =
  'w-full aspect-[9/16] object-contain bg-gray-50 rounded-xl border border-gray-200';
