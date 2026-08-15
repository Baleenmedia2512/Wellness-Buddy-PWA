/**
 * Run: node --test frontend/src/features/weight/services/__tests__/weightDashboardFormatter.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORTS_WEIGHT_TREND_RANGES,
  WEIGHT_TREND_DEFAULT_DAYS,
  WEIGHT_TREND_RANGE_CUSTOM,
  buildRecordedTrendSeries,
  getFirstAndLatestRecordedWeight,
} from '../weightDashboardFormatter.js';
import {
  formatCalendarPickerDate,
  todayBusinessDate,
} from '../../../../shared/utils/datetimeUtils.js';

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return formatCalendarPickerDate(date);
}

function localDateFromYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function entry(id, weight, ymd) {
  return {
    ID: id,
    Weight: weight,
    CreatedAt: `${ymd}T12:00:00.000Z`,
  };
}

describe('REPORTS_WEIGHT_TREND_RANGES', () => {
  it('exposes 5 days, 10 days, 1 month, 1 year, and custom date', () => {
    assert.deepEqual(
      REPORTS_WEIGHT_TREND_RANGES.map((range) => range.label),
      ['5 days', '10 days', '1 month', '1 year', 'Custom date'],
    );
    assert.deepEqual(
      REPORTS_WEIGHT_TREND_RANGES.map((range) => range.days),
      [5, 10, 30, 365, WEIGHT_TREND_RANGE_CUSTOM],
    );
    assert.equal(WEIGHT_TREND_DEFAULT_DAYS, 5);
  });
});

describe('getFirstAndLatestRecordedWeight', () => {
  it('returns the first weight entered in the app and the current weight', () => {
    const history = [
      entry(3, 94.5, '2026-08-15'),
      entry(1, 90, '2026-08-01'),
      entry(2, 92, '2026-08-10'),
    ];
    assert.deepEqual(getFirstAndLatestRecordedWeight(history), {
      firstWeight: 90,
      latestWeight: 94.5,
    });
  });

  it('returns nulls when there are no valid records', () => {
    assert.deepEqual(getFirstAndLatestRecordedWeight([]), {
      firstWeight: null,
      latestWeight: null,
    });
  });
});

describe('buildRecordedTrendSeries', () => {
  const today = todayBusinessDate();
  const history = [
    entry(1, 90, addDaysYmd(today, -20)),
    entry(2, 91, addDaysYmd(today, -8)),
    entry(3, 92, addDaysYmd(today, -3)),
    entry(4, 93, today),
  ];

  it('clips to the last 5 days', () => {
    const series = buildRecordedTrendSeries(history, 5);
    assert.deepEqual(series.map((p) => p.value), [92, 93]);
  });

  it('clips to the last 10 days', () => {
    const series = buildRecordedTrendSeries(history, 10);
    assert.deepEqual(series.map((p) => p.value), [91, 92, 93]);
  });

  it('returns no points for custom until both dates are chosen', () => {
    assert.deepEqual(
      buildRecordedTrendSeries(history, WEIGHT_TREND_RANGE_CUSTOM, null),
      [],
    );
  });

  it('filters custom date range inclusively', () => {
    const start = localDateFromYmd(addDaysYmd(today, -8));
    const end = localDateFromYmd(addDaysYmd(today, -3));
    const series = buildRecordedTrendSeries(history, WEIGHT_TREND_RANGE_CUSTOM, {
      startDate: start,
      endDate: end,
    });
    assert.deepEqual(series.map((p) => p.value), [91, 92]);
  });
});
