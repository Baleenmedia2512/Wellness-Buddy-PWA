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
 *   unknown ──▶ food                             (added in PR-A, ADR-0003)
 *
 *   Rules:
 *   - Terminal states are IMMUTABLE *except* for the single `unknown → food`
 *     transition. This is the ONLY way a misclassification is corrected
 *     in-place; every other terminal can only be replaced by creating a
 *     new capture.
 *   - The `unknown → food` exit is the integration point for the Diary
 *     "Other → Retry / Edit" flow (ADR-0003): when the user (or a coach
 *     on the user's behalf) supplies nutrition for a capture the detector
 *     could not classify, the food row is inserted and the capture is
 *     promoted in place so the share link starts resolving as food.
 *   - `unknown` does NOT exit to `weight`, `education`, or `smartwatch` —
 *     those verticals have no Retry/Edit flow yet, and silently routing an
 *     unknown to one of them would re-introduce the "Unknown 0-kcal" feed
 *     pollution that PR 3 fixed.
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
 *
 * Legal transitions:
 *   - pending → <any terminal>
 *   - unknown → food                (PR-A / ADR-0003)
 *   - unknown → weight              (ADR-0003 Diary Edit flow)
 *   - unknown → education           (ADR-0003 Diary Edit flow)
 *
 * Every other from→to pair is illegal.
 */
export function canTransition(from, to) {
  if (!isValidImageType(from) || !isValidImageType(to)) return false;
  if (from === IMAGE_TYPE_PENDING) return isTerminal(to);
  if (from === IMAGE_TYPE_UNKNOWN && to === IMAGE_TYPE_FOOD) return true;
  if (from === IMAGE_TYPE_UNKNOWN && to === IMAGE_TYPE_WEIGHT) return true;
  if (from === IMAGE_TYPE_UNKNOWN && to === IMAGE_TYPE_EDUCATION) return true;
  return false;
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
      `Allowed: 'pending' → any terminal (${TERMINAL_IMAGE_TYPES.join(', ')}), ` +
      `or 'unknown' → 'food' / 'weight' / 'education'.`,
    );
    err.status = 409;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }
}
