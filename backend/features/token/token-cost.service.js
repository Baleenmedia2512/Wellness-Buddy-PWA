/**
 * token-cost.service.js — shared utilities for the token feature.
 *
 * Pure helpers used by `usage.service.js` and `correction.service.js`:
 * date-range math (`computeRange` / `detectEffectiveRange`), and the
 * record-aggregation primitives (`summarizeRecords`, group-by helpers,
 * `projectRecent`, `groupDaily`, `projectUserSpending`).
 *
 * Calculations are preserved byte-identical to the legacy implementation.
 */

// ── date helpers ────────────────────────────────────────────────────────────
export const parseLocalDate = (dateStr) => {
  if (dateStr instanceof Date) return dateStr;
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
};
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

export function computeRange({ timeRange, startDate, endDate, userToday }) {
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

export function detectEffectiveRange(startDateObj, endDateObj, userToday, isCustomDateRange) {
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

// ── aggregation primitives ──────────────────────────────────────────────────
export function summarizeRecords(records) {
  const s = {
    totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0,
    totalInputCost: 0, totalOutputCost: 0, totalCost: 0,
    requestCount: records.length, averageCostPerRequest: 0,
  };
  records.forEach((r) => {
    s.totalInputTokens += Number(r.InputTokens) || 0;
    s.totalOutputTokens += Number(r.OutputTokens) || 0;
    s.totalTokens += Number(r.TotalTokens) || 0;
    s.totalInputCost += Number(r.InputTokenCost) || 0;
    s.totalOutputCost += Number(r.OutputTokenCost) || 0;
    s.totalCost += Number(r.TotalTokenCost) || 0;
  });
  if (s.requestCount > 0) s.averageCostPerRequest = s.totalCost / s.requestCount;
  return s;
}

function groupBy(records, keyName, fallbackKey) {
  const map = {};
  records.forEach((r) => {
    const key = r[keyName] || fallbackKey;
    const bucket = (map[key] ||= {
      [keyName === 'OperationType' ? 'operationType' : 'modelName']: key,
      totalTokens: 0, totalCost: 0, inputTokens: 0, outputTokens: 0, requestCount: 0,
    });
    bucket.totalTokens += Number(r.TotalTokens) || 0;
    bucket.totalCost += Number(r.TotalTokenCost) || 0;
    bucket.inputTokens += Number(r.InputTokens) || 0;
    bucket.outputTokens += Number(r.OutputTokens) || 0;
    bucket.requestCount += 1;
  });
  return map;
}

const withPercent = (totalTokens) => (b) => ({
  ...b, percentage: ((b.totalTokens / (totalTokens || 1)) * 100).toFixed(1),
});

export function groupByOperation(records, totalTokens) {
  return Object.values(groupBy(records, 'OperationType', 'Unknown'))
    .sort((a, b) => b.totalTokens - a.totalTokens).map(withPercent(totalTokens));
}
export function groupByModel(records, totalTokens) {
  return Object.values(groupBy(records, 'ModelName', 'Unknown'))
    .sort((a, b) => b.totalTokens - a.totalTokens).map(withPercent(totalTokens));
}

export function projectRecent(records) {
  return records.slice(0, 10).map((r) => ({
    id: r.ID, userId: r.UserId, email: r.Email,
    operationType: r.OperationType, modelName: r.ModelName,
    inputTokens: Number(r.InputTokens) || 0, outputTokens: Number(r.OutputTokens) || 0,
    totalTokens: Number(r.TotalTokens) || 0,
    inputTokenCost: Number(r.InputTokenCost) || 0, outputTokenCost: Number(r.OutputTokenCost) || 0,
    totalTokenCost: Number(r.TotalTokenCost) || 0,
    createdAt: r.CreatedAt,
  }));
}

export function groupDaily(records) {
  const m = {};
  records.forEach((r) => {
    const date = new Date(r.CreatedAt).toISOString().split('T')[0];
    const b = (m[date] ||= { date, totalTokens: 0, totalCost: 0, requestCount: 0 });
    b.totalTokens += Number(r.TotalTokens) || 0;
    b.totalCost += Number(r.TotalTokenCost) || 0;
    b.requestCount += 1;
  });
  return Object.values(m).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
}

export function projectUserSpending(records) {
  const m = {};
  records.forEach((r) => {
    const key = r.UserId || r.Email || 'Unknown';
    const u = (m[key] ||= {
      userId: r.UserId, email: r.Email,
      userName: r.Email ? r.Email.split('@')[0] : 'Unknown',
      inputTokens: 0, outputTokens: 0, totalTokens: 0,
      inputCost: 0, outputCost: 0, totalCost: 0, requestCount: 0,
    });
    u.inputTokens += Number(r.InputTokens) || 0;
    u.outputTokens += Number(r.OutputTokens) || 0;
    u.totalTokens += Number(r.TotalTokens) || 0;
    u.inputCost += Number(r.InputTokenCost) || 0;
    u.outputCost += Number(r.OutputTokenCost) || 0;
    u.totalCost += Number(r.TotalTokenCost) || 0;
    u.requestCount += 1;
  });
  return Object.values(m).sort((a, b) => b.totalCost - a.totalCost).slice(0, 50);
}
