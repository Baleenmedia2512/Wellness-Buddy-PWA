import * as repo from './token.repository.js';

const { getISTTimestamp } = repo;

// ─── save-token-usage ────────────────────────────────────────────────────────
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

// ─── save-token-correction ───────────────────────────────────────────────────
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
  if (existing.length > 0) {
    await repo.updateCorrection(userId, timeRange, correctionData);
  } else {
    await repo.insertCorrection(correctionData);
  }

  // Optional pricing update
  if (inputPerMillion !== undefined && outputPerMillion !== undefined) {
    const modelName = model || 'gemini-2.5-flash-lite';
    await repo.deactivatePricing(modelName);
    const { error: pricingError } = await repo.insertPricing({
      ModelName: modelName,
      InputCostPer1M: parseFloat(inputPerMillion),
      OutputCostPer1M: parseFloat(outputPerMillion),
      Currency: 'USD',
      IsActive: true,
      CreatedAt: getISTTimestamp(),
    });
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
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Token correction saved successfully',
      data: {
        userId,
        inputTokenCost: correctedInputCost,
        outputTokenCost: correctedOutputCost,
        totalTokenCost: totalCost,
      },
    },
  };
}

// ─── get-token-pricing ───────────────────────────────────────────────────────
export async function getPricing({ email, modelName }) {
  try {
    const pricing = await repo.getActivePricing(modelName);
    if (pricing) {
      return {
        httpStatus: 200,
        body: {
          success: true,
          data: {
            inputPerMillion: parseFloat(pricing.InputCostPer1M),
            outputPerMillion: parseFloat(pricing.OutputCostPer1M),
            modelName: pricing.ModelName,
            updatedAt: pricing.UpdatedAt,
            isDefault: false,
          },
        },
      };
    }
    return {
      httpStatus: 200,
      body: {
        success: true,
        data: { inputPerMillion: 0.1, outputPerMillion: 0.4, modelName, isDefault: true },
      },
    };
  } catch (error) {
    // Original behavior: return defaults on error
    return {
      httpStatus: 200,
      body: {
        success: true,
        data: { inputPerMillion: 0.1, outputPerMillion: 0.4, modelName, isDefault: true, error: error.message },
      },
    };
  }
}

