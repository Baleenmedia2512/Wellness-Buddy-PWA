/**
 * Unit tests for Sponsor / Co-Sponsor seat helpers.
 * Run: node --test backend/utils/__tests__/coachTeamSeats.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeamTableClearOnCancelRequest,
  resolveInactiveTeamSeatAssignment,
  resolveMemberCoachTeamId,
} from '../coachTeamSeats.js';

describe('resolveMemberCoachTeamId', () => {
  it('uses claimed TeamId for Sponsor / Co-Sponsor', () => {
    assert.equal(
      resolveMemberCoachTeamId({
        claimedTeamId: 'TEAM001ABC',
        guide: { CoachTeamId: 'OTHERTEAM1', TeamId: 'GUIDETEAM1' },
      }),
      'TEAM001ABC',
    );
  });

  it('inherits guide CoachTeamId when member skips Team Code', () => {
    assert.equal(
      resolveMemberCoachTeamId({
        claimedTeamId: null,
        guide: { CoachTeamId: 'TEAM001ABC', TeamId: 'TEAM001ABC' },
      }),
      'TEAM001ABC',
    );
  });

  it('falls back to guide TeamId when guide has no CoachTeamId', () => {
    assert.equal(
      resolveMemberCoachTeamId({
        claimedTeamId: null,
        guide: { CoachTeamId: null, TeamId: 'TEAM001ABC' },
      }),
      'TEAM001ABC',
    );
  });

  it('returns null when guide has no team (Case 5)', () => {
    assert.equal(
      resolveMemberCoachTeamId({
        claimedTeamId: null,
        guide: { CoachTeamId: null, TeamId: null },
      }),
      null,
    );
  });

  it('prefers guide CoachTeamId over TeamId for Co-Sponsor guides', () => {
    assert.equal(
      resolveMemberCoachTeamId({
        claimedTeamId: '',
        guide: { CoachTeamId: 'TEAM001ABC', TeamId: null },
      }),
      'TEAM001ABC',
    );
  });
});

describe('buildTeamTableClearOnCancelRequest', () => {
  it('clears coach fields for first-time setup users', () => {
    assert.deepEqual(buildTeamTableClearOnCancelRequest({ coachId: null }), {
      TeamId: null,
      CoachId: null,
      CoachTeamId: null,
    });
  });

  it('keeps established CoachId and CoachTeamId on cancel', () => {
    assert.deepEqual(buildTeamTableClearOnCancelRequest({ coachId: 42 }), {
      TeamId: null,
    });
  });
});

describe('resolveInactiveTeamSeatAssignment', () => {
  it('reactivates without wiping CoCoachId when user is existing Sponsor', () => {
    const result = resolveInactiveTeamSeatAssignment(
      { CoachId: 10, CoCoachId: 20, Status: 'inactive' },
      10,
    );
    assert.equal(result.ok, true);
    assert.equal(result.seat, 'already');
    assert.deepEqual(result.update, { Status: 'active' });
  });

  it('assigns Co-Sponsor on inactive team with open second seat', () => {
    const result = resolveInactiveTeamSeatAssignment(
      { CoachId: 10, CoCoachId: null, Status: 'inactive' },
      30,
    );
    assert.equal(result.ok, true);
    assert.equal(result.seat, 'co-sponsor');
    assert.equal(result.update.CoCoachId, 30);
    assert.equal(result.update.CoachId, undefined);
  });
});
