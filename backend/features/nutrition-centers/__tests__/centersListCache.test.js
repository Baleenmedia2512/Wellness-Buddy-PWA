/**
 * Run: node --test backend/features/nutrition-centers/__tests__/centersListCache.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getNutritionCentersListEpoch,
  invalidateNutritionCentersListCache,
} from '../centers.service.js';

describe('nutrition center list cache epoch', () => {
  it('bumps the epoch when a club is created, updated, or deleted', () => {
    const before = getNutritionCentersListEpoch();
    invalidateNutritionCentersListCache();
    assert.equal(getNutritionCentersListEpoch(), before + 1);
  });
});