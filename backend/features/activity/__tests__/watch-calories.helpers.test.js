/**
 * Run: node --test backend/features/activity/__tests__/watch-calories.helpers.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterWatchCalorieRowsForDate,
  groupWatchCaloriesByDate,
  maxStepCaloriesFromRows,
  maxWatchCaloriesFromRows,
  parseWatchKcalFromTopic,
  resolveDailyExerciseCalories,
} from '../domain/watch-calories.helpers.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

describe('parseWatchKcalFromTopic', () => {
  it('parses standard topic', () => {
    assert.equal(parseWatchKcalFromTopic('Calories Burned: 300 kcal'), 300);
  });

  it('returns 0 for non-matching topic', () => {
    assert.equal(parseWatchKcalFromTopic('Education Meeting'), 0);
  });
});

describe('maxWatchCaloriesFromRows', () => {
  it('returns highest kcal when multiple uploads same day', () => {
    const rows = [
      { Topic: 'Calories Burned: 150 kcal' },
      { Topic: 'Calories Burned: 300 kcal' },
    ];
    assert.equal(maxWatchCaloriesFromRows(rows), 300);
  });

  it('returns 0 for empty rows', () => {
    assert.equal(maxWatchCaloriesFromRows([]), 0);
  });
});

describe('resolveDailyExerciseCalories', () => {
  it('uses highest watch kcal when two smartwatch uploads same day', () => {
    const watchRows = [
      { Topic: 'Calories Burned: 150 kcal' },
      { Topic: 'Calories Burned: 300 kcal' },
    ];
    assert.equal(resolveDailyExerciseCalories([], watchRows), 300);
  });

  it('uses highest step row, not sum, when multiple step syncs exist', () => {
    const stepRows = [
      { Steps: 1000, CaloriesBurned: 150 },
      { Steps: 2000, CaloriesBurned: 300 },
    ];
    assert.equal(resolveDailyExerciseCalories(stepRows, []), 300);
  });

  it('adds step max and watch max from different sources', () => {
    const stepRows = [{ Steps: 5000, CaloriesBurned: 200 }];
    const watchRows = [{ Topic: 'Calories Burned: 300 kcal' }];
    assert.equal(resolveDailyExerciseCalories(stepRows, watchRows), 500);
  });
});

describe('filterWatchCalorieRowsForDate', () => {
  it('keeps rows whose legacy wall-clock CreatedAt maps to target date', () => {
    const rows = [
      { Topic: 'Calories Burned: 200 kcal', CreatedAt: '2026-07-23 14:30:00.000' },
      { Topic: 'Calories Burned: 100 kcal', CreatedAt: '2026-07-22 23:50:00.000' },
    ];
    const filtered = filterWatchCalorieRowsForDate(rows, '2026-07-23', IANA_IST);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].Topic, 'Calories Burned: 200 kcal');
  });
});

describe('groupWatchCaloriesByDate', () => {
  it('takes max kcal per day across the range', () => {
    const rows = [
      { Topic: 'Calories Burned: 150 kcal', CreatedAt: '2026-07-23 10:00:00.000' },
      { Topic: 'Calories Burned: 300 kcal', CreatedAt: '2026-07-23 18:00:00.000' },
      { Topic: 'Calories Burned: 100 kcal', CreatedAt: '2026-07-22 12:00:00.000' },
      { Topic: 'Calories Burned: 50 kcal', CreatedAt: '2026-07-21 12:00:00.000' },
    ];
    const byDate = groupWatchCaloriesByDate(rows, '2026-07-22', '2026-07-23', IANA_IST);
    assert.equal(byDate['2026-07-23'], 300);
    assert.equal(byDate['2026-07-22'], 100);
    assert.equal(byDate['2026-07-21'], undefined);
  });
});

describe('maxStepCaloriesFromRows', () => {
  it('ignores empty step rows', () => {
    assert.equal(maxStepCaloriesFromRows([{ Steps: 0, CaloriesBurned: 0 }]), 0);
  });
});
