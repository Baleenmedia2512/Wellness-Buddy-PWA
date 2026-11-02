/**
 * Run: node --test frontend/src/features/wellness-score-sheet/services/__tests__/wellnessScoreInflight.test.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeWellnessScoreInflight,
  wellnessScoreInflightKey,
  __resetWellnessScoreApiInFlightForTests,
} from '../wellnessScoreInflight.js';

describe('wellnessScoreInflight', () => {
  beforeEach(() => {
    __resetWellnessScoreApiInFlightForTests();
  });

  it('shares one run across concurrent callers with the same watermark', async () => {
    let runs = 0;
    const run = () => {
      runs += 1;
      return Promise.resolve('ok');
    };
    const key = wellnessScoreInflightKey('daily', ['339', '2026-08-13'], 0);
    const [a, b, c, d] = await Promise.all([
      dedupeWellnessScoreInflight(key, run),
      dedupeWellnessScoreInflight(key, run),
      dedupeWellnessScoreInflight(key, run),
      dedupeWellnessScoreInflight(key, run),
    ]);
    assert.equal(runs, 1);
    assert.deepEqual([a, b, c, d], ['ok', 'ok', 'ok', 'ok']);
  });

  it('starts a new run after a newer activity watermark', () => {
    let runs = 0;
    const run = () => {
      runs += 1;
      return new Promise(() => {});
    };
    const firstKey = wellnessScoreInflightKey('daily', ['339', '2026-08-13'], 0);
    dedupeWellnessScoreInflight(firstKey, run);
    const secondKey = wellnessScoreInflightKey('daily', ['339', '2026-08-13'], 1);
    dedupeWellnessScoreInflight(secondKey, run);
    assert.notEqual(firstKey, secondKey);
    assert.equal(runs, 2);
  });
});
