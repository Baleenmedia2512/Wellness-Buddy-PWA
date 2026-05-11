import { ValidationError } from '../weight/weight.validators.js';

export function validateSaveUsage(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const {
    userId, email, operationType, modelName,
    inputTokens, outputTokens, totalTokens,
    inputTokenCost, outputTokenCost, totalTokenCost,
  } = body;
  if (!userId || !email) throw new ValidationError(400, 'userId and email are required');
  if (!operationType || !modelName) {
    throw new ValidationError(400, 'operationType and modelName are required');
  }
  if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) {
    throw new ValidationError(400, 'Token counts (inputTokens, outputTokens, totalTokens) are required');
  }
  return {
    userId, email, operationType, modelName,
    inputTokens, outputTokens, totalTokens,
    inputTokenCost, outputTokenCost, totalTokenCost,
  };
}

export function validateSaveCorrection(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { email, correctedInputCost, correctedOutputCost } = body;
  if (!email || correctedInputCost === undefined || correctedOutputCost === undefined) {
    throw new ValidationError(
      400,
      'Missing required fields: email, correctedInputCost, correctedOutputCost'
    );
  }
  return body;
}

export function validateGetUsage(query) {
  if (!query?.email) throw new ValidationError(400, 'Email is required');
  return {
    email: query.email,
    timeRange: query.timeRange || 'month',
    operationType: query.operationType,
    model: query.model,
    startDate: query.startDate,
    endDate: query.endDate,
    userToday: query.userToday,
  };
}

export function validateGetPricing(query) {
  if (!query?.email) throw new ValidationError(400, 'Missing required parameter: email');
  return { email: query.email, modelName: query.modelName || 'gemini-2.5-flash-lite' };
}

export function validateGetCorrection(query) {
  if (!query?.email) throw new ValidationError(400, 'Email parameter is required');
  return {
    email: query.email,
    timeRange: query.timeRange,
    startDate: query.startDate,
    endDate: query.endDate,
  };
}

export function validateLatestCosts(query) {
  if (!query?.email) throw new ValidationError(400, 'Email is required');
  return { email: query.email };
}

export function validateReverseLookup(query) {
  if (!query?.correctedName) {
    throw new ValidationError(400, 'Missing required parameter: correctedName');
  }
  return { correctedName: query.correctedName };
}
