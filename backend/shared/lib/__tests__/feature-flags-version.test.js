/**
 * Run: node --test backend/shared/lib/__tests__/feature-flags-version.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEnabled,
  isEnabledForAppVersion,
  getMinAppVersion,
  __resetRegistry,
  __registerFlag,
} from '../feature-flags.js';

const FLAG = 'ff.test-version-gate';
const ENV_KEY = 'FF_TEST_VERSION_GATE';
const ENV_MIN = 'FF_TEST_VERSION_GATE_MIN_APP_VERSION';

function registerOn(defaultEnabled, minAppVersion) {
  __registerFlag({
    name: FLAG,
    owner: '@test',
    createdAt: '2026-01-01',
    removeBy: '2099-01-01',
    description: 'test flag for version gating',
    defaultEnabled,
    ...(minAppVersion ? { minAppVersion } : {}),
  });
}

describe('isEnabledForAppVersion', () => {
  beforeEach(() => {
    __resetRegistry();
    delete process.env[ENV_KEY];
    delete process.env[ENV_MIN];
  });

  afterEach(() => {
    delete process.env[ENV_KEY];
    delete process.env[ENV_MIN];
  });

  it('returns false when flag is OFF', () => {
    registerOn(false, '3.4.3');
    assert.equal(isEnabled(FLAG), false);
    assert.equal(isEnabledForAppVersion(FLAG, '3.4.3'), false);
  });

  it('returns true when ON and no minAppVersion (legacy)', () => {
    registerOn(true);
    assert.equal(isEnabledForAppVersion(FLAG, '1.0.0'), true);
    assert.equal(isEnabledForAppVersion(FLAG, null), true);
  });

  it('returns false when ON + minAppVersion but client missing/invalid', () => {
    registerOn(true, '3.4.3');
    assert.equal(isEnabledForAppVersion(FLAG, null), false);
    assert.equal(isEnabledForAppVersion(FLAG, ''), false);
    assert.equal(isEnabledForAppVersion(FLAG, 'not-a-version'), false);
  });

  it('returns false when client is below minAppVersion', () => {
    registerOn(true, '3.4.3');
    assert.equal(isEnabledForAppVersion(FLAG, '3.4.2'), false);
    assert.equal(isEnabledForAppVersion(FLAG, '3.3.0'), false);
  });

  it('returns true when client meets minAppVersion', () => {
    registerOn(true, '3.4.3');
    assert.equal(isEnabledForAppVersion(FLAG, '3.4.3'), true);
    assert.equal(isEnabledForAppVersion(FLAG, '3.4.4'), true);
  });

  it('honours env min override FF_*_MIN_APP_VERSION', () => {
    registerOn(true, '3.4.0');
    process.env[ENV_MIN] = '3.5.0';
    assert.equal(getMinAppVersion(FLAG), '3.5.0');
    assert.equal(isEnabledForAppVersion(FLAG, '3.4.3'), false);
    assert.equal(isEnabledForAppVersion(FLAG, '3.5.0'), true);
  });

  it('returns false for unknown flag', () => {
    assert.equal(isEnabledForAppVersion('ff.does-not-exist', '3.4.3'), false);
  });
});
