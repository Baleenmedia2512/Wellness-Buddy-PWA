/**
 * backend/features/captures/domain/image-types.js
 * ---------------------------------------------------------------------------
 * PURE domain module. Single source of truth for the capture state machine.
 *
 * No I/O. No imports of axios/fetch/pg/supabase/react/next.
 * Mirrors the CHECK constraint in `backend/migrations/create_captures_table.sql`
 * AND the constant frontend uses (added in PR 3:
 * `frontend/src/shared/constants/imageTypes.js`).
 *
 * State machine
 *   pending ──▶ food
 *           ──▶ weight
 *           ──▶ education
 *           ──▶ smartwatch
 *           ──▶ unknown
 *
 *   Terminal states are IMMUTABLE — once a capture has been classified, its
 *   type may not change. A misclassification is corrected by creating a new
 *   capture, not by mutating the existing one.
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

export const TERMINAL_IMAGE_TYPES = Object.freeze([
  IMAGE_TYPE_FOOD,
  IMAGE_TYPE_WEIGHT,
  IMAGE_TYPE_EDUCATION,
  IMAGE_TYPE_SMARTWATCH,
  IMAGE_TYPE_UNKNOWN,
]);

export function isValidImageType(type) {
  return typeof type === 'string' && IMAGE_TYPES.includes(type);
}

export function isTerminal(type) {
  return TERMINAL_IMAGE_TYPES.includes(type);
}

/**
 * Returns true iff `from → to` is a legal transition.
 * Same-state transitions return false (no-op writes are caller's job to skip).
 */
export function canTransition(from, to) {
  if (!isValidImageType(from) || !isValidImageType(to)) return false;
  if (from !== IMAGE_TYPE_PENDING) return false;
  return isTerminal(to);
}

/**
 * Throws a ValidationError-shaped object on illegal transition. The thrower
 * stays pure (no import of ValidationError class) so this module remains
 * fully unit-testable without any framework deps.
 */
export function assertCanTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error(
      `Illegal capture state transition: ${from} → ${to}. ` +
      `Only 'pending' may transition to a terminal type ` +
      `(${TERMINAL_IMAGE_TYPES.join(', ')}).`,
    );
    err.status = 409;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }
}
