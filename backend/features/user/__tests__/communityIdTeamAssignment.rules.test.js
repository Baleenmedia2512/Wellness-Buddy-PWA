/**
 * Run: node --test backend/features/user/__tests__/communityIdTeamAssignment.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coachTeamIdNeedsUpdate,
  normalizeStoredTeamCode,
  shouldApplySharedCoachTeamId,
  shouldBackfillCoachTeamIdFromCommunityId,
} from '../domain/communityIdTeamAssignment.rules.js';

describe('normalizeStoredTeamCode', () => {
  it('uppercases stored codes', () => {
    assert.equal(normalizeStoredTeamCode('team123'), 'TEAM123');
  });
});

describe('shouldBackfillCoachTeamIdFromCommunityId', () => {
  it('allows backfill when CoachTeamId missing', () => {
    assert.equal(
      shouldBackfillCoachTeamIdFromCommunityId({
        communityId: 'TEAM123',
        coachTeamId: null,
      }),
      true,
    );
  });

  it('skips when CoachTeamId already set', () => {
    assert.equal(
      shouldBackfillCoachTeamIdFromCommunityId({
        communityId: 'TEAM123',
        coachTeamId: 'TEAM123',
      }),
      false,
    );
  });
});

describe('coachTeamIdNeedsUpdate', () => {
  it('detects team switch', () => {
    assert.equal(
      coachTeamIdNeedsUpdate({ coachTeamId: 'TEAMA', resolvedTeamCode: 'TEAMB' }),
      true,
    );
  });

  it('skips when already on team', () => {
    assert.equal(
      coachTeamIdNeedsUpdate({ coachTeamId: 'team123', resolvedTeamCode: 'TEAM123' }),
      false,
    );
  });
});

describe('shouldApplySharedCoachTeamId', () => {
  it('allows members when team resolves', () => {
    assert.equal(
      shouldApplySharedCoachTeamId({
        role: 'user',
        teamId: null,
        teamSeat: null,
        communityId: 'TEAM123',
        resolvedTeamCode: 'TEAM123',
      }),
      true,
    );
  });

  it('skips coach lead-claim path', () => {
    assert.equal(
      shouldApplySharedCoachTeamId({
        role: 'coach',
        teamId: null,
        teamSeat: null,
        communityId: 'NEWTEAM1',
        resolvedTeamCode: 'NEWTEAM1',
      }),
      false,
    );
  });

  it('skips when lead seat already held', () => {
    assert.equal(
      shouldApplySharedCoachTeamId({
        role: 'user',
        teamId: 'TEAM123',
        teamSeat: 'sponsor',
        communityId: 'TEAM123',
        resolvedTeamCode: 'TEAM123',
      }),
      false,
    );
  });
});
