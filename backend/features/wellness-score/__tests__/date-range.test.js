/**
 * Unit tests for wellness score IST date range helpers.
 * Run: node --test backend/features/wellness-score/__tests__/date-range.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysYmd,
  enumerateScoreDates,
  isValidScoreDate,
} from '../domain/date-range.js';

describe('date-range', () => {
  it('validates YYYY-MM-DD', () => {
    assert.equal(isValidScoreDate('2026-07-15'), true);
    assert.equal(isValidScoreDate('07-15-2026'), false);
  });

  it('addDaysYmd shifts calendar dates', () => {
    assert.equal(addDaysYmd('2026-07-15', -1), '2026-07-14');
    assert.equal(addDaysYmd('2026-07-15', -6), '2026-07-09');
  });

  it('enumerateScoreDates returns inclusive range', () => {
    const dates = enumerateScoreDates('2026-07-13', '2026-07-15');
    assert.deepEqual(dates, ['2026-07-13', '2026-07-14', '2026-07-15']);
  });

  it('rejects inverted ranges', () => {
    assert.throws(() => enumerateScoreDates('2026-07-16', '2026-07-15'));
  });

  it('allows up to ~6 months (186 days)', () => {
    const dates = enumerateScoreDates('2026-02-17', '2026-08-21');
    assert.equal(dates.length, 186);
    assert.equal(dates[0], '2026-02-17');
    assert.equal(dates[dates.length - 1], '2026-08-21');
  });

  it('rejects ranges longer than 6 months', () => {
    assert.throws(
      () => enumerateScoreDates('2026-02-16', '2026-08-21'),
      /cannot exceed 186 days/,
    );
  });
});
