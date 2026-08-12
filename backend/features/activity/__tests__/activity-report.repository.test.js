/**
 * Run: node --test backend/features/activity/__tests__/activity-report.repository.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';
import { filterFoodRowsByCalendarDateRange } from '../../../shared/lib/datetime/foodTimestamp.js';
import {
  dedupeFirstLogPerMemberPerDay,
  filterFoodByMealTime,
  isReportBeverageRecord,
} from '../activity-report.repository.js';

const DINNER_WINDOWS = {
  breakfast: { start: '05:30:00', end: '08:30:00' },
  lunch: { start: '12:00:00', end: '16:00:00' },
  dinner: { start: '17:30:00', end: '20:30:00' },
};

describe('activity report food date filtering', () => {
  it('excludes yesterday dinner from today-only range at midnight', () => {
    const rows = [
      { UserID: '1', CreatedAt: '2026-07-30 19:30:00', AnalysisData: { items: [{ name: 'Rice' }] } },
      { UserID: '2', CreatedAt: '2026-07-31 07:15:00', AnalysisData: { items: [{ name: 'Idli' }] } },
    ];
    const todayOnly = filterFoodRowsByCalendarDateRange(rows, '2026-07-31', '2026-07-31', IANA_IST);
    assert.equal(todayOnly.length, 1);
    assert.equal(todayOnly[0].UserID, '2');
  });

  it('counts dinner only for logs within dinner window on the correct day', () => {
    const rows = [
      { UserID: '1', CreatedAt: '2026-07-30 19:30:00', AnalysisData: { items: [{ name: 'Rice' }] } },
      { UserID: '2', CreatedAt: '2026-07-31 07:15:00', AnalysisData: { items: [{ name: 'Idli' }] } },
    ];
    const jul30Food = filterFoodRowsByCalendarDateRange(rows, '2026-07-30', '2026-07-30', IANA_IST);
    const jul30Dinner = filterFoodByMealTime(jul30Food, 'dinner', DINNER_WINDOWS, IANA_IST);
    const jul31Food = filterFoodRowsByCalendarDateRange(rows, '2026-07-31', '2026-07-31', IANA_IST);
    const jul31Dinner = filterFoodByMealTime(jul31Food, 'dinner', DINNER_WINDOWS, IANA_IST);

    assert.equal(jul30Dinner.length, 1);
    assert.equal(jul31Dinner.length, 0);
  });

  it('dedupes meal logs by business calendar day, not raw timestamp prefix', () => {
    const rows = [
      { UserID: '1', CreatedAt: '2026-07-30 18:00:00' },
      { UserID: '1', CreatedAt: '2026-07-30 19:45:00' },
    ];
    const deduped = dedupeFirstLogPerMemberPerDay(rows, IANA_IST, { foodTimestamp: true });
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].CreatedAt, '2026-07-30 18:00:00');
  });
});

describe('isReportBeverageRecord', () => {
  it('treats water_preset / afresh_preset as beverages without AnalysisData', () => {
    assert.equal(isReportBeverageRecord({ ProcessedBy: 'water_preset' }), true);
    assert.equal(isReportBeverageRecord({ ProcessedBy: 'afresh_preset' }), true);
    assert.equal(isReportBeverageRecord({ ProcessedBy: null, AnalysisData: null }), false);
  });
});
