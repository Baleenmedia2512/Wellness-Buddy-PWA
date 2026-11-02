/**
 * Run: node --test backend/features/app-version/__tests__/enforce-api.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateApiVersionEnforcement } from '../domain/enforce-api.rules.js';

describe('evaluateApiVersionEnforcement', () => {
  it('allows when enforceApi is off', () => {
    const r = evaluateApiVersionEnforcement({
      enforceApi: false,
      clientVersion: null,
      minRequiredVersion: '3.4.0',
    });
    assert.equal(r.blocked, false);
  });

  it('blocks missing version when enforceApi is on', () => {
    const r = evaluateApiVersionEnforcement({
      enforceApi: true,
      clientVersion: null,
      minRequiredVersion: '3.4.0',
    });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, 'missing_version');
  });

  it('blocks client below min', () => {
    const r = evaluateApiVersionEnforcement({
      enforceApi: true,
      clientVersion: '3.3.9',
      minRequiredVersion: '3.4.0',
    });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, 'below_min');
  });

  it('allows client at or above min', () => {
    const ok = evaluateApiVersionEnforcement({
      enforceApi: true,
      clientVersion: '3.4.0',
      minRequiredVersion: '3.4.0',
    });
    assert.equal(ok.blocked, false);
    const newer = evaluateApiVersionEnforcement({
      enforceApi: true,
      clientVersion: '3.4.3',
      minRequiredVersion: '3.4.0',
    });
    assert.equal(newer.blocked, false);
  });

  it('honours grace min while grace window is active', () => {
    const r = evaluateApiVersionEnforcement({
      enforceApi: true,
      clientVersion: '3.3.9',
      minRequiredVersion: '3.4.0',
      graceMinVersion: '3.3.0',
      graceUntil: '2099-01-01',
      now: new Date('2026-08-12'),
    });
    assert.equal(r.blocked, false);
    assert.equal(r.effectiveMinVersion, '3.3.0');
  });

  it('blocks by android version code when provided', () => {
    const r = evaluateApiVersionEnforcement({
      enforceApi: true,
      clientVersion: '3.4.3',
      minRequiredVersion: '3.4.0',
      minAndroidVersionCode: 62,
      clientVersionCode: 58,
    });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, 'below_android_code');
  });
});
