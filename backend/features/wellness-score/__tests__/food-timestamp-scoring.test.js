/**
 * Regression: yesterday dinner must not earn today's dinner_post / nutrition.
 * Run: node --test backend/features/wellness-score/__tests__/food-timestamp-scoring.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';
import { filterFoodRowsByCalendarDay } from '../../../shared/lib/datetime/foodTimestamp.js';
import {
  calculateDinnerPost,
  calculateBreakfastPost,
  aggregateDailyFoodStats,
} from '../domain/score.rules.js';
import { filterFoodByMealWindow, isOnTime } from '../domain/window.helpers.js';

const DINNER_WIN = { start: '17:30:00', end: '20:30:00' };
const BREAKFAST_WIN = { start: '05:30:00', end: '08:30:00' };

describe('Wellness Score food timestamp — dinner leak regression', () => {
  it('A: naive IST wall dinner earns points on 2026-07-24 only', () => {
    const row = {
      CreatedAt: '2026-07-24 19:45:00',
      AnalysisData: { foods: [{ name: 'Dinner' }] },
      TotalCalories: 600,
    };
    const jul24 = filterFoodRowsByCalendarDay([row], '2026-07-24', IANA_IST);
    const jul25 = filterFoodRowsByCalendarDay([row], '2026-07-25', IANA_IST);
    assert.equal(jul24.length, 1);
    assert.equal(jul25.length, 0);

    const score24 = calculateDinnerPost({
      maxPoints: 100,
      foodRecords: jul24,
      window: DINNER_WIN,
      timezoneIana: IANA_IST,
    });
    const score25 = calculateDinnerPost({
      maxPoints: 100,
      foodRecords: jul25,
      window: DINNER_WIN,
      timezoneIana: IANA_IST,
    });
    assert.equal(score24.earnedPoints, 100);
    assert.equal(score25.earnedPoints, 0);
  });

  it('B: true UTC dinner (14:15Z) is on-time dinner on 2026-07-24', () => {
    const row = {
      CreatedAt: '2026-07-24T14:15:00.000Z',
      AnalysisData: { foods: [{ name: 'Dinner' }] },
    };
    assert.equal(
      filterFoodRowsByCalendarDay([row], '2026-07-24', IANA_IST).length,
      1,
    );
    assert.ok(isOnTime(row.CreatedAt, DINNER_WIN, IANA_IST, 'food'));
    const score = calculateDinnerPost({
      maxPoints: 100,
      foodRecords: [row],
      window: DINNER_WIN,
      timezoneIana: IANA_IST,
    });
    assert.equal(score.earnedPoints, 100);
  });

  it('C: spurious Z dinner must NOT appear on 2026-07-25 or earn dinner_post', () => {
    const row = {
      CreatedAt: '2026-07-24T19:45:00.000Z',
      AnalysisData: { foods: [{ name: 'Dinner' }] },
      TotalCalories: 800,
      TotalProtein: 40,
    };

    const todayMeals = filterFoodRowsByCalendarDay([row], '2026-07-25', IANA_IST);
    assert.equal(todayMeals.length, 0, 'must not appear in today meals');

    const scoreToday = calculateDinnerPost({
      maxPoints: 100,
      foodRecords: todayMeals,
      window: DINNER_WIN,
      timezoneIana: IANA_IST,
    });
    assert.equal(scoreToday.earnedPoints, 0, 'must not earn dinner points on 2026-07-25');

    // Same instant is yesterday dinner when day-filtered correctly
    const yesterday = filterFoodRowsByCalendarDay([row], '2026-07-24', IANA_IST);
    assert.equal(yesterday.length, 1);
    const scoreYesterday = calculateDinnerPost({
      maxPoints: 100,
      foodRecords: yesterday,
      window: DINNER_WIN,
      timezoneIana: IANA_IST,
    });
    assert.equal(scoreYesterday.earnedPoints, 100);

    // Nutrition aggregates for "today" stay empty
    const statsToday = aggregateDailyFoodStats(todayMeals);
    assert.equal(statsToday.totalCalories, 0);
  });

  it('never awards meal windows from raw string digits when TZ-aware time differs', () => {
    // 01:15 IST next morning if wrongly treated as UTC — must not match dinner window
    // after canonical food normalize this is 19:45 IST on Jul 24, not Jul 25 01:15.
    const inWindow = filterFoodByMealWindow(
      [{ CreatedAt: '2026-07-24T19:45:00.000Z' }],
      DINNER_WIN,
      IANA_IST,
    );
    assert.equal(inWindow.length, 1);
    assert.ok(isOnTime('2026-07-24T19:45:00.000Z', DINNER_WIN, IANA_IST, 'food'));
    assert.equal(
      isOnTime('2026-07-24T19:45:00.000Z', BREAKFAST_WIN, IANA_IST, 'food'),
      false,
    );
  });
});
