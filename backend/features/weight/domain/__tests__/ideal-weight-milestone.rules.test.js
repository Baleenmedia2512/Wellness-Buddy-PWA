/**
 * Run: node --test backend/features/weight/domain/__tests__/ideal-weight-milestone.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeightInIdealRange,
  findFirstIdealReachedEntry,
  shouldAttemptIdealMilestoneOnSave,
  isSaveTheFirstIdealReach,
} from '../ideal-weight-milestone.rules.js';

describe('isWeightInIdealRange', () => {
  // 170 cm → idealMin ≈ 54.91, idealMax ≈ 66.47
  it('returns true inside BMI 19–23 for valid height', () => {
    assert.equal(isWeightInIdealRange(60, 170), true);
  });

  it('returns false above / below / missing height', () => {
    assert.equal(isWeightInIdealRange(80, 170), false);
    assert.equal(isWeightInIdealRange(40, 170), false);
    assert.equal(isWeightInIdealRange(60, null), false);
  });
});

describe('findFirstIdealReachedEntry', () => {
  it('returns earliest in-range row ascending', () => {
    const rows = [
      { ID: 1, Weight: 80, CreatedAt: '2024-01-01T00:00:00.000Z' },
      { ID: 2, Weight: 60, CreatedAt: '2024-02-01T00:00:00.000Z' },
      { ID: 3, Weight: 59, CreatedAt: '2024-03-01T00:00:00.000Z' },
    ];
    const first = findFirstIdealReachedEntry(rows, 170);
    assert.equal(first.id, 2);
    assert.equal(first.weight, 60);
  });

  it('returns null when never in range', () => {
    const rows = [{ ID: 1, Weight: 90, CreatedAt: '2024-01-01T00:00:00.000Z' }];
    assert.equal(findFirstIdealReachedEntry(rows, 170), null);
  });
});

describe('shouldAttemptIdealMilestoneOnSave', () => {
  it('only on new insert when not already reached', () => {
    assert.equal(shouldAttemptIdealMilestoneOnSave({ isNewInsert: true, alreadyReachedAt: null }), true);
    assert.equal(shouldAttemptIdealMilestoneOnSave({ isNewInsert: false, alreadyReachedAt: null }), false);
    assert.equal(
      shouldAttemptIdealMilestoneOnSave({ isNewInsert: true, alreadyReachedAt: '2024-01-01' }),
      false,
    );
  });
});

describe('isSaveTheFirstIdealReach', () => {
  it('matches by entry id', () => {
    assert.equal(
      isSaveTheFirstIdealReach({
        firstEntryId: 10,
        newEntryId: 10,
        firstCreatedAt: 'a',
        newEntryCreatedAt: 'b',
      }),
      true,
    );
    assert.equal(
      isSaveTheFirstIdealReach({
        firstEntryId: 10,
        newEntryId: 11,
        firstCreatedAt: 'a',
        newEntryCreatedAt: 'a',
      }),
      false,
    );
  });
});
