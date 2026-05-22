import { ValidationError } from '../../shared/lib/ValidationError.js';

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

export function validateStats(query) {
  if (!query?.userId) throw new ValidationError(400, 'UserId is required');
  return {
    userId: query.userId,
    date: query.date || null,
    detailed: String(query.detailed) === 'true',
  };
}
