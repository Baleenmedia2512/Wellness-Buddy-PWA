/**
 * Run: node --test backend/utils/__tests__/teamHierarchyTree.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeadPartnerByUserId,
  isPrimaryDirectReport,
  listPrimaryDirectReports,
  collectPrimaryDownlineIds,
  collectSharedTeamMemberIds,
} from '../teamHierarchyTree.js';

const You = 100;
const Lawrence = 200;
const Leena = 201;
const LawrenceMember = 202;

const Ravi = 300;
const Priya = 301;
const Balaji = 310;
const X = 311;
const X1 = 312;
const Y = 313;
const Usha = 314;
const A = 315;
const B = 316;
const C = 317;
const Kumar = 320;
const P = 321;
const Q = 322;
const R = 323;

const BalajiParent = 400;
const Jasper = 401;
const Paul = 402;
const UshaPeer = 403;
const JasperChild = 404;

const RAVI_PRIYA_USERS = [
  { UserId: Ravi, UserName: 'Ravi', CoachId: null },
  { UserId: Priya, UserName: 'Priya', CoachId: null },
  { UserId: Balaji, UserName: 'Balaji', CoachId: Ravi },
  { UserId: X, UserName: 'X', CoachId: Balaji },
  { UserId: X1, UserName: 'X1', CoachId: X },
  { UserId: Y, UserName: 'Y', CoachId: Balaji },
  { UserId: Usha, UserName: 'Usha', CoachId: Balaji },
  { UserId: A, UserName: 'A', CoachId: Usha },
  { UserId: B, UserName: 'B', CoachId: Usha },
  { UserId: C, UserName: 'C', CoachId: Usha },
  { UserId: Kumar, UserName: 'Kumar', CoachId: Priya },
  { UserId: P, UserName: 'P', CoachId: Kumar },
  { UserId: Q, UserName: 'Q', CoachId: Kumar },
  { UserId: R, UserName: 'R', CoachId: Kumar },
];

describe('buildLeadPartnerByUserId', () => {
  it('maps Sponsor ↔ Co-Coach both ways', () => {
    const map = buildLeadPartnerByUserId([
      { CoachId: Lawrence, CoCoachId: Leena },
    ]);
    assert.equal(map.get(Lawrence), Leena);
    assert.equal(map.get(Leena), Lawrence);
  });
});

describe('Case 2 — Lawrence under You; Leena is Lawrence co-coach (not Your downline)', () => {
  const users = [
    { UserId: You, UserName: 'You', CoachId: null },
    { UserId: Lawrence, UserName: 'Lawrence', CoachId: You },
    { UserId: Leena, UserName: 'Leena', CoachId: null },
    { UserId: LawrenceMember, UserName: 'Member', CoachId: Lawrence },
  ];
  const partners = buildLeadPartnerByUserId([
    { CoachId: Lawrence, CoCoachId: Leena },
  ]);

  it('You downline is Lawrence + Lawrence members only', () => {
    assert.deepEqual(
      collectPrimaryDownlineIds(users, You, partners).sort((a, b) => a - b),
      [Lawrence, LawrenceMember],
    );
  });

  it('Leena is not a primary direct report of You or Lawrence', () => {
    assert.equal(isPrimaryDirectReport(
      users.find((u) => u.UserId === Leena),
      You,
      partners,
    ), false);
    // Even if Leena were wrongly assigned CoachId=Lawrence, partner exclusion applies.
    assert.equal(
      isPrimaryDirectReport(
        { UserId: Leena, CoachId: Lawrence },
        Lawrence,
        partners,
      ),
      false,
    );
  });

  it('shared merge for Lawrence includes only his CoachId tree (not reparenting Leena under You)', () => {
    const shared = collectSharedTeamMemberIds(users, You, null, partners);
    assert.equal(shared.includes(Leena), false);
    assert.equal(shared.includes(Lawrence), true);
  });
});

describe('Case 1 — Ravi + Priya co-coaches see both CoachId teams on shared scope', () => {
  const partners = buildLeadPartnerByUserId([{ CoachId: Ravi, CoCoachId: Priya }]);

  it('Ravi primary downline stays Ravi-only (Priya not inserted as child)', () => {
    const ids = collectPrimaryDownlineIds(RAVI_PRIYA_USERS, Ravi, partners);
    assert.equal(ids.includes(Priya), false);
    assert.equal(ids.includes(Balaji), true);
    assert.equal(ids.includes(Kumar), false);
  });

  it('Priya primary downline stays Priya-only', () => {
    const ids = collectPrimaryDownlineIds(RAVI_PRIYA_USERS, Priya, partners);
    assert.equal(ids.includes(Ravi), false);
    assert.equal(ids.includes(Kumar), true);
    assert.equal(ids.includes(Balaji), false);
  });

  it('shared scope = own + partner CoachId trees, deduped', () => {
    const raviShared = collectSharedTeamMemberIds(
      RAVI_PRIYA_USERS,
      Ravi,
      Priya,
      partners,
    );
    const priyaShared = collectSharedTeamMemberIds(
      RAVI_PRIYA_USERS,
      Priya,
      Ravi,
      partners,
    );

    const expected = [Balaji, X, X1, Y, Usha, A, B, C, Kumar, P, Q, R].sort((a, b) => a - b);
    assert.deepEqual([...raviShared].sort((a, b) => a - b), expected);
    assert.deepEqual([...priyaShared].sort((a, b) => a - b), expected);
    assert.equal(new Set(raviShared).size, raviShared.length);
  });
});

describe('Case 3 — Jasper / Paul peers from same CoachId only', () => {
  const users = [
    { UserId: BalajiParent, UserName: 'Balaji', CoachId: null },
    { UserId: Jasper, UserName: 'Jasper', CoachId: BalajiParent },
    { UserId: Paul, UserName: 'Paul', CoachId: BalajiParent },
    { UserId: UshaPeer, UserName: 'Usha', CoachId: BalajiParent },
    { UserId: JasperChild, UserName: 'JasperChild', CoachId: Jasper },
  ];
  // Jasper selected Leena as co-coach — must not remove Jasper from Balaji's directs
  // or pull Jasper under Leena via CoCoach edges (we never walk CoCoachId).
  const partners = buildLeadPartnerByUserId([
    { CoachId: Jasper, CoCoachId: 999 },
  ]);

  it('Jasper and Paul remain Balaji directs (peers of each other)', () => {
    const directs = listPrimaryDirectReports(users, BalajiParent, partners)
      .map((u) => u.UserId)
      .sort((a, b) => a - b);
    assert.deepEqual(directs, [Jasper, Paul, UshaPeer]);
  });

  it('Paul does not see Jasper children as peer expansion via this helper', () => {
    const paulDownline = collectPrimaryDownlineIds(users, Paul, partners);
    assert.equal(paulDownline.includes(JasperChild), false);
    assert.equal(paulDownline.includes(Jasper), false);
  });

  it('Jasper still has his own CoachId child after selecting a co-coach', () => {
    const jasperDownline = collectPrimaryDownlineIds(users, Jasper, partners);
    assert.deepEqual(jasperDownline, [JasperChild]);
  });
});

describe('Case 5/6 — no duplicates; partner merge does not invent CoachId edges', () => {
  const partners = buildLeadPartnerByUserId([{ CoachId: Ravi, CoCoachId: Priya }]);

  it('duplicate user under both trees appears once', () => {
    const users = [
      ...RAVI_PRIYA_USERS,
      // Same person wrongly listed once — helper dedupes by id when merging
    ];
    const shared = collectSharedTeamMemberIds(users, Ravi, Priya, partners);
    assert.equal(shared.length, new Set(shared).size);
  });

  it('without a co-coach, shared scope equals own primary downline', () => {
    const emptyPartners = buildLeadPartnerByUserId([]);
    const own = collectPrimaryDownlineIds(RAVI_PRIYA_USERS, Ravi, emptyPartners);
    const shared = collectSharedTeamMemberIds(RAVI_PRIYA_USERS, Ravi, null, emptyPartners);
    assert.deepEqual(shared, own);
  });
});
