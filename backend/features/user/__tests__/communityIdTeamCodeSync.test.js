/**
 * Run: node --test backend/features/user/__tests__/communityIdTeamCodeSync.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCoachTeamCodeSyncRole,
  normalizeTeamCodeFromCommunityId,
  resolveCoachTeamCodeToSync,
  shouldSyncCommunityIdToTeamCode,
} from '../domain/communityIdTeamCodeSync.rules.js';

describe('normalizeTeamCodeFromCommunityId', () => {
  it('uppercases alphanumeric community ids', () => {
    assert.equal(normalizeTeamCodeFromCommunityId('team001abc'), 'TEAM001ABC');
  });

  it('returns null for empty values', () => {
    assert.equal(normalizeTeamCodeFromCommunityId(''), null);
  });
});

describe('shouldSyncCommunityIdToTeamCode', () => {
  it('allows coach with community id and no team seat', () => {
    assert.equal(
      shouldSyncCommunityIdToTeamCode({
        role: 'coach',
        teamId: null,
        teamSeat: null,
        communityId: 'W112072ABC',
      }),
      true,
    );
  });

  it('skips members (user role)', () => {
    assert.equal(
      shouldSyncCommunityIdToTeamCode({
        role: 'user',
        teamId: null,
        teamSeat: null,
        communityId: 'W112072ABC',
      }),
      false,
    );
  });

  it('skips when team id already exists', () => {
    assert.equal(
      shouldSyncCommunityIdToTeamCode({
        role: 'coach',
        teamId: 'TEAM001',
        teamSeat: null,
        communityId: 'NEWCODE1',
      }),
      false,
    );
  });

  it('skips when lead seat already assigned', () => {
    assert.equal(
      shouldSyncCommunityIdToTeamCode({
        role: 'upline',
        teamId: null,
        teamSeat: 'co-sponsor',
        communityId: 'W112072ABC',
      }),
      false,
    );
  });
});

describe('resolveCoachTeamCodeToSync', () => {
  it('returns normalized team code for eligible coaches', () => {
    assert.equal(
      resolveCoachTeamCodeToSync({
        role: 'coach',
        teamId: null,
        teamSeat: null,
        communityId: 'w112072abc',
      }),
      'W112072ABC',
    );
  });

  it('returns null for ineligible users', () => {
    assert.equal(
      resolveCoachTeamCodeToSync({
        role: 'user',
        teamId: null,
        teamSeat: null,
        communityId: 'W112072ABC',
      }),
      null,
    );
  });
});

describe('isCoachTeamCodeSyncRole', () => {
  it('includes coach and upline only', () => {
    assert.equal(isCoachTeamCodeSyncRole('coach'), true);
    assert.equal(isCoachTeamCodeSyncRole('upline'), true);
    assert.equal(isCoachTeamCodeSyncRole('user'), false);
  });
});
