/**
 * Run: node --test backend/shared/lib/r2/__tests__/activity-image-storage.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  r2ActivityImagesEnabled,
  persistWeightImageKey,
  persistEducationImageKey,
  persistGoodHabitImageKeys,
  ACTIVITY_R2_BACKFILL_START_YMD,
  ACTIVITY_R2_BACKFILL_END_YMD,
} from '../activity-image-storage.service.js';

const KEYS = [
  'FF_R2_ACTIVITY_IMAGES',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];

describe('r2ActivityImagesEnabled', () => {
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
    process.env.FF_R2_ACTIVITY_IMAGES = 'false';
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'id';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    assert.equal(r2ActivityImagesEnabled(), false);
  });

  it('is false when R2 env is missing', () => {
    process.env.FF_R2_ACTIVITY_IMAGES = 'true';
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    assert.equal(r2ActivityImagesEnabled(), false);
  });
});

describe('persist activity images', () => {
  it('returns null for empty / non-image values without throwing', async () => {
    assert.equal(await persistWeightImageKey(1, 9, null), null);
    assert.equal(await persistEducationImageKey(1, 9, 'https://example.com/x.jpg'), null);
    assert.equal(await persistGoodHabitImageKeys(1, 9, {}), null);
  });
});

describe('activity backfill window', () => {
  it('defaults to 30 Aug 2026 through 5 Sep 2026 IST', () => {
    assert.equal(ACTIVITY_R2_BACKFILL_START_YMD, '2026-08-30');
    assert.equal(ACTIVITY_R2_BACKFILL_END_YMD, '2026-09-05');
  });
});
