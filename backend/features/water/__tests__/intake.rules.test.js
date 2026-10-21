/**
 * intake.rules.test.js
 * Run: node --test backend/features/water/__tests__/intake.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDailyIntake } from '../domain/intake.rules.js';

function row(analysis, createdAt = '2026-10-21T12:00:00.000Z') {
  return { CreatedAt: createdAt, AnalysisData: analysis };
}

function intake(foodRows) {
  return computeDailyIntake({
    userId: 7,
    date: '2026-10-21',
    latestWeightKg: 60,
    foodRows,
  });
}

describe('computeDailyIntake Turbo Drink water', () => {
  it('counts a plain water log and ignores water mixed into a meal', () => {
    const waterOnly = intake([
      row({ foods: [{ name: 'Plain Water', volume_ml: 250 }] }),
    ]);
    assert.equal(waterOnly.totalMl, 250);

    const riceAndWater = intake([
      row({
        foods: [
          { name: 'Rice', weight_g: 200 },
          { name: 'Plain Water', volume_ml: 250 },
        ],
      }),
    ]);
    assert.equal(riceAndWater.totalMl, 0);
  });

  it('adds 1 L when Turbo Drink is logged alone', () => {
    const result = intake([
      row({
        mealKind: 'dry-salad',
        foods: [{ name: 'Turbo Drink', volume_ml: 1000, calories: 123 }],
      }),
    ]);
    assert.equal(result.totalMl, 1000);
    assert.equal(result.logCount, 1);
  });

  it('adds 1 L when Turbo Drink is saved with other Target Nutrition items', () => {
    const result = intake([
      row({
        mealKind: 'dry-salad',
        foods: [
          { name: 'Turbo Drink', volume_ml: 1000 },
          { name: 'Joint Support (Bone & Joint Health)', weight_g: 1 },
        ],
      }),
    ]);
    assert.equal(result.totalMl, 1000);
    assert.equal(result.logs[0].items[0].name, 'Turbo Drink');
  });

  it('does not count the same Turbo Drink twice', () => {
    const result = intake([
      row({ foods: [{ name: 'Turbo Drink' }] }),
      row({
        foods: [
          { name: 'Turbo Drink', volume_ml: 1000 },
          { name: 'Personalized Protein Powder', weight_g: 12 },
        ],
      }),
    ]);
    assert.equal(result.totalMl, 2000);
    assert.equal(result.logCount, 2);
  });

  it('keeps an earlier water log and adds Turbo Drink on top', () => {
    const result = intake([
      row({ foods: [{ name: 'Plain Water', volume_ml: 300 }] }, '2026-10-21T08:00:00.000Z'),
      row({
        mealKind: 'dry-salad',
        foods: [{ name: 'Herbalife Turbo Drink', volume_ml: 1000 }],
      }),
    ]);
    assert.equal(result.totalMl, 1300);
  });
});
