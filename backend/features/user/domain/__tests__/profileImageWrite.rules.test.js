/**
 * Run: node --test backend/features/user/domain/__tests__/profileImageWrite.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_IMAGE_R2_ONLY_MIN_APP_VERSION,
  shouldSkipProfileImageBase64,
} from '../profileImageWrite.rules.js';

describe('shouldSkipProfileImageBase64', () => {
  it('keeps base64 writes when R2 avatars are off', () => {
    assert.equal(shouldSkipProfileImageBase64({
      r2Enabled: false,
      appVersion: '3.5.1',
    }), false);
  });

  it('keeps base64 writes for missing and older versions (legacy)', () => {
    assert.equal(shouldSkipProfileImageBase64({ r2Enabled: true, appVersion: null }), false);
    assert.equal(shouldSkipProfileImageBase64({ r2Enabled: true, appVersion: '' }), false);
    assert.equal(shouldSkipProfileImageBase64({ r2Enabled: true, appVersion: '3.5.0' }), false);
    assert.equal(shouldSkipProfileImageBase64({ r2Enabled: true, appVersion: 'not-a-version' }), false);
  });

  it('skips base64 writes for 3.5.1+ when R2 avatars are on', () => {
    assert.equal(shouldSkipProfileImageBase64({ r2Enabled: true, appVersion: '3.5.1' }), true);
    assert.equal(shouldSkipProfileImageBase64({ r2Enabled: true, appVersion: '3.6.0' }), true);
    assert.equal(PROFILE_IMAGE_R2_ONLY_MIN_APP_VERSION, '3.5.1');
  });
});
