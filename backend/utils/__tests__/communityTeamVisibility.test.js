/**
 * Run: node --test backend/utils/__tests__/communityTeamVisibility.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserCommunityTeamCode,
  normalizeCommunityTeamCode,
  resolveCommunityPeerCoachIds,
} from '../communityTeamVisibility.js';
import { buildReportingContext } from '../reportingHierarchyService.js';
import {
  getSharedTeamDirectMembers,
  getSharedTeamFullMembers,
} from '../sharedTeamReporting.js';

const Yasheer = 1;
const A = 11;
const A1 = 111;
const A2 = 112;
const S = 12;
const S1 = 121;
const S2 = 122;
const D = 13;
const D1 = 131;
const F = 14;
const F1 = 141;
const G = 15;
const G1 = 151;

const Balaji = 2;
const L = 21;
const L1 = 211;
const L2 = 212;
const K = 22;
const K1 = 221;
const J = 23;
const J1 = 231;

const OtherCommunityCoach = 9;
const OtherMember = 91;

const COMMUNITY = 'C001';

const COMMUNITY_TREE = [
  { UserId: Yasheer, UserName: 'Yasheer', Role: 'coach', CoachId: null, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY, TeamId: COMMUNITY },
  { UserId: A, UserName: 'A', Role: 'user', CoachId: Yasheer, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: A1, UserName: 'A1', Role: 'user', CoachId: A, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: A2, UserName: 'A2', Role: 'user', CoachId: A, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: S, UserName: 'S', Role: 'user', CoachId: Yasheer, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: S1, UserName: 'S1', Role: 'user', CoachId: S, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: S2, UserName: 'S2', Role: 'user', CoachId: S, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: D, UserName: 'D', Role: 'user', CoachId: Yasheer, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: D1, UserName: 'D1', Role: 'user', CoachId: D, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: F, UserName: 'F', Role: 'user', CoachId: Yasheer, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: F1, UserName: 'F1', Role: 'user', CoachId: F, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: G, UserName: 'G', Role: 'user', CoachId: Yasheer, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: G1, UserName: 'G1', Role: 'user', CoachId: G, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },

  { UserId: Balaji, UserName: 'Balaji', Role: 'coach', CoachId: null, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY, TeamId: COMMUNITY },
  { UserId: L, UserName: 'L', Role: 'user', CoachId: Balaji, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: L1, UserName: 'L1', Role: 'user', CoachId: L, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: L2, UserName: 'L2', Role: 'user', CoachId: L, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: K, UserName: 'K', Role: 'user', CoachId: Balaji, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: K1, UserName: 'K1', Role: 'user', CoachId: K, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: J, UserName: 'J', Role: 'user', CoachId: Balaji, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },
  { UserId: J1, UserName: 'J1', Role: 'user', CoachId: J, Status: 'Active', CommunityId: COMMUNITY, CoachTeamId: COMMUNITY },

  { UserId: OtherCommunityCoach, UserName: 'Other', Role: 'coach', CoachId: null, Status: 'Active', CommunityId: 'C999', CoachTeamId: 'C999' },
  { UserId: OtherMember, UserName: 'OtherMember', Role: 'user', CoachId: OtherCommunityCoach, Status: 'Active', CommunityId: 'C999', CoachTeamId: 'C999' },
];

function names(list) {
  return list.map((m) => m.UserName).sort();
}

describe('communityTeamVisibility helpers', () => {
  it('normalizes community / team codes', () => {
    assert.equal(normalizeCommunityTeamCode(' c001 '), 'C001');
    assert.equal(normalizeCommunityTeamCode(null), null);
    assert.equal(getUserCommunityTeamCode({ CommunityId: 'c001' }), 'C001');
    assert.equal(getUserCommunityTeamCode({ CoachTeamId: 'TEAM1' }), 'TEAM1');
  });

  it('resolves Yasheer and Balaji as community peers without nesting nested coaches', () => {
    assert.deepEqual(
      resolveCommunityPeerCoachIds(Yasheer, COMMUNITY_TREE).sort((a, b) => a - b),
      [Balaji],
    );
    assert.deepEqual(
      resolveCommunityPeerCoachIds(Balaji, COMMUNITY_TREE).sort((a, b) => a - b),
      [Yasheer],
    );
  });

  it('does not treat Sponsor/Co-Sponsor partners as community peers', () => {
    assert.deepEqual(
      resolveCommunityPeerCoachIds(Yasheer, COMMUNITY_TREE, { partnerIds: [Balaji] }),
      [],
    );
  });

  it('ignores coaches from another Community ID', () => {
    const peers = resolveCommunityPeerCoachIds(Yasheer, COMMUNITY_TREE);
    assert.equal(peers.includes(OtherCommunityCoach), false);
  });

  it('single-coach communities have no peers', () => {
    const solo = [
      { UserId: 1, UserName: 'Solo', Role: 'coach', CoachId: null, Status: 'Active', CommunityId: 'SOLO' },
      { UserId: 2, UserName: 'M1', Role: 'user', CoachId: 1, Status: 'Active', CommunityId: 'SOLO' },
    ];
    assert.deepEqual(resolveCommunityPeerCoachIds(1, solo), []);
  });
});

describe('sharedTeamReporting — same Community ID visibility', () => {
  function communityContext(viewerId) {
    const context = buildReportingContext(COMMUNITY_TREE);
    context.partnerRootIds = [];
    context.communityPeerRootIds = resolveCommunityPeerCoachIds(viewerId, COMMUNITY_TREE);
    return context;
  }

  it("Yasheer Direct Team = own directs + Balaji's directs (not Balaji)", () => {
    const context = communityContext(Yasheer);
    assert.deepEqual(
      names(getSharedTeamDirectMembers(Yasheer, context)),
      ['A', 'D', 'F', 'G', 'J', 'K', 'L', 'S'],
    );
  });

  it("Yasheer Full Team includes both branches' downstream members", () => {
    const context = communityContext(Yasheer);
    const full = names(getSharedTeamFullMembers(Yasheer, context));
    for (const name of ['A', 'A1', 'A2', 'S', 'S1', 'S2', 'D', 'D1', 'F', 'F1', 'G', 'G1', 'L', 'L1', 'L2', 'K', 'K1', 'J', 'J1']) {
      assert.equal(full.includes(name), true, `missing ${name}`);
    }
    assert.equal(full.includes('Yasheer'), false);
    assert.equal(full.includes('Balaji'), false);
    assert.equal(full.includes('OtherMember'), false);
  });

  it("Balaji Direct Team = own directs + Yasheer's directs (not Yasheer)", () => {
    const context = communityContext(Balaji);
    assert.deepEqual(
      names(getSharedTeamDirectMembers(Balaji, context)),
      ['A', 'D', 'F', 'G', 'J', 'K', 'L', 'S'],
    );
  });

  it('dedupes members reachable through multiple paths', () => {
    const context = communityContext(Yasheer);
    const direct = getSharedTeamDirectMembers(Yasheer, context);
    const ids = direct.map((m) => m.UserId);
    assert.equal(ids.length, new Set(ids).size);
  });

  it('preserves Sponsor/Co-Sponsor partner merge separately from community peers', () => {
    const context = buildReportingContext(COMMUNITY_TREE);
    context.partnerRootIds = [Balaji];
    context.communityPeerRootIds = [];
    const directNames = names(getSharedTeamDirectMembers(Yasheer, context));
    assert.equal(directNames.includes('Balaji'), true);
    assert.equal(directNames.includes('L'), true);
  });
});
