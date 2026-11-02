/**
 * Unit tests for profile BMI helper (BCM-compatible).
 * Run: node --test frontend/src/features/user/domain/bmi.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBmiFromHeightWeight } from './bmi.js';

describe('computeBmiFromHeightWeight', () => {
  it('matches BCM rounding', () => {
    assert.equal(computeBmiFromHeightWeight(172, 72), 24.3);
    assert.equal(computeBmiFromHeightWeight(175, 85), 27.8);
  });

  it('returns null for invalid inputs', () => {
    assert.equal(computeBmiFromHeightWeight(null, 70), null);
    assert.equal(computeBmiFromHeightWeight(170, 10), null);
  });
});
