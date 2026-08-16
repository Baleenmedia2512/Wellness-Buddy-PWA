/**
 * Run: node --test frontend/src/features/activity/domain/__tests__/watchKcalStepper.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WATCH_KCAL_MAX,
  WATCH_KCAL_STEP,
  parseKcal,
  clampKcal,
  watchKcalBounds,
  nextWatchKcal,
} from '../watchKcalStepper.js';

describe('parseKcal', () => {
  it('returns 0 for empty or invalid input', () => {
    assert.equal(parseKcal(''), 0);
    assert.equal(parseKcal(null), 0);
    assert.equal(parseKcal('abc'), 0);
  });

  it('parses positive calorie strings', () => {
    assert.equal(parseKcal('350'), 350);
    assert.equal(parseKcal('350 kcal'), 350);
  });
});

describe('clampKcal', () => {
  it('clamps to min and max', () => {
    assert.equal(clampKcal(10, 50, 200), 50);
    assert.equal(clampKcal(500, 50, 200), 200);
    assert.equal(clampKcal(80, 50, 200), 80);
  });
});

describe('watchKcalBounds', () => {
  it('uses today baseline as the floor', () => {
    assert.deepEqual(watchKcalBounds(200), {
      baseline: 200,
      min: 200,
      max: WATCH_KCAL_MAX,
    });
  });

  it('starts at 0 when nothing is logged today', () => {
    assert.deepEqual(watchKcalBounds(0), {
      baseline: 0,
      min: 0,
      max: WATCH_KCAL_MAX,
    });
  });
});

describe('nextWatchKcal', () => {
  it('increments by the step from 0', () => {
    assert.equal(nextWatchKcal(0, WATCH_KCAL_STEP, 0), 50);
  });

  it('does not go below today\'s logged total', () => {
    assert.equal(nextWatchKcal(200, -WATCH_KCAL_STEP, 200), 200);
  });

  it('caps at the max', () => {
    assert.equal(nextWatchKcal(9950, 100, 0), WATCH_KCAL_MAX);
  });

  it('applies quick-add on top of the current total', () => {
    assert.equal(nextWatchKcal(100, 250, 0), 350);
  });
});
