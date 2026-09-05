/**
 * Run: node --test backend/features/food-corrections/__tests__/food-image-storage.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  r2FoodImagesEnabled,
  persistFoodImageKey,
  FOOD_R2_BACKFILL_START_YMD,
  FOOD_R2_BACKFILL_END_YMD,
} from '../food-image-storage.service.js';

const KEYS = [
  'FF_R2_FOOD_IMAGES',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];

describe('r2FoodImagesEnabled', () => {
  const prev = {};
  beforeEach(() => {
    KEYS.forEach((k) => { prev[k] = process.env[k]; });
  });
  afterEach(() => {
    KEYS.forEach((k) => {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    });
  });

  it('is false when the kill switch is off', () => {
    process.env.FF_R2_FOOD_IMAGES = 'false';
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'id';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    assert.equal(r2FoodImagesEnabled(), false);
  });

  it('is false when R2 env is missing', () => {
    process.env.FF_R2_FOOD_IMAGES = 'true';
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    assert.equal(r2FoodImagesEnabled(), false);
  });
});

describe('persistFoodImageKey', () => {
  it('returns null for empty / non-image values without throwing', async () => {
    assert.equal(await persistFoodImageKey(1, 9, null), null);
    assert.equal(await persistFoodImageKey(1, 9, 'https://example.com/x.jpg'), null);
  });
});

describe('food backfill window', () => {
  it('defaults to 30 Aug 2026 through 5 Sep 2026 IST', () => {
    assert.equal(FOOD_R2_BACKFILL_START_YMD, '2026-08-30');
    assert.equal(FOOD_R2_BACKFILL_END_YMD, '2026-09-05');
  });
});
