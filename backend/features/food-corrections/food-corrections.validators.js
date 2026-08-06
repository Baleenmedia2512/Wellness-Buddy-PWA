import { ValidationError } from '../../shared/lib/ValidationError.js';
import { DATE_YMD_RE } from '../../shared/lib/datetime/index.js';

export function validateUserId(query) {
  if (!query?.userId) throw new ValidationError(400, 'Missing required parameter: userId');
  return { userId: query.userId };
}

export function validateGlobal(query) {
  return { requestingUserId: query?.userId || null };
}

export function validateSaveCorrection(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { userId, aiDetected, userCorrected } = body;
  if (!userId || !aiDetected || !userCorrected) {
    throw new ValidationError(400, 'Missing required fields: userId, aiDetected, userCorrected');
  }
  return body;
}

export function validateSearch(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  if (!query.query || query.query.trim().length < 1) {
    throw new ValidationError(400, 'query is required');
  }
  return { userId: query.userId, searchTerm: query.query.trim() };
}

export function validateUpdateAnalysis(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { id, userId, analysisData } = body;
  if (!id || !userId) throw new ValidationError(400, 'Missing meal ID or userId');
  if (!analysisData || !Array.isArray(analysisData?.foods)) {
    throw new ValidationError(400, 'Invalid analysis data format');
  }
  return body;
}

const MAX_STATS_RANGE_DAYS = 31;

export function validateStats(query) {
  if (!query?.userId) throw new ValidationError(400, 'UserId is required');

  const startDate = query.startDate && DATE_YMD_RE.test(String(query.startDate))
    ? String(query.startDate)
    : null;
  const endDate = query.endDate && DATE_YMD_RE.test(String(query.endDate))
    ? String(query.endDate)
    : null;

  if ((startDate && !endDate) || (!startDate && endDate)) {
    throw new ValidationError(400, 'startDate and endDate must both be provided');
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ValidationError(400, 'startDate must be on or before endDate');
  }

  return {
    userId: query.userId,
    date: query.date || null,
    startDate,
    endDate,
    detailed: String(query.detailed) === 'true',
    // totalsOnly: return dailyTotals only (no meal rows) — for calorie trend charts
    totalsOnly: String(query.totalsOnly) === 'true',
    maxRangeDays: MAX_STATS_RANGE_DAYS,
  };
}

export function validateMealImageInput(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  if (!query?.id) throw new ValidationError(400, 'id is required');
  return { userId: query.userId, id: query.id };
}
