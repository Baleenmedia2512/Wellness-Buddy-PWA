/**
 * Run: node --test frontend/src/features/reports/utils/__tests__/reportsTrendMetrics.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORTS_TREND_METRICS,
  bodyParamsCardToTrendEntry,
  firstToCurrentMetricLabel,
  formatTrendMetricValue,
  getReportsTrendMetric,
  mergeTrendHistory,
  readTrendMetricValue,
} from '../reportsTrendMetrics.js';

describe('REPORTS_TREND_METRICS', () => {
  it('covers the body-parameter fields shown on Trend', () => {
    assert.deepEqual(
      REPORTS_TREND_METRICS.map((m) => m.label),
      ['Weight', 'Fat %', 'V-Fat', 'BMR (kcal)', 'BMI', 'Body Age', 'Chest', 'Waist', 'Hip'],
    );
    assert.deepEqual(
      REPORTS_TREND_METRICS.map((m) => m.key),
      ['weight', 'fatPercent', 'visceralFat', 'bmr', 'bmi', 'bodyAge', 'chestCm', 'waistCm', 'hipCm'],
    );
  });
});

describe('formatTrendMetricValue', () => {
  it('formats each unit without mixing them', () => {
    assert.equal(formatTrendMetricValue(72.456, 'weight'), '72.46 kg');
    assert.equal(formatTrendMetricValue(22.44, 'fatPercent'), '22.4%');
    assert.equal(formatTrendMetricValue(8.2, 'visceralFat'), '8.2');
    assert.equal(formatTrendMetricValue(1752.4, 'bmr'), '1752 kcal');
    assert.equal(formatTrendMetricValue(21.66, 'bmi'), '21.7');
    assert.equal(formatTrendMetricValue(28.2, 'bodyAge'), '28 yrs');
    assert.equal(formatTrendMetricValue(92.44, 'chestCm'), '92.4 cm');
  });
});

describe('readTrendMetricValue', () => {
  it('skips null and non-numeric fields', () => {
    const row = { Weight: 80, BodyFat: null, Bmr: '1752', visceralFat: '' };
    assert.equal(readTrendMetricValue(row, 'weight'), 80);
    assert.equal(readTrendMetricValue(row, 'fatPercent'), null);
    assert.equal(readTrendMetricValue(row, 'bmr'), 1752);
    assert.equal(readTrendMetricValue(row, 'visceralFat'), null);
  });
});

describe('bodyParamsCardToTrendEntry', () => {
  it('maps card snapshots onto the trend history shape', () => {
    const entry = bodyParamsCardToTrendEntry({
      id: 9,
      recordedDate: '2026-08-01',
      weightKg: 80,
      fatPercent: 22,
      bmi: 23.1,
      bmr: 1600,
      visceralFat: 8,
      bodyAge: 30,
      chestCm: 94,
      waistCm: 82,
      hipCm: 96,
    });
    assert.equal(entry.ID, 'bpc-9');
    assert.equal(entry.CreatedAt, '2026-08-01');
    assert.equal(entry.BodyFat, 22);
    assert.equal(entry.visceralFat, 8);
    assert.equal(entry.waistCm, 82);
  });
});

describe('mergeTrendHistory', () => {
  it('keeps weigh-ins and card snapshots together', () => {
    const merged = mergeTrendHistory(
      [{ ID: 1, Weight: 80, CreatedAt: '2026-08-10T00:00:00.000Z' }],
      [{ id: 2, recordedDate: '2026-08-01', visceralFat: 9 }],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[1].visceralFat, 9);
  });
});

describe('firstToCurrentMetricLabel', () => {
  it('uses the metric unit on both ends', () => {
    assert.equal(
      firstToCurrentMetricLabel(80, 78.5, 'weight'),
      'First 80.00 kg → Current 78.50 kg',
    );
    assert.equal(
      firstToCurrentMetricLabel(null, 22, 'fatPercent'),
      'First Fat % → Current Fat %',
    );
  });
});

describe('getReportsTrendMetric', () => {
  it('falls back to weight for unknown keys', () => {
    assert.equal(getReportsTrendMetric('nope').key, 'weight');
  });
});
