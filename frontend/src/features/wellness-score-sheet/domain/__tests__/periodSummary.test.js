/**
 * Run: node --test frontend/src/features/wellness-score-sheet/domain/__tests__/periodSummary.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateWellnessPeriodDetails } from '../periodSummary.js';

describe('aggregateWellnessPeriodDetails', () => {
  it('sums totals and merges parameters by key across days', () => {
    const result = aggregateWellnessPeriodDetails([
      {
        totalEarned: 120,
        totalPossible: 200,
        goalMode: 'loss',
        parameters: [
          { key: 'weight_post', label: 'Weight Post', earnedPoints: 20, maxPoints: 50 },
          { key: 'protein', label: 'Protein', earnedPoints: 40, maxPoints: 100 },
        ],
      },
      {
        totalEarned: 180,
        totalPossible: 300,
        goalMode: 'loss',
        parameters: [
          { key: 'weight_post', label: 'Weight Post', earnedPoints: 50, maxPoints: 50 },
          { key: 'protein', label: 'Protein', earnedPoints: 80, maxPoints: 100 },
          { key: 'water_qty', label: 'Water Quantity', earnedPoints: 50, maxPoints: 150 },
        ],
      },
    ]);

    assert.equal(result.totalEarned, 300);
    assert.equal(result.totalPossible, 500);
    assert.equal(result.percentage, 60);
    assert.equal(result.dayCount, 2);
    assert.equal(result.goalMode, 'loss');
    assert.deepEqual(
      result.parameters.map((parameter) => ({
        key: parameter.key,
        earnedPoints: parameter.earnedPoints,
        maxPoints: parameter.maxPoints,
      })),
      [
        { key: 'weight_post', earnedPoints: 70, maxPoints: 100 },
        { key: 'protein', earnedPoints: 120, maxPoints: 200 },
        { key: 'water_qty', earnedPoints: 50, maxPoints: 150 },
      ],
    );
  });

  it('returns null for an empty period', () => {
    assert.equal(aggregateWellnessPeriodDetails([]), null);
  });
});
