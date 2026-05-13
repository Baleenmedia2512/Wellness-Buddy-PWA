/**
 * usage.service.js — Token feature: usage save + admin usage report.
 *
 * Owns POST `/api/token/usage` (saveUsage) and GET `/api/token/usage`
 * (getUsage, admin/developer-gated). Aggregation primitives live in
 * `token-cost.service.js` and calculations are preserved exactly.
 */
import * as repo from './token.repository.js';
import {
  computeRange, detectEffectiveRange, summarizeRecords,
  groupByOperation, groupByModel, projectRecent, groupDaily, projectUserSpending,
} from './token-cost.service.js';

export async function saveUsage(input) {
  const data = await repo.insertUsage({
    UserId: input.userId.toString(),
    Email: input.email,
    OperationType: input.operationType,
    ModelName: input.modelName,
    InputTokens: input.inputTokens || 0,
    OutputTokens: input.outputTokens || 0,
    TotalTokens: input.totalTokens || 0,
    InputTokenCost: input.inputTokenCost || 0,
    OutputTokenCost: input.outputTokenCost || 0,
    TotalTokenCost: input.totalTokenCost || 0,
    CreatedAt: new Date().toISOString(),
  });
  return {
    httpStatus: 200,
    body: { success: true, message: 'Token usage saved successfully', id: data?.ID || data?.id },
  };
}

async function authorizeAdmin(email) {
  const user = await repo.findUserRoleAndId(email);
  if (!user) {
    return { error: { httpStatus: 403, body: { success: false, message: `Access denied. User not found: ${email}` } } };
  }
  if (user.Role !== 'admin' && user.Role !== 'developer') {
    return {
      error: {
        httpStatus: 403,
        body: { success: false, message: `Access denied. Admin or Developer role required. Current role: ${user.Role}` },
      },
    };
  }
  return { user };
}

async function applyCorrectionIfApplicable(summary, { user, startDateObj, endDateObj, effectiveTimeRange }) {
  if (!user.UserId || !effectiveTimeRange) return summary;
  const correction = await repo.getCorrectionByRange(user.UserId, effectiveTimeRange);
  if (!correction) return summary;
  const newer = await repo.hasNewerUsage(
    startDateObj.toISOString(), endDateObj.toISOString(), correction.CreatedAt,
  );
  if (newer) return summary;
  summary.totalInputCost = Number(correction.InputTokenCost) || 0;
  summary.totalOutputCost = Number(correction.OutputTokenCost) || 0;
  summary.totalCost = Number(correction.TotalTokenCost) || 0;
  if (summary.requestCount > 0) summary.averageCostPerRequest = summary.totalCost / summary.requestCount;
  return summary;
}

async function attachUserNames(userSpending) {
  const userIds = userSpending.map((u) => u.userId).filter(Boolean);
  if (userIds.length === 0) return userSpending;
  const users = await repo.getUserNamesByIds(userIds);
  const map = {};
  users.forEach((u) => { map[u.UserId] = u.UserName; });
  userSpending.forEach((u) => { if (u.userId && map[u.userId]) u.userName = map[u.userId]; });
  return userSpending;
}

export async function getUsage(input) {
  const { email, timeRange, operationType, model, startDate, endDate, userToday } = input;

  const auth = await authorizeAdmin(email);
  if (auth.error) return auth.error;

  const { startDateObj, endDateObj } = computeRange({ timeRange, startDate, endDate, userToday });
  const records = await repo.queryUsageRecords({
    startDateISO: startDateObj.toISOString(),
    endDateISO: endDateObj.toISOString(),
    operationType, model,
  });

  const summary = summarizeRecords(records);
  const isCustomRange = !!(startDate && endDate);
  const effectiveTimeRange = isCustomRange
    ? detectEffectiveRange(startDateObj, endDateObj, userToday, true)
    : timeRange;
  await applyCorrectionIfApplicable(summary, { user: auth.user, startDateObj, endDateObj, effectiveTimeRange });

  const byOperation = groupByOperation(records, summary.totalTokens);
  const byModel = groupByModel(records, summary.totalTokens);
  const recentUsage = projectRecent(records);
  const dailyStats = groupDaily(records);
  const userSpending = await attachUserNames(projectUserSpending(records));

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        summary: {
          ...summary,
          mostUsedOperation: byOperation.length > 0 ? byOperation[0].operationType : 'N/A',
          mostUsedModel: byModel.length > 0 ? byModel[0].modelName : 'N/A',
        },
        byOperation, byModel, recentUsage, dailyStats, userSpending,
        timeRange, generatedAt: new Date().toISOString(),
      },
    },
  };
}
