/**
 * Run: node --test backend/features/user/__tests__/communityIdApproval.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAIM_ALREADY_OWNED,
  CLAIM_CO_SPONSOR,
  CLAIM_CREATE,
  CLAIM_FULL,
  CLAIM_INVALID,
  CLAIM_NO_SPONSOR,
  COMMUNITY_ID_OTP_MIN_APP_VERSION,
  REQUEST_KIND_CO_SPONSOR,
  REQUEST_KIND_CREATE,
  buildCommunityIdOccupancy,
  canAttemptCommunityIdOtp,
  classifyCommunityIdRequest,
  communityIdOtpExpiresAt,
  isCommunityIdOtpExpired,
  formatCommunityIdPairLabel,
  resolveCoachTeamIdFromApprover,
  resolveConfirmedCommunityId,
  shouldDeferCommunityIdToOtpFlow,
  toPublicCommunityIdRequest,
} from '../domain/communityIdApproval.rules.js';

describe('shouldDeferCommunityIdToOtpFlow', () => {
  it('keeps legacy apply when flag is off', () => {
    assert.equal(
      shouldDeferCommunityIdToOtpFlow({ flagEnabled: false, appVersion: '3.5.0' }),
      false,
    );
  });

  it('keeps legacy apply for live 3.4.9', () => {
    assert.equal(
      shouldDeferCommunityIdToOtpFlow({ flagEnabled: true, appVersion: '3.4.9' }),
      false,
    );
  });

  it('defers for unreleased 3.5.0 when flag is on', () => {
    assert.equal(
      shouldDeferCommunityIdToOtpFlow({ flagEnabled: true, appVersion: '3.5.0' }),
      true,
    );
    assert.equal(COMMUNITY_ID_OTP_MIN_APP_VERSION, '3.5.0');
  });

  it('keeps legacy apply when version is missing', () => {
    assert.equal(
      shouldDeferCommunityIdToOtpFlow({ flagEnabled: true, appVersion: null }),
      false,
    );
  });
});

describe('OTP expiry and attempts', () => {
  it('expires after the stored timestamp', () => {
    const now = new Date('2026-09-18T12:00:00.000Z');
    assert.equal(isCommunityIdOtpExpired('2026-09-18T11:59:00.000Z', now), true);
    assert.equal(isCommunityIdOtpExpired('2026-09-18T12:01:00.000Z', now), false);
  });

  it('adds 24 hours from request time', () => {
    const start = new Date('2026-09-18T00:00:00.000Z');
    assert.equal(
      communityIdOtpExpiresAt(start).toISOString(),
      '2026-09-19T00:00:00.000Z',
    );
  });

  it('blocks the 5th failed attempt onward', () => {
    assert.equal(canAttemptCommunityIdOtp(4), true);
    assert.equal(canAttemptCommunityIdOtp(5), false);
  });
});

describe('buildCommunityIdOccupancy', () => {
  it('prefers coach_teams seats', () => {
    const occ = buildCommunityIdOccupancy({
      activeTeam: { CoachId: 10, CoCoachId: 11 },
      teamIdOwnerIds: [99],
    });
    assert.deepEqual(occ, {
      sponsorUserId: 10,
      coSponsorUserId: 11,
      pendingCreateRequesterId: null,
    });
  });

  it('infers sponsor from TeamId owners when no coach_teams row', () => {
    const occ = buildCommunityIdOccupancy({
      activeTeam: null,
      teamIdOwnerIds: [7],
      pendingCreateRequesterId: 8,
    });
    assert.equal(occ.sponsorUserId, 7);
    assert.equal(occ.pendingCreateRequesterId, 8);
  });
});

describe('classifyCommunityIdRequest', () => {
  const base = {
    requestedCode: 'WB1234',
    requesterId: 20,
    requesterCoachId: 9,
    requesterConfirmedCode: null,
    occupancy: {},
  };

  it('rejects invalid codes', () => {
    const out = classifyCommunityIdRequest({ ...base, requestedCode: 'ab' });
    assert.equal(out.ok, false);
    assert.equal(out.status, CLAIM_INVALID);
  });

  it('rejects when the requester has no sponsor', () => {
    const out = classifyCommunityIdRequest({ ...base, requesterCoachId: null });
    assert.equal(out.ok, false);
    assert.equal(out.status, CLAIM_NO_SPONSOR);
  });

  it('classifies a free code as create', () => {
    const out = classifyCommunityIdRequest(base);
    assert.equal(out.ok, true);
    assert.equal(out.status, CLAIM_CREATE);
    assert.equal(out.kind, REQUEST_KIND_CREATE);
    assert.equal(out.seat, 'sponsor');
    assert.equal(out.code, 'WB1234');
  });

  it('classifies a one-seat team as co-sponsor', () => {
    const out = classifyCommunityIdRequest({
      ...base,
      occupancy: { sponsorUserId: 3, coSponsorUserId: null },
    });
    assert.equal(out.ok, true);
    assert.equal(out.status, CLAIM_CO_SPONSOR);
    assert.equal(out.kind, REQUEST_KIND_CO_SPONSOR);
    assert.equal(out.mainSponsorId, 3);
  });

  it('treats a pending create as occupying the sponsor seat', () => {
    const out = classifyCommunityIdRequest({
      ...base,
      occupancy: { pendingCreateRequesterId: 3 },
    });
    assert.equal(out.ok, true);
    assert.equal(out.kind, REQUEST_KIND_CO_SPONSOR);
    assert.equal(out.mainSponsorId, 3);
  });

  it('rejects a full team', () => {
    const out = classifyCommunityIdRequest({
      ...base,
      occupancy: { sponsorUserId: 3, coSponsorUserId: 4 },
    });
    assert.equal(out.ok, false);
    assert.equal(out.status, CLAIM_FULL);
  });

  it('allows changing a confirmed Community ID to a different code', () => {
    const out = classifyCommunityIdRequest({
      ...base,
      requesterConfirmedCode: 'OTHER99',
    });
    assert.equal(out.ok, true);
    assert.equal(out.status, CLAIM_CREATE);
    assert.equal(out.kind, REQUEST_KIND_CREATE);
  });

  it('rejects requesting a code the user already owns', () => {
    const out = classifyCommunityIdRequest({
      ...base,
      requesterConfirmedCode: 'wb1234',
    });
    assert.equal(out.ok, false);
    assert.equal(out.status, CLAIM_ALREADY_OWNED);
  });
});

describe('toPublicCommunityIdRequest', () => {
  it('omits the OTP hash and includes approver email', () => {
    const pub = toPublicCommunityIdRequest({
      Id: 1,
      CommunityId: 'WB1234',
      RequestKind: REQUEST_KIND_CO_SPONSOR,
      Status: 'pending',
      OtpExpiresAt: '2026-09-19T00:00:00.000Z',
      OtpHash: 'secret',
      MainSponsorName: 'Ada',
    }, { approverName: 'Bob', approverEmail: 'bob@example.com' });
    assert.equal(pub.otpHash, undefined);
    assert.equal(pub.kind, REQUEST_KIND_CO_SPONSOR);
    assert.equal(pub.seat, 'co-sponsor');
    assert.equal(pub.approverName, 'Bob');
    assert.equal(pub.approverEmail, 'bob@example.com');
    assert.equal(pub.mainSponsorName, 'Ada');
  });
});

describe('formatCommunityIdPairLabel', () => {
  it('formats sponsor and co-sponsor first names', () => {
    assert.equal(
      formatCommunityIdPairLabel({
        sponsorName: 'Mohamed Yasheer',
        coSponsorName: 'Balaji',
      }),
      'MOHAMED - BALAJI',
    );
  });

  it('uses NA when unpaired', () => {
    assert.equal(
      formatCommunityIdPairLabel({ sponsorName: 'Yasheer', coSponsorName: null }),
      'YASHEER - NA',
    );
  });
});

describe('resolveConfirmedCommunityId', () => {
  it('uses Community ID when the user already has a lead seat', () => {
    assert.equal(
      resolveConfirmedCommunityId({
        teamId: 'TEAM1',
        communityId: 'WB99',
        teamSeat: 'sponsor',
      }),
      'WB99',
    );
  });

  it('does not treat display Community ID as confirmed without a TeamId or seat', () => {
    assert.equal(
      resolveConfirmedCommunityId({
        teamId: null,
        communityId: 'WB99',
        teamSeat: null,
      }),
      null,
    );
  });
});

describe('resolveCoachTeamIdFromApprover', () => {
  it('maps CoachTeamId to the sponsor Community ID, not the member code', () => {
    assert.equal(
      resolveCoachTeamIdFromApprover({
        approverCommunityId: 'W112NCNCN',
        approverTeamId: 'W112NCNCN',
        existingCoachTeamId: 'WESS12212',
      }),
      'W112NCNCN',
    );
  });

  it('falls back to sponsor TeamId when Community ID is empty', () => {
    assert.equal(
      resolveCoachTeamIdFromApprover({
        approverCommunityId: null,
        approverTeamId: 'COACHTEAM1',
        existingCoachTeamId: 'WESS12212',
      }),
      'COACHTEAM1',
    );
  });

  it('keeps the existing CoachTeamId when the sponsor has no team code', () => {
    assert.equal(
      resolveCoachTeamIdFromApprover({
        approverCommunityId: null,
        approverTeamId: null,
        approverCoachTeamId: null,
        existingCoachTeamId: 'KEEPME01',
      }),
      'KEEPME01',
    );
  });
});
