/**
 * Unit tests for phone lookup ranking (BCM lead preferred over empty placeholder).
 * Run: node --test backend/features/auth/domain/phone-identity.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickBestPhoneLookupCandidate,
  scorePhoneLookupCandidate,
} from './phone-identity.rules.js';

describe('scorePhoneLookupCandidate', () => {
  it('scores Active BCM leads with height highest', () => {
    const bcm = {
      UserId: 2,
      Status: 'Active',
      EntryUser: 'Body Parameters Card',
      UserName: 'Ada',
      Height: 170,
    };
    const empty = {
      UserId: 1,
      Status: 'Active',
      EntryUser: 'Wellness Valley',
      UserName: 'user_919876543210',
      Height: null,
    };
    assert.ok(scorePhoneLookupCandidate(bcm) > scorePhoneLookupCandidate(empty));
  });
});

describe('pickBestPhoneLookupCandidate', () => {
  it('prefers BCM lead over placeholder when both match phone', () => {
    const best = pickBestPhoneLookupCandidate([
      {
        UserId: 10,
        Status: 'Active',
        EntryUser: 'Wellness Valley',
        UserName: 'user_9876543210',
        Height: null,
      },
      {
        UserId: 20,
        Status: 'Active',
        EntryUser: 'Body Parameters Card',
        UserName: 'Ravi',
        Height: 172,
      },
    ]);
    assert.equal(best.UserId, 20);
  });

  it('skips inactive stub when active lead exists', () => {
    const best = pickBestPhoneLookupCandidate([
      {
        UserId: 1,
        Status: 'Inactive',
        EntryUser: 'Body Parameters Card',
        UserName: 'Old',
        Height: 170,
      },
      {
        UserId: 2,
        Status: 'Active',
        EntryUser: 'Wellness Valley',
        UserName: 'Ada',
        Height: null,
      },
    ]);
    assert.equal(best.UserId, 2);
  });

  it('returns null for empty list', () => {
    assert.equal(pickBestPhoneLookupCandidate([]), null);
  });
});
