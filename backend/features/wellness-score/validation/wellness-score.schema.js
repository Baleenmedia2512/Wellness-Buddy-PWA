import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { enumerateScoreDates } from '../domain/date-range.js';
import { DATE_YMD_RE } from '../../../shared/lib/datetime/index.js';
  const userIdRaw = query?.userId;
  if (userIdRaw == null || userIdRaw === '') {
    throw new ValidationError(400, 'userId is required');
  }
  const userId = String(userIdRaw);
  const dateRaw = query?.date;
  if (dateRaw != null && dateRaw !== '' && !DATE_YMD_RE.test(String(dateRaw))) {
    throw new ValidationError(400, 'date must be YYYY-MM-DD');
  }
  const date = dateRaw && DATE_YMD_RE.test(String(dateRaw)) ? String(dateRaw) : null;
  return { userId, date };
}
export function validateGetScoreHistory(query) {
  const userIdRaw = query?.userId;
  if (userIdRaw == null || userIdRaw === '') {
    throw new ValidationError(400, 'userId is required');
  }
  const userId = String(userIdRaw);
  const startDate = String(query?.startDate || '');
  const endDate = String(query?.endDate || '');
  if (!DATE_YMD_RE.test(startDate) || !DATE_YMD_RE.test(endDate)) {
    throw new ValidationError(400, 'startDate and endDate must be YYYY-MM-DD');
  }
  if (startDate > endDate) {
    throw new ValidationError(400, 'startDate must be on or before endDate');
  }
  try {
    enumerateScoreDates(startDate, endDate);
  } catch (err) {
    throw new ValidationError(400, err.message || 'Invalid date range');
  }
  return { userId, startDate, endDate };
}

export function validateAdminConfigGet(query) {
  const requesterUserId = query?.requesterUserId ?? query?.userId;
  const requesterEmail = query?.requesterEmail ?? query?.email;
  if (
    (requesterUserId == null || requesterUserId === '')
    && (requesterEmail == null || requesterEmail === '')
  ) {
    throw new ValidationError(400, 'requesterUserId or requesterEmail is required');
  }
  return {
    requesterUserId: requesterUserId != null && requesterUserId !== '' ? String(requesterUserId) : null,
    requesterEmail: requesterEmail ? String(requesterEmail).trim() : null,
  };
}

export function validateAdminConfigPut(body) {
  const requesterUserId = body?.requesterUserId ?? body?.userId;
  const requesterEmail = body?.requesterEmail ?? body?.email;
  if (
    (requesterUserId == null || requesterUserId === '')
    && (requesterEmail == null || requesterEmail === '')
  ) {
    throw new ValidationError(400, 'requesterUserId or requesterEmail is required');
  }
  if (!Array.isArray(body?.parameters)) {
    throw new ValidationError(400, 'parameters array is required');
  }
  return {
    requesterUserId: requesterUserId != null && requesterUserId !== '' ? String(requesterUserId) : null,
    requesterEmail: requesterEmail ? String(requesterEmail).trim() : null,
    parameters: body.parameters,
  };
}
