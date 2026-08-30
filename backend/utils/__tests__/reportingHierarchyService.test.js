/**
 * Unit tests for reporting hierarchy (inactive coach rollup).
 * Run: node --test backend/utils/__tests__/reportingHierarchyService.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportingContext,
  getDirectReportingMembers,
  getFullReportingMembers,
  getReportingMemberIds,
  buildReportingChildrenIndex,
  isReportingDownlineMember,
  collectVisibleHierarchyUsers,
  isSharedCoachTeamAccessible,
  normalizeCoachTeamId,
} from '../reportingHierarchyService.js';

const X = 1;
const A = 10;
const B = 20;
const C = 30;
const D = 40;
const M1 = 201;
const M2 = 202;
const M3 = 203;

function makeUsers(bStatus = 'Active') {
  return [
    { UserId: X, UserName: 'Coach X', Role: 'coach', CoachId: null, Status: 'Active' },
    { UserId: A, UserName: 'Member A', Role: 'user', CoachId: X, Status: 'Active' },
    { UserId: B, UserName: 'Coach B', Role: 'coach', CoachId: X, Status: bStatus },
    { UserId: C, UserName: 'Member C', Role: 'user', CoachId: X, Status: 'Active' },
    { UserId: D, UserName: 'Member D', Role: 'user', CoachId: X, Status: 'Active' },
    { UserId: M1, UserName: 'Member M1', Role: 'user', CoachId: B, Status: 'Active' },
    { UserId: M2, UserName: 'Member M2', Role: 'user', CoachId: B, Status: 'Active' },
    { UserId: M3, UserName: 'Member M3', Role: 'user', CoachId: B, Status: 'Active' },
  ];
}

function ids(members) {
  return members.map((m) => m.UserId).sort((a, b) => a - b);
}

describe('getDirectReportingMembers', () => {
  it('Scenario 1 — active child coach: parent sees only direct reports', () => {
    const context = buildReportingContext(makeUsers('Active'));
    const xDirect = getDirectReportingMembers(X, context);
    assert.deepEqual(ids(xDirect), [A, B, C, D]);
  });

  it('Scenario 1 — active child coach manages own team', () => {
    const context = buildReportingContext(makeUsers('Active'));
    const bDirect = getDirectReportingMembers(B, context);
    assert.deepEqual(ids(bDirect), [M1, M2, M3]);
  });

  it('Scenario 2 — inactive coach rolls members up to parent', () => {
    const context = buildReportingContext(makeUsers('Inactive'));
    const xDirect = getDirectReportingMembers(X, context);
    assert.deepEqual(ids(xDirect), [A, B, C, D, M1, M2, M3]);
  });

  it('includes inactive coach in parent direct list', () => {
    const context = buildReportingContext(makeUsers('Inactive'));
    const xDirect = getDirectReportingMembers(X, context);
    const inactiveB = xDirect.find((m) => m.UserId === B);
    assert.ok(inactiveB);
    assert.equal(inactiveB.Status, 'Inactive');
  });

  it('does not duplicate rolled-up members', () => {
    const context = buildReportingContext(makeUsers('Inactive'));
    const xDirect = getDirectReportingMembers(X, context);
    const unique = new Set(xDirect.map((m) => m.UserId));
    assert.equal(unique.size, xDirect.length);
  });
});

describe('getFullReportingMembers', () => {
  it('Scenario 1 — full team includes nested active coach downline', () => {
    const context = buildReportingContext(makeUsers('Active'));
    const xFull = getFullReportingMembers(X, context);
    assert.deepEqual(ids(xFull), [A, B, C, D, M1, M2, M3]);
  });

  it('Scenario 2 — full team matches rolled-up direct list when child coach inactive', () => {
    const context = buildReportingContext(makeUsers('Inactive'));
    const xFull = getFullReportingMembers(X, context);
    assert.deepEqual(ids(xFull), [A, B, C, D, M1, M2, M3]);
  });

  it('Scenario 3 — full team includes 3+ levels even when nested parents are Role=user', () => {
    // X → Prethip(coach) → U2(user) → A3(user) → B1,B2
    // Direct = only X's immediate children; Full = entire tree.
    const A1 = 301;
    const A2 = 302;
    const A3 = 303;
    const B1 = 401;
    const B2 = 402;
    const users = [
      { UserId: X, UserName: 'Coach X', Role: 'coach', CoachId: null, Status: 'Active' },
      { UserId: A, UserName: 'Adithya', Role: 'user', CoachId: X, Status: 'Active' },
      { UserId: B, UserName: 'Prethip', Role: 'coach', CoachId: X, Status: 'Active' },
      { UserId: C, UserName: 'Ramesh', Role: 'user', CoachId: X, Status: 'Active' },
      { UserId: M1, UserName: 'U1', Role: 'user', CoachId: B, Status: 'Active' },
      { UserId: M2, UserName: 'U2', Role: 'user', CoachId: B, Status: 'Active' },
      { UserId: M3, UserName: 'U3', Role: 'user', CoachId: B, Status: 'Active' },
      { UserId: A1, UserName: 'A1', Role: 'user', CoachId: M2, Status: 'Active' },
      { UserId: A2, UserName: 'A2', Role: 'user', CoachId: M2, Status: 'Active' },
      { UserId: A3, UserName: 'A3', Role: 'user', CoachId: M2, Status: 'Active' },
      { UserId: B1, UserName: 'B1', Role: 'user', CoachId: A3, Status: 'Active' },
      { UserId: B2, UserName: 'B2', Role: 'user', CoachId: A3, Status: 'Active' },
    ];
    const context = buildReportingContext(users);

    assert.deepEqual(ids(getDirectReportingMembers(X, context)), [A, B, C]);
    assert.deepEqual(
      ids(getFullReportingMembers(X, context)),
      [A, B, C, M1, M2, M3, A1, A2, A3, B1, B2],
    );
  });
});

describe('getReportingMemberIds', () => {
  it('excludes the viewing coach from member ids', () => {
    const context = buildReportingContext(makeUsers('Active'));
    const memberIds = getReportingMemberIds(B, 'direct', context);
    assert.deepEqual(memberIds.sort((a, b) => a - b), [M1, M2, M3]);
    assert.ok(!memberIds.includes(B));
  });
});

describe('buildReportingChildrenIndex', () => {
  it('active coach has separate children index for team compliance', () => {
    const context = buildReportingContext(makeUsers('Active'));
    const index = buildReportingChildrenIndex(context, X);
    assert.deepEqual((index.get(X) || []).sort((a, b) => a - b), [A, B, C, D]);
    assert.deepEqual((index.get(B) || []).sort((a, b) => a - b), [M1, M2, M3]);
  });

  it('inactive coach children roll into parent index', () => {
    const context = buildReportingContext(makeUsers('Inactive'));
    const index = buildReportingChildrenIndex(context, X);
    assert.deepEqual(
      (index.get(X) || []).sort((a, b) => a - b),
      [A, B, C, D, M1, M2, M3],
    );
    assert.equal(index.has(B), false);
  });

  it('indexes nested Role=user parents who have a CoachId downline', () => {
    const A3 = 303;
    const B1 = 401;
    const users = [
      { UserId: X, UserName: 'Coach X', Role: 'coach', CoachId: null, Status: 'Active' },
      { UserId: B, UserName: 'Prethip', Role: 'coach', CoachId: X, Status: 'Active' },
      { UserId: M2, UserName: 'U2', Role: 'user', CoachId: B, Status: 'Active' },
      { UserId: A3, UserName: 'A3', Role: 'user', CoachId: M2, Status: 'Active' },
      { UserId: B1, UserName: 'B1', Role: 'user', CoachId: A3, Status: 'Active' },
    ];
    const context = buildReportingContext(users);
    const index = buildReportingChildrenIndex(context, X);
    assert.deepEqual((index.get(B) || []).sort((a, b) => a - b), [M2]);
    assert.deepEqual((index.get(M2) || []).sort((a, b) => a - b), [A3]);
    assert.deepEqual((index.get(A3) || []).sort((a, b) => a - b), [B1]);
  });
});

describe('inactive nested leader (Role=user) rollup — coach→a3→b1→c1', () => {
  const A1 = 501;
  const A2 = 502;
  const A3 = 503;
  const A4 = 504;
  const B1 = 601;
  const B2 = 602;
  const B3 = 603;
  const C1 = 701;

  function makeTree(b1Status = 'Active') {
    return [
      { UserId: X, UserName: 'Coach', Role: 'coach', CoachId: null, Status: 'Active' },
      { UserId: A1, UserName: 'a1', Role: 'user', CoachId: X, Status: 'Active' },
      { UserId: A2, UserName: 'a2', Role: 'user', CoachId: X, Status: 'Active' },
      { UserId: A3, UserName: 'a3', Role: 'user', CoachId: X, Status: 'Active' },
      { UserId: A4, UserName: 'a4', Role: 'user', CoachId: X, Status: 'Active' },
      { UserId: B1, UserName: 'b1', Role: 'user', CoachId: A3, Status: b1Status },
      { UserId: B2, UserName: 'b2', Role: 'user', CoachId: A3, Status: 'Active' },
      { UserId: B3, UserName: 'b3', Role: 'user', CoachId: A3, Status: 'Active' },
      { UserId: C1, UserName: 'c1', Role: 'user', CoachId: B1, Status: 'Active' },
    ];
  }

  it('b1 inactive → c1 rolls up into a3 direct (aligns to a3)', () => {
    const context = buildReportingContext(makeTree('Inactive'));
    const a3Direct = getDirectReportingMembers(A3, context);
    assert.deepEqual(ids(a3Direct), [B2, B3, C1]);
    assert.ok(!a3Direct.some((m) => m.UserId === B1), 'inactive b1 hidden from a3 direct');
  });

  it('b1 active → c1 stays under b1 (not in a3 direct)', () => {
    const context = buildReportingContext(makeTree('Active'));
    const a3Direct = getDirectReportingMembers(A3, context);
    assert.deepEqual(ids(a3Direct), [B1, B2, B3]);
    const b1Direct = getDirectReportingMembers(B1, context);
    assert.deepEqual(ids(b1Direct), [C1]);
  });

  it('coach Full Team includes c1 when b1 is inactive', () => {
    const context = buildReportingContext(makeTree('Inactive'));
    const full = getFullReportingMembers(X, context);
    assert.ok(full.some((m) => m.UserId === C1));
    assert.ok(!full.some((m) => m.UserId === B1), 'inactive b1 not in Full after Active-style use');
    // Note: getFullReportingMembers still may include inactive coaches; b1 is user so not included.
  });

  it('isReportingDownlineMember allows self, nested C1, and rejects outsiders', () => {
    const context = buildReportingContext(makeTree('Active'));
    assert.equal(isReportingDownlineMember(X, X, context), true);
    assert.equal(isReportingDownlineMember(X, A3, context), true);
    assert.equal(isReportingDownlineMember(X, B1, context), true);
    assert.equal(isReportingDownlineMember(X, C1, context), true);
    assert.equal(isReportingDownlineMember(X, 9999, context), false);
  });
});

describe('isSharedCoachTeamAccessible — team-hierarchy search parity', () => {
  const sponsor = 100;
  const coCoach = 101;
  const member = 200;
  const outsider = 300;
  const teamRow = { TeamId: 'TEAM42', CoachId: sponsor, CoCoachId: coCoach };

  it('normalizeCoachTeamId trims and uppercases', () => {
    assert.equal(normalizeCoachTeamId(' team42 '), 'TEAM42');
    assert.equal(normalizeCoachTeamId(null), null);
  });

  it('allows Sponsor/Co-Sponsor leads to view active shared-team members', () => {
    const memberRow = { Status: 'Active', CoachTeamId: 'team42' };
    assert.equal(isSharedCoachTeamAccessible(sponsor, memberRow, teamRow), true);
    assert.equal(isSharedCoachTeamAccessible(coCoach, memberRow, teamRow), true);
  });

  it('rejects inactive members, outsiders, and different team codes', () => {
    const activeMember = { Status: 'Active', CoachTeamId: 'TEAM42' };
    const inactiveMember = { Status: 'Inactive', CoachTeamId: 'TEAM42' };
    const otherTeamMember = { Status: 'Active', CoachTeamId: 'OTHER' };
    assert.equal(isSharedCoachTeamAccessible(outsider, activeMember, teamRow), false);
    assert.equal(isSharedCoachTeamAccessible(sponsor, inactiveMember, teamRow), false);
    assert.equal(isSharedCoachTeamAccessible(sponsor, otherTeamMember, teamRow), false);
    assert.equal(isSharedCoachTeamAccessible(sponsor, activeMember, null), false);
  });
});

describe('collectVisibleHierarchyUsers — upline people, own downline, not other branches', () => {
  const Ravi = 1;
  const Prethip = 2;
  const Prem = 3;
  const A1 = 4;
  const B1 = 5;
  const B2 = 6;
  const Balaji = 7;
  const XUser = 8;
  const X1 = 9;
  const Y = 10;
  const Usha = 11;
  const A = 12;
  const BMember = 13;
  const C = 14;

  const TREE = [
    { UserId: Ravi, UserName: 'Ravi', Role: 'coach', CoachId: null, Status: 'Active' },
    { UserId: Prethip, UserName: 'Prethip', Role: 'coach', CoachId: Ravi, Status: 'Active' },
    { UserId: Prem, UserName: 'Prem', Role: 'coach', CoachId: Prethip, Status: 'Active' },
    { UserId: A1, UserName: 'A1', Role: 'user', CoachId: Prem, Status: 'Active' },
    { UserId: B1, UserName: 'B1', Role: 'user', CoachId: A1, Status: 'Active' },
    { UserId: B2, UserName: 'B2', Role: 'user', CoachId: A1, Status: 'Active' },
    { UserId: Balaji, UserName: 'Balaji', Role: 'coach', CoachId: Prem, Status: 'Active' },
    { UserId: XUser, UserName: 'X', Role: 'user', CoachId: Balaji, Status: 'Active' },
    { UserId: X1, UserName: 'X1', Role: 'user', CoachId: XUser, Status: 'Active' },
    { UserId: Y, UserName: 'Y', Role: 'user', CoachId: Balaji, Status: 'Active' },
    { UserId: Usha, UserName: 'Usha', Role: 'coach', CoachId: Balaji, Status: 'Active' },
    { UserId: A, UserName: 'A', Role: 'user', CoachId: Usha, Status: 'Active' },
    { UserId: BMember, UserName: 'B', Role: 'user', CoachId: Usha, Status: 'Active' },
    { UserId: C, UserName: 'C', Role: 'user', CoachId: Usha, Status: 'Active' },
  ];

  function names(members) {
    return members.map((m) => m.UserName).sort();
  }

  it('Balaji sees ancestors + self + full downline, plus sibling peer (no peer downline)', () => {
    const context = buildReportingContext(TREE);
    const visible = collectVisibleHierarchyUsers(Balaji, context);
    assert.deepEqual(names(visible), [
      'A', 'A1', 'B', 'Balaji', 'C', 'Prem', 'Prethip', 'Ravi', 'Usha', 'X', 'X1', 'Y',
    ]);
    const idSet = new Set(visible.map((m) => m.UserId));
    assert.equal(idSet.has(A1), true);
    assert.equal(idSet.has(B1), false);
    assert.equal(idSet.has(B2), false);
  });

  it('Usha sees ancestors + self + her downline, plus sibling peers (no peer downline)', () => {
    const context = buildReportingContext(TREE);
    const visible = collectVisibleHierarchyUsers(Usha, context);
    const idSet = new Set(visible.map((m) => m.UserId));
    for (const id of [Ravi, Prethip, Prem, Balaji, Usha, A, BMember, C, XUser, Y]) {
      assert.equal(idSet.has(id), true, `Usha should see ${id}`);
    }
    assert.equal(idSet.has(A1), false);
    assert.equal(idSet.has(B1), false);
    assert.equal(idSet.has(B2), false);
    // Peer nodes only: include XUser but not X1.
    assert.equal(idSet.has(X1), false);
  });

  it('partnerIds include the peer node only (no partner downline)', () => {
    const context = buildReportingContext(TREE);
    const visible = collectVisibleHierarchyUsers(Usha, context, { partnerIds: [XUser] });
    const idSet = new Set(visible.map((m) => m.UserId));
    assert.equal(idSet.has(XUser), true);
    assert.equal(idSet.has(X1), false);
    assert.equal(idSet.has(Y), true);
    assert.equal(idSet.has(A1), false);
  });

  it('partnerRootIds include shared Sponsor/Co-Sponsor partner downline', () => {
    // Riya (Sponsor) and Kabir (Co-Sponsor) share a team; members under either lead.
    const Riya = 9001;
    const Kabir = 9002;
    const Amit = 9003;
    const Priya = 9004;
    const shared = buildReportingContext([
      { UserId: Riya, UserName: 'Riya', Role: 'user', CoachId: null, Status: 'Active' },
      { UserId: Kabir, UserName: 'Kabir', Role: 'user', CoachId: null, Status: 'Active' },
      { UserId: Amit, UserName: 'Amit', Role: 'user', CoachId: Riya, Status: 'Active' },
      { UserId: Priya, UserName: 'Priya', Role: 'user', CoachId: Kabir, Status: 'Active' },
    ]);
    shared.partnerRootIds = [Kabir];

    const riyaVisible = collectVisibleHierarchyUsers(Riya, shared);
    const riyaIds = new Set(riyaVisible.map((m) => m.UserId));
    assert.equal(riyaIds.has(Kabir), true);
    assert.equal(riyaIds.has(Amit), true);
    assert.equal(riyaIds.has(Priya), true);

    shared.partnerRootIds = [Riya];
    const kabirVisible = collectVisibleHierarchyUsers(Kabir, shared);
    const kabirIds = new Set(kabirVisible.map((m) => m.UserId));
    assert.equal(kabirIds.has(Riya), true);
    assert.equal(kabirIds.has(Amit), true);
    assert.equal(kabirIds.has(Priya), true);
  });
});
