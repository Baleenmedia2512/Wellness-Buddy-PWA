/**
 * Run: node --test backend/features/weight/domain/__tests__/ideal-weight-milestone.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectIdealReachNotifyTargets,
  IDEAL_REACH_NOTIFY_MAX_LEVELS,
  isWeightInIdealRange,
  findFirstIdealReachedEntry,
  shouldAttemptIdealMilestoneOnSave,
  isSaveTheFirstIdealReach,
} from '../ideal-weight-milestone.rules.js';

describe('collectIdealReachNotifyTargets', () => {
  it('includes coach + cocoach for up to 3 levels, nearest first', () => {
    const targets = collectIdealReachNotifyTargets({
      ancestorCoachIds: [10, 20, 30, 40],
      partnerByCoachId: new Map([
        [10, 11],
        [20, 21],
        [30, 31],
        [40, 41],
      ]),
      memberUserId: 1,
    });
    assert.equal(IDEAL_REACH_NOTIFY_MAX_LEVELS, 3);
    assert.deepEqual(targets, [
      { userId: '10', role: 'coach', level: 1 },
      { userId: '11', role: 'cocoach', level: 1 },
      { userId: '20', role: 'coach', level: 2 },
      { userId: '21', role: 'cocoach', level: 2 },
      { userId: '30', role: 'coach', level: 3 },
      { userId: '31', role: 'cocoach', level: 3 },
    ]);
  });

  it('skips missing partners and dedupes repeated user ids', () => {
    const targets = collectIdealReachNotifyTargets({
      ancestorCoachIds: [10, 20],
      partnerByCoachId: { 10: 20, 20: null },
      memberUserId: 1,
    });
    assert.deepEqual(targets, [
      { userId: '10', role: 'coach', level: 1 },
      { userId: '20', role: 'cocoach', level: 1 },
    ]);
  });

  it('excludes the member when they appear in the chain', () => {
    const targets = collectIdealReachNotifyTargets({
      ancestorCoachIds: [1, 20],
      partnerByCoachId: new Map([[20, 21]]),
      memberUserId: 1,
    });
    assert.deepEqual(targets, [
      { userId: '20', role: 'coach', level: 2 },
      { userId: '21', role: 'cocoach', level: 2 },
    ]);
  });
});

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
