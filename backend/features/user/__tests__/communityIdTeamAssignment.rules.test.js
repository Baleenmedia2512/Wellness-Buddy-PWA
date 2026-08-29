/**
 * Run: node --test backend/features/user/__tests__/communityIdTeamAssignment.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coachTeamIdNeedsUpdate,
  normalizeStoredTeamCode,
  resolveTargetTeamCodeFromExplicitCommunityIdUpdate,
  shouldApplySharedCoachTeamId,
  shouldBackfillCoachTeamIdFromCommunityId,
  shouldClaimLeadSeatOnExplicitCommunityIdUpdate,
  teamAssignmentFieldsNeedUpdate,
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

  it('allows explicit team switch even with lead seat', () => {
    assert.equal(
      shouldApplySharedCoachTeamId({
        role: 'admin',
        teamId: 'TEAMA',
        teamSeat: 'sponsor',
        communityId: 'TEAMB',
        resolvedTeamCode: 'TEAMB',
        coachTeamId: 'TEAMA',
        allowTeamSwitch: true,
      }),
      true,
    );
  });
});

describe('resolveTargetTeamCodeFromExplicitCommunityIdUpdate', () => {
  it('uses resolved shared team when found', () => {
    assert.equal(
      resolveTargetTeamCodeFromExplicitCommunityIdUpdate({
        inputCode: 'DISPLAY1',
        resolvedFound: true,
        resolvedTeamCode: 'TEAM123',
      }),
      'TEAM123',
    );
  });

  it('uses typed code when team is not registered yet', () => {
    assert.equal(
      resolveTargetTeamCodeFromExplicitCommunityIdUpdate({
        inputCode: 'moha123yas',
        resolvedFound: false,
        resolvedTeamCode: 'MOHA123YAS',
      }),
      'MOHA123YAS',
    );
  });
});

describe('teamAssignmentFieldsNeedUpdate', () => {
  it('detects when TeamId or CoachTeamId differ from target', () => {
    assert.equal(
      teamAssignmentFieldsNeedUpdate({
        teamId: 'TEAMA',
        coachTeamId: 'TEAMA',
        targetCode: 'TEAMB',
      }),
      true,
    );
  });

  it('skips when already aligned', () => {
    assert.equal(
      teamAssignmentFieldsNeedUpdate({
        teamId: 'TEAM123',
        coachTeamId: 'TEAM123',
        targetCode: 'team123',
      }),
      false,
    );
  });
});

describe('shouldClaimLeadSeatOnExplicitCommunityIdUpdate', () => {
  it('requires seat claim for coach/upline roles', () => {
    assert.equal(
      shouldClaimLeadSeatOnExplicitCommunityIdUpdate({ role: 'coach', teamSeat: null }),
      true,
    );
  });

  it('requires seat claim when user already holds a lead seat', () => {
    assert.equal(
      shouldClaimLeadSeatOnExplicitCommunityIdUpdate({ role: 'admin', teamSeat: 'sponsor' }),
      true,
    );
  });

  it('skips seat claim for plain members', () => {
    assert.equal(
      shouldClaimLeadSeatOnExplicitCommunityIdUpdate({ role: 'user', teamSeat: null }),
      false,
    );
  });
});
