/**
 * correction.service.js — Token feature: corrections + latest costs +
 * reverse-lookup.
 *
 * Owns POST/GET `/api/token/correction`, GET `/api/token/latest-costs`,
 * and POST `/api/token/reverse-lookup`. Response shapes preserved
 * byte-identical to the legacy handlers.
 */
import * as repo from './token.repository.js';

const { getISTTimestamp } = repo;
const DEFAULT_PRICING_MODEL = 'gemini-2.5-flash-lite';

async function maybeUpdatePricing({ inputPerMillion, outputPerMillion, model }) {
  if (inputPerMillion === undefined || outputPerMillion === undefined) return null;
  const modelName = model || DEFAULT_PRICING_MODEL;
  await repo.deactivatePricing(modelName);
  const { error } = await repo.insertPricing({
    ModelName: modelName,
    InputCostPer1M: parseFloat(inputPerMillion),
    OutputCostPer1M: parseFloat(outputPerMillion),
    Currency: 'USD', IsActive: true, CreatedAt: getISTTimestamp(),
  });
  return error || null;
}

export async function saveCorrection(input) {
  const {
    email, correctedInputCost, correctedOutputCost,
    inputPerMillion, outputPerMillion, timeRange, startDate, endDate, model,
  } = input;

  const userId = await repo.findUserIdByEmail(email);
  if (userId === null) return { httpStatus: 404, body: { success: false, message: 'User not found' } };

  const totalCost = parseFloat(correctedInputCost) + parseFloat(correctedOutputCost);
  const correctionData = {
    UserId: userId,
    InputTokenCost: correctedInputCost,
    OutputTokenCost: correctedOutputCost,
    TotalTokenCost: totalCost,
    TimeRange: timeRange || 'all',
    StartDate: startDate || null,
    EndDate: endDate || null,
    CreatedAt: new Date().toISOString(),
  };

  const existing = await repo.findCorrection(userId, timeRange);
  if (existing.length > 0) await repo.updateCorrection(userId, timeRange, correctionData);
  else await repo.insertCorrection(correctionData);

  const pricingError = await maybeUpdatePricing({ inputPerMillion, outputPerMillion, model });
  if (pricingError) {
    return {
      httpStatus: 500,
      body: {
        success: false,
        message: 'Token correction saved but pricing failed to save',
        error: pricingError.message,
        tokenCorrectionSaved: true,
      },
    };
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Token correction saved successfully',
      data: { userId, inputTokenCost: correctedInputCost, outputTokenCost: correctedOutputCost, totalTokenCost: totalCost },
    },
  };
}

export async function getCorrection({ email, timeRange }) {
  const userId = await repo.findUserIdByEmail(email);
  if (userId === null) {
    return { httpStatus: 200, body: { success: true, data: null, latestUsageTimestamp: null, message: 'User not found' } };
  }
  const correction = await repo.getCorrectionForRange(userId, timeRange);
  const latestUsageTimestamp = await repo.getLatestUsageTimestamp(email);

  if (!correction) {
    return { httpStatus: 200, body: { success: true, data: null, latestUsageTimestamp, message: 'No correction record found' } };
  }
  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        inputCost: correction.InputTokenCost,
        outputCost: correction.OutputTokenCost,
        totalCost: correction.TotalTokenCost,
        correctionTimestamp: correction.CreatedAt,
      },
      latestUsageTimestamp,
    },
  };
}

export async function getLatestCosts({ email }) {
  const userId = await repo.findUserIdByEmail(email);
  const original = await repo.getLatestUsageRecord(email);
  if (!original) return { httpStatus: 404, body: { success: false, message: 'No token usage records found' } };

  const latestOriginalTs = new Date(original.CreatedAt);
  if (userId !== null) {
    const corrected = await repo.getLatestCorrectionByUserId(userId);
    if (corrected && new Date(corrected.CreatedAt) > latestOriginalTs) {
      return {
        httpStatus: 200,
        body: {
          success: true,
          data: {
            inputTokenCost: corrected.InputTokenCost, outputTokenCost: corrected.OutputTokenCost,
            totalTokenCost: corrected.TotalTokenCost, createdAt: corrected.CreatedAt, isCorrected: true,
          },
        },
      };
    }
  }
  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        inputTokenCost: original.InputTokenCost, outputTokenCost: original.OutputTokenCost,
        totalTokenCost: original.TotalTokenCost, createdAt: original.CreatedAt, isCorrected: false,
      },
    },
  };
}

export async function reverseLookup({ correctedName }) {
  const correction = await repo.reverseLookupCorrection(correctedName);
  if (!correction) {
    return { httpStatus: 200, body: { success: false, found: false, correctedName, originalAiName: null } };
  }
  return {
    httpStatus: 200,
    body: {
      success: true, found: true, correctedName,
      originalAiName: correction.AiDetected,
      lastCorrectedBy: correction.UserId,
      lastCorrected: correction.LastCorrected,
    },
  };
}
