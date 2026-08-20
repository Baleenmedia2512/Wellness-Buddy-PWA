/**
 * Reports Trend metric catalog + history mapping.
 * Weight / Fat / BMI / BMR come from weight_records_table.
 * V-Fat / Body Age / Chest / Waist / Hip come from body_parameters_cards.
 */

export const REPORTS_TREND_DEFAULT_METRIC = 'weight';

export const REPORTS_TREND_METRICS = Object.freeze([
  Object.freeze({
    key: 'weight',
    label: 'Weight',
    hint: null,
    unit: 'kg',
    field: 'Weight',
    decimals: 2,
    noun: 'Weight Trend',
  }),
  Object.freeze({
    key: 'fatPercent',
    label: 'Fat %',
    hint: null,
    unit: '%',
    field: 'BodyFat',
    decimals: 1,
    noun: 'Fat % Trend',
  }),
  Object.freeze({
    key: 'visceralFat',
    label: 'V-Fat',
    hint: 'Visceral fat',
    unit: '',
    field: 'visceralFat',
    decimals: 1,
    noun: 'V-Fat Trend',
  }),
  Object.freeze({
    key: 'bmr',
    label: 'BMR (kcal)',
    hint: null,
    unit: 'kcal',
    field: 'Bmr',
    decimals: 0,
    noun: 'BMR Trend',
  }),
  Object.freeze({
    key: 'bmi',
    label: 'BMI',
    hint: null,
    unit: '',
    field: 'Bmi',
    decimals: 1,
    noun: 'BMI Trend',
  }),
  Object.freeze({
    key: 'bodyAge',
    label: 'Body Age',
    hint: null,
    unit: 'yrs',
    field: 'bodyAge',
    decimals: 0,
    noun: 'Body Age Trend',
  }),
  Object.freeze({
    key: 'chestCm',
    label: 'Chest',
    hint: null,
    unit: 'cm',
    field: 'chestCm',
    decimals: 1,
    noun: 'Chest Trend',
  }),
  Object.freeze({
    key: 'waistCm',
    label: 'Waist',
    hint: null,
    unit: 'cm',
    field: 'waistCm',
    decimals: 1,
    noun: 'Waist Trend',
  }),
  Object.freeze({
    key: 'hipCm',
    label: 'Hip',
    hint: null,
    unit: 'cm',
    field: 'hipCm',
    decimals: 1,
    noun: 'Hip Trend',
  }),
]);

const METRIC_BY_KEY = Object.fromEntries(
  REPORTS_TREND_METRICS.map((metric) => [metric.key, metric]),
);

export function getReportsTrendMetric(key) {
  return METRIC_BY_KEY[key] || METRIC_BY_KEY[REPORTS_TREND_DEFAULT_METRIC];
}

export function readTrendMetricValue(entry, metricKey) {
  const metric = getReportsTrendMetric(metricKey);
  const raw = entry?.[metric.field];
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function formatTrendMetricValue(value, metricKey) {
  const metric = getReportsTrendMetric(metricKey);
  if (!Number.isFinite(value)) return '';
  const number = value.toFixed(metric.decimals);
  if (!metric.unit) return number;
  if (metric.unit === '%') return `${number}%`;
  return `${number} ${metric.unit}`;
}

export function firstToCurrentMetricLabel(firstValue, latestValue, metricKey) {
  const metric = getReportsTrendMetric(metricKey);
  if (!Number.isFinite(firstValue) || !Number.isFinite(latestValue)) {
    return `First ${metric.label} → Current ${metric.label}`;
  }
  return `First ${formatTrendMetricValue(firstValue, metricKey)} → Current ${formatTrendMetricValue(latestValue, metricKey)}`;
}

export function bodyParamsCardToTrendEntry(card) {
  if (!card) return null;
  const createdAt = card.recordedDate || card.createdAt;
  if (!createdAt) return null;
  return {
    ID: `bpc-${card.id}`,
    CreatedAt: createdAt,
    Weight: card.weightKg ?? null,
    BodyFat: card.fatPercent ?? null,
    Bmi: card.bmi ?? null,
    Bmr: card.bmr ?? null,
    visceralFat: card.visceralFat ?? null,
    bodyAge: card.bodyAge ?? null,
    chestCm: card.chestCm ?? null,
    waistCm: card.waistCm ?? null,
    hipCm: card.hipCm ?? null,
  };
}

export function mergeTrendHistory(weightHistory, cardHistory) {
  const fromWeight = Array.isArray(weightHistory) ? weightHistory : [];
  const fromCards = (Array.isArray(cardHistory) ? cardHistory : [])
    .map(bodyParamsCardToTrendEntry)
    .filter(Boolean);
  return [...fromWeight, ...fromCards];
}
