/**
 * Run: node --test frontend/src/features/activity/utils/__tests__/activityReportWeightDelta.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enrichActivityReportWeightDeltas } from '../activityReportWeightDelta.js';

describe('enrichActivityReportWeightDeltas', () => {
  it('infers previousWeight from earlier same-user rows when API omits it', () => {
    const rows = enrichActivityReportWeightDeltas([
      { userId: 1, weight: 20, date: '2026-11-18', time: '17:34:17' },
      { userId: 1, weight: 67.69, date: '2026-11-16', time: '19:41:46' },
      { userId: 1, weight: 67.69, date: '2026-11-15', time: '22:38:27' },
      { userId: 1, weight: 67.54, date: '2026-11-14', time: '10:00:00' },
      { userId: 1, weight: 67, date: '2026-11-05', time: '08:00:00' },
    ]);
    assert.equal(rows[0].previousWeight, 67.69); // Nov 18 vs Nov 16
    assert.equal(rows[1].previousWeight, 67.69); // Nov 16 vs Nov 15
    assert.equal(rows[2].previousWeight, 67.54); // Nov 15 vs Nov 14
    assert.equal(rows[3].previousWeight, 67); // Nov 14 vs Nov 05
    assert.equal(rows[4].previousWeight, null); // oldest on page
  });

  it('keeps finite API previousWeight', () => {
    const rows = enrichActivityReportWeightDeltas([
      { userId: 1, weight: 70, date: '2026-11-18', time: '08:00:00', previousWeight: 72 },
      { userId: 1, weight: 72, date: '2026-11-17', time: '08:00:00', previousWeight: 71 },
    ]);
    assert.equal(rows[0].previousWeight, 72);
    assert.equal(rows[1].previousWeight, 71);
  });
});
