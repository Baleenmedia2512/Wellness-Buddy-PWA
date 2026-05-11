import { ValidationError } from '../weight/weight.validators.js';

export function validateSaveLog(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { userId, platform, topic } = body;
  if (!userId || !platform || !topic) {
    throw new ValidationError(400, 'Missing required fields: userId, platform, topic');
  }
  return body;
}

export function validateGetLogs(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  return { userId: query.userId };
}

export function validateGetLogImage(query) {
  if (!query?.logId || !query?.userId) {
    throw new ValidationError(400, 'logId and userId are required');
  }
  return { logId: query.logId, userId: query.userId };
}

export function validateGetSummary(query) {
  if (!query?.userId) throw new ValidationError(400, 'userId is required');
  return { userId: query.userId };
}

export function validateDeleteLog(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { userId, logId } = body;
  if (!userId || !logId) {
    throw new ValidationError(400, 'Missing required fields: userId, logId');
  }
  return { userId, logId };
}

export function validateUndoDelete(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { id, userId } = body;
  if (!id) throw new ValidationError(400, 'Education log ID is required');
  return { id, userId };
}
