/**
 * Run: node --test backend/features/user/__tests__/avatar-storage.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { r2AvatarsEnabled, persistAvatarKey } from '../avatar-storage.service.js';

const KEYS = [
  'FF_R2_AVATARS',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];

describe('r2AvatarsEnabled', () => {
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
    process.env.FF_R2_AVATARS = 'false';
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'id';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    assert.equal(r2AvatarsEnabled(), false);
  });

  it('is false when R2 env is missing even if the flag is on', () => {
    process.env.FF_R2_AVATARS = 'true';
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    assert.equal(r2AvatarsEnabled(), false);
  });

  it('is true when flag and env are set', () => {
    process.env.FF_R2_AVATARS = 'true';
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'id';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    assert.equal(r2AvatarsEnabled(), true);
  });
});

describe('persistAvatarKey', () => {
  it('returns null for Google https URLs without throwing', async () => {
    const key = await persistAvatarKey(1, 'https://lh3.googleusercontent.com/a/x');
    assert.equal(key, null);
  });
});
