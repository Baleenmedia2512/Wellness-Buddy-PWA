/**
 * Run: node --test frontend/src/features/reports/utils/__tests__/reportDateFilter.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATE_PRESETS,
  resolveReportScoreDate,
  yesterdayBusinessDate,
} from '../reportDateFilter.js';
import { todayBusinessDate } from '../../../../shared/utils/datetimeUtils.js';

describe('resolveReportScoreDate', () => {
  it('defaults to today', () => {
    const today = todayBusinessDate();
    assert.equal(resolveReportScoreDate(DATE_PRESETS.TODAY, null), today);
  });

  it('resolves yesterday', () => {
    assert.equal(
      resolveReportScoreDate(DATE_PRESETS.YESTERDAY, null),
      yesterdayBusinessDate(),
    );
  });

  it('resolves custom YYYY-MM-DD', () => {
    assert.equal(
      resolveReportScoreDate(DATE_PRESETS.CUSTOM, '2026-08-01'),
      '2026-08-01',
    );
  });
});
