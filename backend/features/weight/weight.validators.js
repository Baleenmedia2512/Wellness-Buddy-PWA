/**
 * Weight feature — input validators.
 * Pure functions. Throw on invalid input via { status, message } error objects.
 */

import { ValidationError } from '../../shared/lib/ValidationError.js';
export { ValidationError };


export function validateSaveInput(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing or too large. Maximum size is 10MB.');
  const { userId, weightValue, unit = 'kg' } = body;
  if (!userId || !weightValue) {
    throw new ValidationError(400, 'Missing required fields: userId, weightValue');
  }
  const weight = parseFloat(weightValue);
  if (isNaN(weight) || weight <= 0 || weight > 500) {
    throw new ValidationError(400, 'Invalid weight value. Must be between 0 and 500.');
  }
  if (unit !== 'kg' && unit !== 'lbs') {
    throw new ValidationError(400, 'Invalid unit. Must be "kg" or "lbs".');
  }
  return { ...body, weight, unit };
}

export function validateHistoryInput(query) {
  if (!query?.userId) throw new ValidationError(400, 'Missing required field: userId');
  const parsedLimit = query.limit !== undefined && query.limit !== null && query.limit !== ''
    ? parseInt(query.limit, 10)
    : null;
  const parsedOffset = query.offset !== undefined && query.offset !== null && query.offset !== ''
    ? parseInt(query.offset, 10)
    : 0;
  return {
    userId: query.userId,
    includeImage: query.includeImage === 'true' || query.includeImage === true,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null,
    offset: Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
    viewerUserId: query.viewerUserId || null,
  };
}

export function validateImageInput(query) {
  const { userId, id } = query || {};
  if (!userId || !id) throw new ValidationError(400, 'Missing required fields: userId, id');
  return { userId, id };
}

export function validateDeleteInput(body) {
  const { userId, entryId } = body || {};
  if (!userId || !entryId) {
    throw new ValidationError(400, 'Missing required fields: userId, entryId');
  }
  return { userId, entryId };
}

export function validateUndoInput(body) {
  const { id, userId } = body || {};
  if (!id) throw new ValidationError(400, 'Weight entry ID is required');
  return { id, userId };
}

export function validateMarathonComparisonInput(query) {
  if (!query?.userId) throw new ValidationError(400, 'Missing required field: userId');
  const todayYmd = typeof query.todayYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.todayYmd)
    ? query.todayYmd
    : null;
  const rawCurrent = query.currentDay0Weight ?? query.currentMarathonDay0Weight;
  const currentDay0Weight = rawCurrent != null && rawCurrent !== ''
    ? parseFloat(rawCurrent)
    : null;
  if (currentDay0Weight != null && (!Number.isFinite(currentDay0Weight) || currentDay0Weight <= 0)) {
    throw new ValidationError(400, 'Invalid currentDay0Weight');
  }
  return { userId: query.userId, todayYmd, currentDay0Weight };
}
