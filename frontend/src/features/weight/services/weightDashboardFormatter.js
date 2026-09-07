/**
 * weightDashboardFormatter.js — pure utilities for the weight dashboard.
 *
 * Date keying, month grouping, summary stats, trend-series projection and
 * SVG chart geometry. No React, no IO. Behavior preserved exactly from
 * the legacy `WeightDashboard.js` implementation.
 */
import {
  dateToBusinessYmd,
  timestampToBusinessYmd,
  parseUtcTimestamp,
  compareUtcTimestampsDesc,
  todayBusinessDate,
  formatCalendarPickerDate,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../shared/utils/datetimeUtils.js';

export const UNDO_SECONDS = 10;
export const WEIGHT_PAGE_SIZE = 10;

/** Reports Trend tab — custom calendar range (start/end from the date picker). */
export const WEIGHT_TREND_RANGE_CUSTOM = 'custom';
export const WEIGHT_TREND_DEFAULT_DAYS = 5;
export const REPORTS_WEIGHT_TREND_RANGES = Object.freeze([
  Object.freeze({ key: 5, label: '5 days', days: 5 }),
  Object.freeze({ key: 10, label: '10 days', days: 10 }),
  Object.freeze({ key: 30, label: '1 month', days: 30 }),
  Object.freeze({ key: 365, label: '1 year', days: 365 }),
  Object.freeze({
    key: WEIGHT_TREND_RANGE_CUSTOM,
    label: 'Custom date',
    days: WEIGHT_TREND_RANGE_CUSTOM,
  }),
]);

export const toDateKey = (value) => {
  if (value instanceof Date) return formatCalendarPickerDate(value);
  return timestampToBusinessYmd(value) || formatCalendarPickerDate(new Date(value));
};

export const isSmallChartDevice = () =>
  typeof window !== 'undefined' && window.innerWidth < 380;

/** Map a diary timeline row (`kind: weight`) to a weight-history entry shape. */
export function weightEntryFromDiaryRow(diaryEntry) {
  const p = diaryEntry?.payload || {};
  if (p.id == null || p.id === '') return null;
  return {
    ID: p.id,
    Weight: p.weight,
    Bmi: p.bmi,
    BodyFat: p.bodyFat,
    MuscleMass: p.muscleMass,
    Bmr: p.bmr,
    WeightImageBase64: p.imageBase64 ?? null,
    CreatedAt: diaryEntry.capturedAt ?? null,
  };
}

/**
 * Filter weight entries to a single calendar day (matches the day the
 * entry is displayed under, i.e. its IST-local date). Returns the full
 * list when `selectedDate` is falsy. Pure — no IO.
 */
export function filterHistoryByDay(weightHistory, selectedDate, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (!selectedDate) return weightHistory || [];
  const target = dateToBusinessYmd(selectedDate, timezoneIana);
  return (weightHistory || []).filter((entry) => {
    if (!entry?.CreatedAt) return false;
    return timestampToBusinessYmd(entry.CreatedAt, timezoneIana) === target;
  });
}

export function buildMonthlyGroups(weightHistory) {
  const grouped = {};
  weightHistory.forEach((entry) => {
    if (!entry || !entry.CreatedAt || !entry.Weight) return;
    const date = parseUtcTimestamp(entry.CreatedAt);
    if (!date) return;
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' });
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        monthKey, monthName, entries: [],
        sortDate: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
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
    .sort((a, b) => compareUtcTimestampsDesc(a.CreatedAt, b.CreatedAt));
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
      createdAt: parseUtcTimestamp(entry.CreatedAt),
      weight: Number.parseFloat(entry.Weight),
    }))
    .filter((entry) => entry.createdAt && !Number.isNaN(entry.createdAt.getTime()) && Number.isFinite(entry.weight))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (sorted.length === 0) return [];

  const latestByDate = new Map();
  sorted.forEach((entry) => { latestByDate.set(toDateKey(entry.createdAt), entry.weight); });

  const endYmd = todayBusinessDate(DEFAULT_BUSINESS_TIMEZONE);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const end = new Date(ey, em - 1, ed);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - (weightTrendRangeDays - 1));

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

function formatTrendTooltipDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).replace(',', '');
}

function dayLabelFromKey(key) {
  return String(Number(key.split('-')[2]));
}

function monthKeyFromYmd(key) {
  return key.slice(0, 7);
}

function defaultWeightValueOf(entry) {
  return Number.parseFloat(entry?.Weight);
}

