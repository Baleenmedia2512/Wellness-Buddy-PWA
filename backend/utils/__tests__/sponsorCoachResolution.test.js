/**
 * Unit tests for Sponsor + Ideal-Weight Coach resolution (ADR-0007).
 * Run: node --test backend/utils/__tests__/sponsorCoachResolution.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeightInIdealRange,
  pickIdealCoachFromProfiles,
  pickLatestWeightKgByCreatedAt,
} from '../sponsorCoachResolution.js';

describe('isWeightInIdealRange', () => {
  // height 170 cm → heightM=1.7 → min=19*2.89=54.9, max=23*2.89=66.5
  it('returns true when weight is inside BMI 19–23', () => {
    assert.equal(isWeightInIdealRange(170, 60), true);
    assert.equal(isWeightInIdealRange(170, 54.9), true);
    assert.equal(isWeightInIdealRange(170, 66.5), true);
  });

  it('returns false when weight is outside range', () => {
    assert.equal(isWeightInIdealRange(170, 50), false);
    assert.equal(isWeightInIdealRange(170, 70), false);
  });

  it('returns false when height or weight missing/invalid', () => {
    assert.equal(isWeightInIdealRange(null, 60), false);
    assert.equal(isWeightInIdealRange(170, null), false);
    assert.equal(isWeightInIdealRange(10, 60), false);
    assert.equal(isWeightInIdealRange(170, 0), false);
  });
});

describe('pickLatestWeightKgByCreatedAt', () => {
  it('uses first row per user when rows are CreatedAt DESC (not max Weight)', () => {
    const map = pickLatestWeightKgByCreatedAt([
      { UserId: 'a', Weight: 60 }, // latest for a
      { UserId: 'a', Weight: 95 }, // older heavier — ignored
      { UserId: 'b', Weight: 70 },
    ]);
    assert.equal(map.get('a'), 60);
    assert.equal(map.get('b'), 70);
  });

  it('does not fall back to an older valid weight when latest is unusable', () => {
    const map = pickLatestWeightKgByCreatedAt([
      { UserId: 'a', Weight: null },
      { UserId: 'a', Weight: 62 },
    ]);
    assert.equal(map.get('a'), null);
  });
});

describe('pickIdealCoachFromProfiles', () => {
  it('returns empty when no ancestors', () => {
    assert.deepEqual(pickIdealCoachFromProfiles([]), {
      idealCoachId: null,
      idealCoachName: null,
    });
  });

  it('picks sponsor when sponsor is in ideal range', () => {
    const result = pickIdealCoachFromProfiles([
      { userId: 'adithya', userName: 'Adithya', heightCm: 170, weightKg: 60 },
      { userId: 'yasheer', userName: 'Yasheer', heightCm: 170, weightKg: 60 },
    ]);
    assert.deepEqual(result, {
      idealCoachId: 'adithya',
      idealCoachName: 'Adithya',
    });
  });

  it('walks up when sponsor is out of range (Kabilan example)', () => {
    const result = pickIdealCoachFromProfiles([
      { userId: 'adithya', userName: 'Adithya', heightCm: 170, weightKg: 80 },
      { userId: 'yasheer', userName: 'Yasheer', heightCm: 170, weightKg: 60 },
    ]);
    assert.deepEqual(result, {
      idealCoachId: 'yasheer',
      idealCoachName: 'Yasheer',
    });
  });

  it('skips ancestors missing height/weight and continues', () => {
    const result = pickIdealCoachFromProfiles([
      { userId: 'a', userName: 'A', heightCm: null, weightKg: null },
      { userId: 'b', userName: 'B', heightCm: 170, weightKg: null },
      { userId: 'c', userName: 'C', heightCm: 170, weightKg: 60 },
    ]);
    assert.deepEqual(result, {
      idealCoachId: 'c',
      idealCoachName: 'C',
    });
  });

  it('returns null ideal when nobody qualifies', () => {
    const result = pickIdealCoachFromProfiles([
      { userId: 'a', userName: 'A', heightCm: 170, weightKg: 90 },
      { userId: 'b', userName: 'B', heightCm: 170, weightKg: 40 },
    ]);
    assert.deepEqual(result, {
      idealCoachId: null,
      idealCoachName: null,
    });
  });
});
