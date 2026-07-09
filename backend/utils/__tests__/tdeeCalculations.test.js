/**
 * Unit tests for TDEE calculations.
 * Run: node --test backend/utils/__tests__/tdeeCalculations.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePhysicalActivityCalories,
  computeTef,
  computeTdee,
  resolveCalorieTargetFromProfile,
  buildTdeeBreakdown,
} from '../tdeeCalculations.js';

describe('computeTdee', () => {
  it('applies PA + TEF on BMR for sedentary', () => {
    // BMR 2000, sedentary 0.20 → PA 400, TEF 140 → TDEE 2540
    assert.equal(computeTdee(2000, 'sedentary'), 2540);
    assert.equal(computePhysicalActivityCalories(2000, 'sedentary'), 400);
    assert.equal(computeTef(2000), 140);
  });

  it('applies multiplier for moderate activity', () => {
    // BMR 2000, moderate 0.50 → PA 1000, TEF 140 → TDEE 3140
    assert.equal(computeTdee(2000, 'moderate'), 3140);
  });

  it('returns null without valid activity level', () => {
    assert.equal(computeTdee(2000, null), null);
    assert.equal(computeTdee(2000, 'invalid'), null);
  });
});

describe('resolveCalorieTargetFromProfile', () => {
  it('returns TDEE when activity level is set', () => {
    assert.equal(
      resolveCalorieTargetFromProfile({ bmr: 2000, physicalActivityLevel: 'light_active' }),
      2740,
    );
  });

  it('falls back to BMR when activity level is missing', () => {
    assert.equal(resolveCalorieTargetFromProfile({ bmr: 2000, physicalActivityLevel: null }), 2000);
  });
});

describe('buildTdeeBreakdown', () => {
  it('returns component breakdown', () => {
    const breakdown = buildTdeeBreakdown({ bmr: 2000, physicalActivityLevel: 'sedentary' });
    assert.deepEqual(breakdown, {
      bmr: 2000,
      physicalActivityCalories: 400,
      tef: 140,
      tdee: 2540,
    });
  });
});