function collectRecordedMetricEntries(history, valueOf = defaultWeightValueOf) {
  return (history || [])
    .filter((entry) => entry && !entry.isUndoPlaceholder && entry.CreatedAt)
    .map((entry) => ({
      createdAt: parseUtcTimestamp(entry.CreatedAt),
      value: Number.parseFloat(valueOf(entry)),
    }))
    .filter((entry) => (
      entry.createdAt
      && !Number.isNaN(entry.createdAt.getTime())
      && Number.isFinite(entry.value)
    ))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function collectRecordedWeightEntries(weightHistory) {
  return collectRecordedMetricEntries(weightHistory);
}

function uniqueLatestByDate(sorted) {
  const latestByDate = new Map();
  sorted.forEach((entry) => { latestByDate.set(toDateKey(entry.createdAt), entry); });
  return Array.from(latestByDate.values())
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function customRangeKeys(customRange) {
  if (!customRange?.startDate || !customRange?.endDate) return null;
  const startKey = formatCalendarPickerDate(customRange.startDate)
    || dateToBusinessYmd(customRange.startDate);
  const endKey = formatCalendarPickerDate(customRange.endDate)
    || dateToBusinessYmd(customRange.endDate);
  if (!startKey || !endKey) return null;
  return startKey <= endKey
    ? { startKey, endKey }
    : { startKey: endKey, endKey: startKey };
}

function ymdToLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Inclusive calendar bounds for a Reports trend range (used for date-proportional chart x).
 */
export function getTrendRangeBounds(rangeDays, customRange = null) {
  if (rangeDays === WEIGHT_TREND_RANGE_CUSTOM) {
    const keys = customRangeKeys(customRange);
    if (!keys) return null;
    return {
      start: ymdToLocalDate(keys.startKey),
      end: ymdToLocalDate(keys.endKey),
    };
  }
  if (!Number.isFinite(rangeDays) || rangeDays <= 0) return null;
  const endYmd = todayBusinessDate(DEFAULT_BUSINESS_TIMEZONE);
  const end = ymdToLocalDate(endYmd);
  const start = new Date(end);
  start.setDate(end.getDate() - (rangeDays - 1));
  return { start, end };
}

/**
 * X-axis bounds from first → last recorded point (no empty lead-in before first log).
 */
export function getRecordedSeriesAxisBounds(series) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const firstKey = series[0]?.key;
  const lastKey = series[series.length - 1]?.key;
  if (!firstKey || !lastKey) return null;
  return {
    start: ymdToLocalDate(firstKey),
    end: ymdToLocalDate(lastKey),
  };
}

/**
 * First finite metric value ever logged and the latest (current) value.
 * Uses chronological entries, not the selected chart range.
 */
export function getFirstAndLatestRecordedValue(history, valueOf = defaultWeightValueOf) {
  const sorted = collectRecordedMetricEntries(history, valueOf);
  if (sorted.length === 0) return { firstValue: null, latestValue: null };
  return {
    firstValue: sorted[0].value,
    latestValue: sorted[sorted.length - 1].value,
  };
}

/**
 * First weight ever logged in the app and the latest (current) weight.
 * Uses chronological entries, not the selected chart range.
 */
export function getFirstAndLatestRecordedWeight(weightHistory) {
  const { firstValue, latestValue } = getFirstAndLatestRecordedValue(weightHistory);
  return { firstWeight: firstValue, latestWeight: latestValue };
}

/**
 * Actual recorded points (no calendar fill). Used by Reports Trend.
 * Numeric ranges clip to the last N days ending today. Custom uses the
 * picker start/end (inclusive, business calendar).
 * `options.getValue(entry)` selects the numeric field; defaults to Weight.
 */
export function buildRecordedTrendSeries(
  weightHistory,
  rangeDays = WEIGHT_TREND_DEFAULT_DAYS,
  customRange = null,
  options = {},
) {
  const getValue = typeof options.getValue === 'function' ? options.getValue : defaultWeightValueOf;
  const sorted = collectRecordedMetricEntries(weightHistory, getValue);
  if (sorted.length === 0) return [];

  const unique = uniqueLatestByDate(sorted);

  let inRange = unique;
  if (rangeDays === WEIGHT_TREND_RANGE_CUSTOM) {
    const keys = customRangeKeys(customRange);
    if (!keys) return [];
    inRange = unique.filter((entry) => {
      const key = toDateKey(entry.createdAt);
      return key >= keys.startKey && key <= keys.endKey;
    });
  } else if (Number.isFinite(rangeDays) && rangeDays > 0) {
    const endYmd = todayBusinessDate(DEFAULT_BUSINESS_TIMEZONE);
    const [ey, em, ed] = endYmd.split('-').map(Number);
    const end = new Date(ey, em - 1, ed);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - (rangeDays - 1));
    const startKey = toDateKey(start);
    inRange = unique.filter((entry) => toDateKey(entry.createdAt) >= startKey);
  }

  const monthKeys = new Set(inRange.map((entry) => monthKeyFromYmd(toDateKey(entry.createdAt))));
  const sameMonth = monthKeys.size <= 1;

  return inRange.map((entry) => {
    const date = entry.createdAt;
    const key = toDateKey(date);
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      key,
      date,
      label,
      compactLabel: sameMonth ? dayLabelFromKey(key) : label,
      tooltipDate: formatTrendTooltipDate(date),
      hasRecorded: true,
      value: entry.value,
    };
  });
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
