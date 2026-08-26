/**
 * Unit tests for Sponsor / Co-Sponsor seat helpers.
 * Run: node --test backend/utils/__tests__/coachTeamSeats.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMemberCoachTeamId } from '../coachTeamSeats.js';

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
