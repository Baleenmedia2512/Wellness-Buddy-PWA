import { ValidationError } from '../weight/weight.validators.js';

export function validateSave(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing or too large. Maximum size is 10MB.');
  const { userId, imagePath, analysisResult } = body;
  if (!userId || !imagePath || !analysisResult) {
    throw new ValidationError(400, 'Missing required fields: userId, imagePath, analysisResult');
  }
  return body;
}

export function validateList(query) {
  if (!query?.userId) throw new ValidationError(400, 'UserId is required');
  return {
    userId: query.userId,
    limit: parseInt(query.limit, 10) || 50,
    offset: parseInt(query.offset, 10) || 0,
  };
}

export function validateDelete(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { id, userId } = body;
  if (!id || !userId) {
    throw new ValidationError(400, 'Analysis ID and userId are required');
  }
  return { id, userId };
}

export function validateUndo(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { id, userId } = body;
  if (!id) throw new ValidationError(400, 'Analysis ID is required');
  return { id, userId };
}
