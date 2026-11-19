import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  communityPositionFromProfile,
  readSavedCommunityPosition,
} from '../communityPosition.js';

describe('Header Community Position display rule', () => {
  function resolveHeaderCommunityPosition({ user, profileData, storage }) {
    const fromUser = user?.communityPosition?.code
      || (typeof user?.communityPosition === 'string' ? user.communityPosition : '')
      || user?.eventLevel
      || user?.EventLevel
      || '';
    if (fromUser) return String(fromUser).trim();

    const userId = user?.id || user?.UserId || user?.userId || null;
    const fromSaved = readSavedCommunityPosition(userId, storage);
    if (fromSaved) return fromSaved;

    if (profileData) {
      const pos = communityPositionFromProfile(profileData, userId, storage);
      const resolvedPos = pos
        || profileData.eventLevel
        || profileData.EventLevel
        || profileData.communityPosition?.code
        || (typeof profileData.communityPosition === 'string' ? profileData.communityPosition : '')
        || '';
      if (resolvedPos) return String(resolvedPos).trim();
    }

    return 'Guest';
  }

  it('defaults to "Guest" when no community position is configured', () => {
    assert.equal(resolveHeaderCommunityPosition({ user: null }), 'Guest');
    assert.equal(resolveHeaderCommunityPosition({ user: {} }), 'Guest');
    assert.equal(resolveHeaderCommunityPosition({ user: { id: 101 } }), 'Guest');
  });

  it('returns the position code when set on user object', () => {
    assert.equal(resolveHeaderCommunityPosition({ user: { eventLevel: 'PC' } }), 'PC');
    assert.equal(resolveHeaderCommunityPosition({ user: { eventLevel: 'SV' } }), 'SV');
    assert.equal(resolveHeaderCommunityPosition({ user: { communityPosition: { code: 'WT' } } }), 'WT');
    assert.equal(resolveHeaderCommunityPosition({ user: { communityPosition: 'ASSOCIATE' } }), 'ASSOCIATE');
  });

  it('resolves from profile data when user object lacks it', () => {
    assert.equal(
      resolveHeaderCommunityPosition({
        user: { id: 55 },
        profileData: { eventLevel: 'GET TEAM' },
      }),
      'GET TEAM',
    );
  });

  it('reads from saved storage key when available', () => {
    const storage = {
      getItem(k) {
        if (k === 'wv.communityPosition.saved.42') return 'MILL TEAM';
        return null;
      },
      setItem() {},
      removeItem() {},
    };
    assert.equal(
      resolveHeaderCommunityPosition({
        user: { id: 42 },
        storage,
      }),
      'MILL TEAM',
    );
  });
});