// ─── get-token-correction ────────────────────────────────────────────────────
export async function getCorrection({ email, timeRange }) {
  const userId = await repo.findUserIdByEmail(email);
  if (userId === null) {
    return {
      httpStatus: 200,
      body: { success: true, data: null, latestUsageTimestamp: null, message: 'User not found' },
    };
  }
  const correction = await repo.getCorrectionForRange(userId, timeRange);
  const latestUsageTimestamp = await repo.getLatestUsageTimestamp(email);

  if (!correction) {
    return {
      httpStatus: 200,
      body: { success: true, data: null, latestUsageTimestamp, message: 'No correction record found' },
    };
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

// ─── get-latest-token-costs ──────────────────────────────────────────────────
export async function getLatestCosts({ email }) {
  const userId = await repo.findUserIdByEmail(email);
  const original = await repo.getLatestUsageRecord(email);
  if (!original) {
    return { httpStatus: 404, body: { success: false, message: 'No token usage records found' } };
  }
  const latestOriginalTs = new Date(original.CreatedAt);

  if (userId !== null) {
    const corrected = await repo.getLatestCorrectionByUserId(userId);
    if (corrected && new Date(corrected.CreatedAt) > latestOriginalTs) {
      return {
        httpStatus: 200,
        body: {
          success: true,
          data: {
            inputTokenCost: corrected.InputTokenCost,
            outputTokenCost: corrected.OutputTokenCost,
            totalTokenCost: corrected.TotalTokenCost,
            createdAt: corrected.CreatedAt,
            isCorrected: true,
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
        inputTokenCost: original.InputTokenCost,
        outputTokenCost: original.OutputTokenCost,
        totalTokenCost: original.TotalTokenCost,
        createdAt: original.CreatedAt,
        isCorrected: false,
      },
    },
  };
}

// ─── reverse-lookup-correction ───────────────────────────────────────────────
export async function reverseLookup({ correctedName }) {
  const correction = await repo.reverseLookupCorrection(correctedName);
  if (!correction) {
    return {
      httpStatus: 200,
      body: { success: false, found: false, correctedName, originalAiName: null },
    };
  }
  return {
    httpStatus: 200,
    body: {
      success: true,
      found: true,
      correctedName,
      originalAiName: correction.AiDetected,
      lastCorrectedBy: correction.UserId,
      lastCorrected: correction.LastCorrected,
    },
  };
}

// ─── get-token-usage (admin/developer-gated) ─────────────────────────────────
const parseLocalDate = (dateStr) => {
  if (dateStr instanceof Date) return dateStr;
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
};
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

function computeRange({ timeRange, startDate, endDate, userToday }) {
  if (startDate && endDate) {
    return { startDateObj: startOfDay(parseLocalDate(startDate)), endDateObj: endOfDay(parseLocalDate(endDate)) };
  }
  const todayStr = userToday || new Date().toISOString().split('T')[0];
  const today = parseLocalDate(todayStr);
  switch (timeRange) {
    case 'today':     return { startDateObj: startOfDay(today), endDateObj: endOfDay(today) };
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); return { startDateObj: startOfDay(y), endDateObj: endOfDay(y) }; }
    case 'week':      { const w = new Date(today); w.setDate(w.getDate() - 6); return { startDateObj: startOfDay(w), endDateObj: endOfDay(today) }; }
    case 'month':     { const m = new Date(today); m.setDate(m.getDate() - 29); return { startDateObj: startOfDay(m), endDateObj: endOfDay(today) }; }
    case 'all':
    default:          return { startDateObj: new Date(0), endDateObj: endOfDay(today) };
  }
}

function detectEffectiveRange(startDateObj, endDateObj, userToday, isCustomDateRange) {
  if (!isCustomDateRange) return undefined;
  const todayStr = userToday || new Date().toISOString().split('T')[0];
  const today = parseLocalDate(todayStr);
  const tStart = startOfDay(today).getTime();
  const tEnd = endOfDay(today).getTime();
  const cs = startDateObj.getTime();
  const ce = endDateObj.getTime();
  if (cs === tStart && ce === tEnd) return 'today';
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (cs === startOfDay(y).getTime() && ce === endOfDay(y).getTime()) return 'yesterday';
  const w = new Date(today); w.setDate(w.getDate() - 6);
  if (cs === startOfDay(w).getTime() && ce === tEnd) return 'week';
  const m = new Date(today); m.setDate(m.getDate() - 29);
  if (cs === startOfDay(m).getTime() && ce === tEnd) return 'month';
  return null;
}

export async function getUsage(input) {
  const { email, timeRange, operationType, model, startDate, endDate, userToday } = input;

  const user = await repo.findUserRoleAndId(email);
  if (!user) {
    return { httpStatus: 403, body: { success: false, message: `Access denied. User not found: ${email}` } };
  }
  if (user.Role !== 'admin' && user.Role !== 'developer') {
    return {
      httpStatus: 403,
      body: { success: false, message: `Access denied. Admin or Developer role required. Current role: ${user.Role}` },
    };
  }

  const { startDateObj, endDateObj } = computeRange({ timeRange, startDate, endDate, userToday });
  const records = await repo.queryUsageRecords({
    startDateISO: startDateObj.toISOString(),
    endDateISO: endDateObj.toISOString(),
    operationType,
    model,
  });

  const summary = {
    totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0,
    totalInputCost: 0, totalOutputCost: 0, totalCost: 0,
    requestCount: records.length, averageCostPerRequest: 0,
  };
  records.forEach((r) => {
    summary.totalInputTokens += Number(r.InputTokens) || 0;
    summary.totalOutputTokens += Number(r.OutputTokens) || 0;
    summary.totalTokens += Number(r.TotalTokens) || 0;
    summary.totalInputCost += Number(r.InputTokenCost) || 0;
    summary.totalOutputCost += Number(r.OutputTokenCost) || 0;
    summary.totalCost += Number(r.TotalTokenCost) || 0;
  });
  if (summary.requestCount > 0) summary.averageCostPerRequest = summary.totalCost / summary.requestCount;

  // Apply correction if applicable
  const isCustomRange = !!(startDate && endDate);
  const detected = detectEffectiveRange(startDateObj, endDateObj, userToday, isCustomRange);
  const effectiveTimeRange = isCustomRange ? detected : timeRange;

  if (user.UserId && effectiveTimeRange) {
    const correction = await repo.getCorrectionByRange(user.UserId, effectiveTimeRange);
    if (correction) {
      const newer = await repo.hasNewerUsage(
        startDateObj.toISOString(),
        endDateObj.toISOString(),
        correction.CreatedAt,
      );
      if (!newer) {
        summary.totalInputCost = Number(correction.InputTokenCost) || 0;
        summary.totalOutputCost = Number(correction.OutputTokenCost) || 0;
        summary.totalCost = Number(correction.TotalTokenCost) || 0;
        if (summary.requestCount > 0) summary.averageCostPerRequest = summary.totalCost / summary.requestCount;
      }
    }
  }

  // Group by op
  const byOpMap = {};
  records.forEach((r) => {
    const op = r.OperationType || 'Unknown';
    if (!byOpMap[op]) {
      byOpMap[op] = { operationType: op, totalTokens: 0, totalCost: 0, inputTokens: 0, outputTokens: 0, requestCount: 0 };
    }
    byOpMap[op].totalTokens += Number(r.TotalTokens) || 0;
    byOpMap[op].totalCost += Number(r.TotalTokenCost) || 0;
    byOpMap[op].inputTokens += Number(r.InputTokens) || 0;
    byOpMap[op].outputTokens += Number(r.OutputTokens) || 0;
    byOpMap[op].requestCount += 1;
  });
  const byOperation = Object.values(byOpMap)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .map((op) => ({ ...op, percentage: ((op.totalTokens / (summary.totalTokens || 1)) * 100).toFixed(1) }));

  // Group by model
  const byModelMap = {};
  records.forEach((r) => {
    const m = r.ModelName || 'Unknown';
    if (!byModelMap[m]) {
      byModelMap[m] = { modelName: m, totalTokens: 0, totalCost: 0, inputTokens: 0, outputTokens: 0, requestCount: 0 };
    }
    byModelMap[m].totalTokens += Number(r.TotalTokens) || 0;
    byModelMap[m].totalCost += Number(r.TotalTokenCost) || 0;
    byModelMap[m].inputTokens += Number(r.InputTokens) || 0;
    byModelMap[m].outputTokens += Number(r.OutputTokens) || 0;
    byModelMap[m].requestCount += 1;
  });
  const byModel = Object.values(byModelMap)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .map((m) => ({ ...m, percentage: ((m.totalTokens / (summary.totalTokens || 1)) * 100).toFixed(1) }));

  // Recent
  const recentUsage = records.slice(0, 10).map((r) => ({
    id: r.ID, userId: r.UserId, email: r.Email,
    operationType: r.OperationType, modelName: r.ModelName,
    inputTokens: Number(r.InputTokens) || 0, outputTokens: Number(r.OutputTokens) || 0,
    totalTokens: Number(r.TotalTokens) || 0,
    inputTokenCost: Number(r.InputTokenCost) || 0, outputTokenCost: Number(r.OutputTokenCost) || 0,
    totalTokenCost: Number(r.TotalTokenCost) || 0,
    createdAt: r.CreatedAt,
  }));

  // Daily
  const dailyMap = {};
  records.forEach((r) => {
    const date = new Date(r.CreatedAt).toISOString().split('T')[0];
    if (!dailyMap[date]) dailyMap[date] = { date, totalTokens: 0, totalCost: 0, requestCount: 0 };
    dailyMap[date].totalTokens += Number(r.TotalTokens) || 0;
    dailyMap[date].totalCost += Number(r.TotalTokenCost) || 0;
    dailyMap[date].requestCount += 1;
  });
  const dailyStats = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  // User spending
  const userSpendMap = {};
  records.forEach((r) => {
    const key = r.UserId || r.Email || 'Unknown';
    if (!userSpendMap[key]) {
      userSpendMap[key] = {
        userId: r.UserId, email: r.Email,
        userName: r.Email ? r.Email.split('@')[0] : 'Unknown',
        inputTokens: 0, outputTokens: 0, totalTokens: 0,
        inputCost: 0, outputCost: 0, totalCost: 0, requestCount: 0,
      };
    }
    const u = userSpendMap[key];
    u.inputTokens += Number(r.InputTokens) || 0;
    u.outputTokens += Number(r.OutputTokens) || 0;
    u.totalTokens += Number(r.TotalTokens) || 0;
    u.inputCost += Number(r.InputTokenCost) || 0;
    u.outputCost += Number(r.OutputTokenCost) || 0;
    u.totalCost += Number(r.TotalTokenCost) || 0;
    u.requestCount += 1;
  });
  const userSpending = Object.values(userSpendMap).sort((a, b) => b.totalCost - a.totalCost).slice(0, 50);
  const userIds = userSpending.map((u) => u.userId).filter(Boolean);
  if (userIds.length > 0) {
    const users = await repo.getUserNamesByIds(userIds);
    const map = {};
    users.forEach((u) => { map[u.UserId] = u.UserName; });
    userSpending.forEach((u) => { if (u.userId && map[u.userId]) u.userName = map[u.userId]; });
  }

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
