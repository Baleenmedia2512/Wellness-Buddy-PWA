/**
 * Weight feature — input validators.
 * Pure functions. Throw on invalid input via { status, message } error objects.
 */

class ValidationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

export { ValidationError };
