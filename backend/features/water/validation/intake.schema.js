/**
 * backend/features/water/validation/intake.schema.js
 * ---------------------------------------------------------------------------
 * Input validation for GET /api/water/intake. Throws ValidationError(400) on
 * bad input. Date defaulting uses the user's timezone in the handler layer.
 * ---------------------------------------------------------------------------
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { DATE_YMD_RE } from '../../../shared/lib/datetime/index.js';

/**
 * Validate and normalise the query for GET /api/water/intake.
 *
 * @param {Record<string, unknown>} query
 * @returns {{ userId: string, date: string|null }}
 */
export function validateGetIntake(query) {
  const userIdRaw = query?.userId;
  if (userIdRaw == null || userIdRaw === '') {
    throw new ValidationError(400, 'userId is required');
  }
  const userId = String(userIdRaw);

  const dateRaw = query?.date;
  if (dateRaw != null && dateRaw !== '' && !DATE_YMD_RE.test(String(dateRaw))) {
    throw new ValidationError(400, 'date must be in YYYY-MM-DD format');
  }
  const date = dateRaw && DATE_YMD_RE.test(String(dateRaw)) ? String(dateRaw) : null;

  return { userId, date };
}
