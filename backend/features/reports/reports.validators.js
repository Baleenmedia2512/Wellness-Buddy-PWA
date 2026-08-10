/**
 * reports.validators.js — Input validation for the Reports feature.
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { normalizeDownlineWeightPagination } from './domain/downline-weight.pagination.js';
import { normalizeWellnessScoreReportPagination } from './domain/wellness-score-report.pagination.js';
import { resolveRequestedDateYmd, IANA_IST } from '../../shared/lib/datetime/index.js';

/**
 * Validate and normalise query params for GET downline-weight-status.
 * @param {object} raw
 * @returns {{
 *   coachId: number,
 *   page: number,
 *   limit: number,
 *   search: string,
 *   teamFilter: string,
 *   statusFilter: string,
 *   sort: string,
 * }}
 */
export function validateDownlineWeightStatus(raw) {
  const coachId = parseInt(raw?.coachId, 10);
  if (!coachId || isNaN(coachId) || coachId <= 0) {
    throw new ValidationError(400, 'coachId must be a positive integer');
  }

  const pagination = normalizeDownlineWeightPagination(raw);
  return { coachId, ...pagination };
}

/**
 * Validate and normalise query params for GET wellness-score-report.
 * @param {object} raw
 */
export function validateWellnessScoreReport(raw) {
  const coachId = parseInt(raw?.coachId, 10);
  if (!coachId || isNaN(coachId) || coachId <= 0) {
    throw new ValidationError(400, 'coachId must be a positive integer');
  }

  const pagination = normalizeWellnessScoreReportPagination(raw);
  let scoreDate = null;
  if (raw?.date || raw?.scoreDate) {
    scoreDate = resolveRequestedDateYmd(raw.date || raw.scoreDate, IANA_IST);
  }

  return { coachId, scoreDate, ...pagination };
}
