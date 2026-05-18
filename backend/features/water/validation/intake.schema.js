/**
 * backend/features/water/validation/intake.schema.js
 * ---------------------------------------------------------------------------
 * Input validation for GET /api/water/intake. Throws ValidationError(400) on
 * bad input. The api layer translates that into a JSON error response.
 *
 * TODO(@principal-eng): once `backend/utils/timezoneConverter.js` exposes a
 * `todayInIST()` helper, replace the local implementation with it (claude.md
 * §3.4). Until then the local helper is kept here so this layer remains the
 * single source of "what date does this request mean".
 * ---------------------------------------------------------------------------
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns today's date in IST as YYYY-MM-DD. */
export function todayInIST(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

/**
 * Validate and normalise the query for GET /api/water/intake.
 *
 * Behaviour preserved from the original `water.validators.js` — `userId` is
 * required but accepted as any non-empty string (the data layer eventually
 * coerces it). Stricter typing should be added in a follow-up PR alongside
 * session-derived auth (see README threat model).
 *
 * @param {Record<string, unknown>} query
 * @returns {{ userId: string, date: string }}
 */
export function validateGetIntake(query) {
  const userIdRaw = query?.userId;
  if (userIdRaw == null || userIdRaw === '') {
    throw new ValidationError(400, 'userId is required');
  }
  const userId = String(userIdRaw);

  const dateRaw = query?.date;
  if (dateRaw != null && dateRaw !== '' && !DATE_RE.test(String(dateRaw))) {
    throw new ValidationError(400, 'date must be in YYYY-MM-DD format');
  }
  const date = dateRaw && DATE_RE.test(String(dateRaw)) ? String(dateRaw) : todayInIST();

  return { userId, date };
}
