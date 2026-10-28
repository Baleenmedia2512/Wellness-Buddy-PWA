/**
 * Run: node --test backend/shared/lib/milesweb/__tests__/storedImage.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStoredImageUrl, redirectUrlForImageKey } from '../storedImage.js';

const KEYS = [
  'MILESWEB_FTP_HOST',
  'MILESWEB_FTP_USER',
  'MILESWEB_FTP_PASSWORD',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'FF_R2_FOOD_IMAGES',
];

describe('resolveStoredImageUrl without MilesWeb FTP', () => {
  const prev = {};
  beforeEach(() => {
    KEYS.forEach((k) => { prev[k] = process.env[k]; });
    delete process.env.MILESWEB_FTP_HOST;
    delete process.env.MILESWEB_FTP_USER;
    delete process.env.MILESWEB_FTP_PASSWORD;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
  });
  afterEach(() => {
    KEYS.forEach((k) => {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    });
  });

  it('returns null so callers keep the existing base64 path', async () => {
    assert.equal(await resolveStoredImageUrl('avatars/1265/ab12.jpg'), null);
  });

  it('rejects keys outside the upload folders', async () => {
    assert.equal(await resolveStoredImageUrl('../etc/passwd'), null);
  });

  it('does not 302 when storage flags are on but no file backend is configured', async () => {
    process.env.FF_R2_FOOD_IMAGES = 'true';
    assert.equal(
      await redirectUrlForImageKey('food/1/2/ab.jpg', 'ff.r2-food-images'),
      null,
    );
  });
});
