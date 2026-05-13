/**
 * weightDashboardFormatter.js — pure utilities for the weight dashboard.
 *
 * Date keying, month grouping, summary stats, trend-series projection and
 * SVG chart geometry. No React, no IO. Behavior preserved exactly from
 * the legacy `WeightDashboard.js` implementation.
 */
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';

export const UNDO_SECONDS = 10;
export const WEIGHT_PAGE_SIZE = 10;

export const toDateKey = (value) => {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isSmallChartDevice = () =>
  typeof window !== 'undefined' && window.innerWidth < 380;

export function buildMonthlyGroups(weightHistory) {
  const grouped = {};
  weightHistory.forEach((entry) => {
    if (!entry || !entry.CreatedAt || !entry.Weight) return;
    const date = istToLocalDate(entry.CreatedAt);
    if (!date || isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        monthKey, monthName, entries: [],
        sortDate: new Date(date.getFullYear(), date.getMonth(), 1),
      };
    }
    grouped[monthKey].entries.push(entry);
  });
  return Object.values(grouped).sort((a, b) => b.sortDate - a.sortDate);
}

export function buildPreviousWeightMap(weightHistory) {
  const map = new Map();
  const sorted = weightHistory
    .filter((e) => e && !e.isUndoPlaceholder && e.Weight && e.CreatedAt)
    .sort((a, b) => istToLocalDate(b.CreatedAt) - istToLocalDate(a.CreatedAt));
  for (let i = 0; i < sorted.length; i++) {
    const prev = i < sorted.length - 1 ? sorted[i + 1] : null;
    map.set(sorted[i].ID, prev ? prev.Weight : null);
  }
  return map;
}

export function getMonthStats(entries) {
  if (!entries || entries.length === 0) return null;
  const valid = entries.filter((e) => e && e.Weight && !isNaN(parseFloat(e.Weight)));
  if (valid.length === 0) return null;
  const weights = valid.map((e) => parseFloat(e.Weight));
  const total = weights.reduce((s, w) => s + w, 0);
  const first = valid[valid.length - 1];
  const last = valid[0];
  return {
    avgWeight: (total / weights.length).toFixed(1),
    minWeight: Math.min(...weights).toFixed(1),
    maxWeight: Math.max(...weights).toFixed(1),
    weightChange: (parseFloat(last.Weight) - parseFloat(first.Weight)).toFixed(1),
    count: valid.length,
  };
}

export function buildTrendSeries(weightHistory, weightTrendRangeDays) {
  const sorted = (weightHistory || [])
    .filter((entry) => entry && !entry.isUndoPlaceholder && entry.CreatedAt && entry.Weight)
    .map((entry) => ({
      createdAt: istToLocalDate(entry.CreatedAt),
      weight: Number.parseFloat(entry.Weight),
    }))
    .filter((entry) => !Number.isNaN(entry.createdAt.getTime()) && Number.isFinite(entry.weight))
    .sort((a, b) => a.createdAt - b.createdAt);

  if (sorted.length === 0) return [];

  const latestByDate = new Map();
  sorted.forEach((entry) => { latestByDate.set(toDateKey(entry.createdAt), entry.weight); });

  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - (weightTrendRangeDays - 1));

  const startKey = toDateKey(start);
  const firstKnownInRange = Array.from(latestByDate.entries())
    .filter(([key]) => key >= startKey)
    .sort((a, b) => a[0].localeCompare(b[0]))[0]?.[1];

  let lastKnownWeight = sorted
    .filter((entry) => toDateKey(entry.createdAt) <= startKey)
    .slice(-1)[0]?.weight;
  if (!Number.isFinite(lastKnownWeight)) lastKnownWeight = firstKnownInRange;

  const points = [];
  for (let i = 0; i < weightTrendRangeDays; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = toDateKey(d);
    const hasRecorded = latestByDate.has(key);
    if (hasRecorded) lastKnownWeight = latestByDate.get(key);
    points.push({
      key, date: d,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      compactLabel: `${d.toLocaleDateString('en-US', { month: 'short' }).slice(0, 1)} ${d.toLocaleDateString('en-US', { day: 'numeric' })}`,
      hasRecorded,
      value: Number.isFinite(lastKnownWeight) ? lastKnownWeight : null,
    });
  }
  return points;
}

export function summarizeTrendSeries(series) {
  const numeric = series.map((p) => p.value).filter((v) => Number.isFinite(v));
  const latestValue = numeric.length ? numeric[numeric.length - 1] : null;
  const firstValue = numeric.length ? numeric[0] : null;
  const avgValue = numeric.length ? numeric.reduce((s, v) => s + v, 0) / numeric.length : null;
  const deltaValue = Number.isFinite(latestValue) && Number.isFinite(firstValue)
    ? latestValue - firstValue : null;
  const trendStatus = deltaValue === null || Math.abs(deltaValue) < 0.05
    ? { label: 'Stable', className: 'bg-slate-50 text-slate-700' }
    : deltaValue > 0
      ? { label: 'Trending Up', className: 'bg-rose-50 text-rose-700' }
      : { label: 'Trending Down', className: 'bg-emerald-50 text-emerald-700' };
  return { latestValue, firstValue, avgValue, deltaValue, trendStatus };
}
