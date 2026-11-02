/**
 * history.schema.js — Validation for GET /api/body-parameters-card/history
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';

function parsePositiveId(raw, field) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new ValidationError(400, `${field} must be a valid UserId`);
  }
  return n;
}

/**
 * @param {object} query
 * @returns {{ userId: number, viewerUserId: number|null }}
 */
export function validateCardHistoryQuery(query) {
  const userId = parsePositiveId(query?.userId, 'userId');
  if (!userId) throw new ValidationError(400, 'Missing required field: userId');
  return {
    userId,
    viewerUserId: parsePositiveId(query?.viewerUserId, 'viewerUserId'),
  };
}
