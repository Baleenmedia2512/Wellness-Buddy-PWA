/**
 * frontend/src/shared/constants/imageTypes.js
 * ---------------------------------------------------------------------------
 * Single source of truth for capture image types on the frontend.
 *
 * MUST be kept in sync with:
 *   - backend/features/captures/domain/image-types.js
 *   - backend/migrations/create_captures_table.sql (CHECK constraint)
 *   - backend/features/background-analysis/analysis.validators.js (VALID_TYPES)
 *
 * Pure module: no imports, no side effects. Safe to import anywhere.
 * ---------------------------------------------------------------------------
 */

export const IMAGE_TYPE_PENDING    = 'pending';
export const IMAGE_TYPE_FOOD       = 'food';
export const IMAGE_TYPE_WEIGHT     = 'weight';
export const IMAGE_TYPE_EDUCATION  = 'education';
export const IMAGE_TYPE_SMARTWATCH = 'smartwatch';
export const IMAGE_TYPE_UNKNOWN    = 'unknown';

export const IMAGE_TYPES = Object.freeze([
  IMAGE_TYPE_PENDING,
  IMAGE_TYPE_FOOD,
  IMAGE_TYPE_WEIGHT,
  IMAGE_TYPE_EDUCATION,
  IMAGE_TYPE_SMARTWATCH,
  IMAGE_TYPE_UNKNOWN,
]);

/** Types the user can pick from the unknown-capture disambiguation modal. */
export const USER_SELECTABLE_TYPES = Object.freeze([
  IMAGE_TYPE_FOOD,
  IMAGE_TYPE_WEIGHT,
  IMAGE_TYPE_EDUCATION,
]);

export function isValidImageType(t) {
  return IMAGE_TYPES.includes(t);
}
