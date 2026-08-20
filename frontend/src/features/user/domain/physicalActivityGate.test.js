/**
 * Unit tests for the Physical Activity onboarding gate.
 * Run: node --test frontend/src/features/user/domain/physicalActivityGate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePhysicalActivityGate } from './physicalActivityGate.js';

describe('resolvePhysicalActivityGate', () => {
  it('hides when this session already confirmed a saved level', () => {
    assert.equal(
      resolvePhysicalActivityGate({
        confirmedThisSession: true,
        profile: { physicalActivityLevel: null },
        fetchFailed: true,
      }),
      'hide',
    );
  });

  it('keeps current screen when the profile fetch fails', () => {
    assert.equal(
      resolvePhysicalActivityGate({ fetchFailed: true }),
      'keep',
    );
  });

  it('shows when profile loaded with no activity level', () => {
    assert.equal(
      resolvePhysicalActivityGate({ profile: { physicalActivityLevel: null } }),
      'show',
    );
    assert.equal(
      resolvePhysicalActivityGate({ profile: { physicalActivityLevel: '' } }),
      'show',
    );
  });

  it('hides when profile already has an activity level', () => {
    assert.equal(
      resolvePhysicalActivityGate({
        profile: { physicalActivityLevel: 'sedentary' },
      }),
      'hide',
    );
  });

  it('hides when profile payload is missing (do not fail-closed)', () => {
    assert.equal(resolvePhysicalActivityGate({ profile: null }), 'hide');
  });
});
