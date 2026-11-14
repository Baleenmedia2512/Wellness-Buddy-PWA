/**
 * Community Position dropdown after coach OTP.
 * Run: node --test frontend/src/features/user/domain/communityPosition.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  communityPositionDraftAfterSync,
  communityPositionFromProfile,
  rememberConfirmedCommunityPosition,
} from './communityPosition.js';

describe('communityPositionDraftAfterSync', () => {
  it('keeps the role just confirmed when Profile still has the old value', () => {
    const next = communityPositionDraftAfterSync({
      settledCode: 'WT',
      confirmedCode: '',
      pendingRequest: { status: 'pending', positionCode: 'WT' },
    });
    assert.equal(next.draft, 'WT');
    assert.equal(next.pending, null);
    assert.equal(next.clearSettled, false);
  });

  it('drops the local hold once Profile returns that role with no approval left', () => {
    const next = communityPositionDraftAfterSync({
      settledCode: 'WT',
      confirmedCode: 'WT',
      pendingRequest: null,
    });
    assert.equal(next.draft, 'WT');
    assert.equal(next.clearSettled, true);
  });

  it('keeps the role just confirmed when Profile still has the previous role', () => {
    const next = communityPositionDraftAfterSync({
      settledCode: 'SV',
      confirmedCode: 'PC',
      pendingRequest: null,
    });
    assert.equal(next.draft, 'SV');
    assert.equal(next.clearSettled, false);
  });

  it('follows a pending approval before any code has been confirmed', () => {
    const pending = { status: 'pending', positionCode: 'SV' };
    const next = communityPositionDraftAfterSync({
      settledCode: '',
      confirmedCode: 'PC',
      pendingRequest: pending,
    });
    assert.equal(next.draft, 'SV');
    assert.equal(next.pending, pending);
  });
});

describe('communityPositionFromProfile', () => {
  const memory = () => {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
    };
  };

  it('keeps SV when Profile still returns the previous role PC', () => {
    const storage = memory();
    rememberConfirmedCommunityPosition(17, 'SV', storage);
    assert.equal(
      communityPositionFromProfile({ eventLevel: 'PC' }, 17, storage),
      'SV',
    );
  });

  it('accepts SV once Profile returns that role', () => {
    const storage = memory();
    rememberConfirmedCommunityPosition(17, 'SV', storage);
    assert.equal(
      communityPositionFromProfile({ eventLevel: 'SV' }, 17, storage),
      'SV',
    );
    assert.equal(
      communityPositionFromProfile({ eventLevel: 'WT' }, 17, storage),
      'WT',
    );
  });
});
