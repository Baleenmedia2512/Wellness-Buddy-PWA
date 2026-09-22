/**
 * Run: node --test backend/features/captures/__tests__/capture-image-storage.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  r2CapturesEnabled,
  persistCaptureImageKey,
  getStoredCaptureImageKey,
  CAPTURE_R2_BACKFILL_START_YMD,
  CAPTURE_R2_BACKFILL_END_YMD,
} from '../capture-image-storage.service.js';

const KEYS = [
  'FF_R2_CAPTURES',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];

describe('r2CapturesEnabled', () => {
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
    process.env.FF_R2_CAPTURES = 'false';
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'id';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    assert.equal(r2CapturesEnabled(), false);
  });

  it('is false when R2 env is missing', () => {
    process.env.FF_R2_CAPTURES = 'true';
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    assert.equal(r2CapturesEnabled(), false);
  });
});

describe('persistCaptureImageKey', () => {
  it('returns null for empty / non-image values without throwing', async () => {
    assert.equal(await persistCaptureImageKey(1, 9, null), null);
    assert.equal(await persistCaptureImageKey(1, 9, 'https://example.com/x.jpg'), null);
  });
});

describe('getStoredCaptureImageKey', () => {
  it('returns null when captureId is missing', async () => {
    assert.equal(await getStoredCaptureImageKey(null), null);
    assert.equal(await getStoredCaptureImageKey(''), null);
  });
});

describe('capture backfill window', () => {
  it('defaults to 30 Aug 2026 through 5 Sep 2026 IST', () => {
    assert.equal(CAPTURE_R2_BACKFILL_START_YMD, '2026-08-30');
    assert.equal(CAPTURE_R2_BACKFILL_END_YMD, '2026-09-05');
  });
});
