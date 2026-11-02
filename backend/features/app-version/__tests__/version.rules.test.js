/**
 * Run: node --test backend/features/app-version/__tests__/version.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareSemver,
  evaluateVersionGate,
  resolveEffectiveMinVersion,
} from '../domain/version.rules.js';

describe('compareSemver', () => {
  it('orders semver tuples', () => {
    assert.equal(compareSemver('3.4.3', '3.4.2'), 1);
    assert.equal(compareSemver('3.4.0', '3.4.3'), -1);
    assert.equal(compareSemver('3.4.3', '3.4.3'), 0);
  });
});

describe('resolveEffectiveMinVersion', () => {
  it('uses grace min before grace end', () => {
    const min = resolveEffectiveMinVersion({
      minRequiredVersion: '3.4.0',
      graceMinVersion: '3.3.0',
      graceUntil: '2099-01-01T00:00:00Z',
      now: new Date('2026-01-01T00:00:00Z'),
    });
    assert.equal(min, '3.3.0');
  });

  it('uses min required after grace end', () => {
    const min = resolveEffectiveMinVersion({
      minRequiredVersion: '3.4.0',
      graceMinVersion: '3.3.0',
      graceUntil: '2026-01-01T00:00:00Z',
      now: new Date('2026-02-01T00:00:00Z'),
    });
    assert.equal(min, '3.4.0');
  });
});

describe('evaluateVersionGate', () => {
  it('requires update below effective min', () => {
    assert.equal(
      evaluateVersionGate({
        clientVersion: '3.2.0',
        latestVersion: '3.4.3',
        recommendedVersion: '3.4.3',
        minRequiredVersion: '3.4.0',
      }),
      'update_required',
    );
  });

  it('recommends update when below recommended but above min', () => {
    assert.equal(
      evaluateVersionGate({
        clientVersion: '3.4.1',
        latestVersion: '3.4.3',
        recommendedVersion: '3.4.3',
        minRequiredVersion: '3.4.0',
      }),
      'update_recommended',
    );
  });

  it('ok on latest', () => {
    assert.equal(
      evaluateVersionGate({
        clientVersion: '3.4.3',
        latestVersion: '3.4.3',
        recommendedVersion: '3.4.3',
        minRequiredVersion: '3.4.0',
      }),
      'ok',
    );
  });
});
