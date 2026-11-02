/**
 * Run: node --test backend/features/reports/__tests__/wellness-score-report.weight.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWeightsForScoreDate,
  computeWeightDifferenceKg,
  weightCreatedAtToYmd,
} from '../domain/wellness-score-report.weight.js';

describe('classifyWeightsForScoreDate — exact day', () => {
  const scoreDate = '2026-08-09';

  it('uses only the weight logged on the score date', () => {
    const result = classifyWeightsForScoreDate(
      [
        { UserId: 1, Weight: 71.2, CreatedAt: '2026-08-09 07:15:00' },
        { UserId: 1, Weight: 71.8, CreatedAt: '2026-08-08 07:10:00' },
      ],
      scoreDate,
    );
    assert.equal(result.todayWeight, 71.2);
    assert.equal(result.previousWeight, 71.8);
    assert.equal(computeWeightDifferenceKg(result.todayWeight, result.previousWeight), -0.6);
  });

  it('returns null todayWeight when selected day has no log (shows —)', () => {
    const result = classifyWeightsForScoreDate(
      [
        { UserId: 1, Weight: 72.0, CreatedAt: '2026-08-08 07:10:00' },
        { UserId: 1, Weight: 72.5, CreatedAt: '2026-08-07 07:05:00' },
      ],
      scoreDate,
    );
    assert.equal(result.todayWeight, null);
    assert.equal(result.previousWeight, null);
  });

  it('uses earlier same-day entry as previous when present', () => {
    const result = classifyWeightsForScoreDate(
      [
        { UserId: 1, Weight: 70.1, CreatedAt: '2026-08-09 18:00:00' },
        { UserId: 1, Weight: 70.4, CreatedAt: '2026-08-09 07:00:00' },
      ],
      scoreDate,
    );
    assert.equal(result.todayWeight, 70.1);
    assert.equal(result.previousWeight, 70.4);
  });

  it('falls back to latest two overall when no score date', () => {
    const result = classifyWeightsForScoreDate(
      [
        { UserId: 1, Weight: 80, CreatedAt: '2026-08-01 08:00:00' },
        { UserId: 1, Weight: 81, CreatedAt: '2026-07-30 08:00:00' },
      ],
      null,
    );
    assert.equal(result.todayWeight, 80);
    assert.equal(result.previousWeight, 81);
  });
});

describe('weightCreatedAtToYmd', () => {
  it('reads YYYY-MM-DD prefix from IST wall timestamps', () => {
    assert.equal(weightCreatedAtToYmd('2026-08-09 07:15:00'), '2026-08-09');
    assert.equal(weightCreatedAtToYmd('2026-08-09T07:15:00.000Z'), '2026-08-09');
    assert.equal(weightCreatedAtToYmd(null), null);
  });
});
