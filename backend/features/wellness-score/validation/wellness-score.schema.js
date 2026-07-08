import { ValidationError } from '../../../shared/lib/ValidationError.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInIST(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

export function validateGetDailyScore(query) {
  const userIdRaw = query?.userId;
  if (userIdRaw == null || userIdRaw === '') {
    throw new ValidationError(400, 'userId is required');
  }
  const userId = String(userIdRaw);
  const dateRaw = query?.date;
  if (dateRaw != null && dateRaw !== '' && !DATE_RE.test(String(dateRaw))) {
    throw new ValidationError(400, 'date must be YYYY-MM-DD');
  }
  const date = dateRaw && DATE_RE.test(String(dateRaw)) ? String(dateRaw) : todayInIST();
  return { userId, date };
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
