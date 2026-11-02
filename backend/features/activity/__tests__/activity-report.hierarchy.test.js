/**
 * Run: node --test backend/features/activity/__tests__/activity-report.hierarchy.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportingContext } from '../../../utils/reportingHierarchyService.js';
import {
  ACTIVITY_REPORT_MEMBER_TYPE,
  buildActivityReportMemberMeta,
  lookupActivityReportMemberMeta,
  resolveActivityReportMemberType,
  selfActivityReportMemberMeta,
} from '../domain/activity-report.hierarchy.js';

function metaFor(viewerId, users, extra = {}) {
  const context = buildReportingContext(users);
  Object.assign(context, extra);
  return buildActivityReportMemberMeta(viewerId, context);
}

describe('resolveActivityReportMemberType', () => {
  it('is member when the user has 0 CoachId children, even if Role is coach', () => {
    const context = buildReportingContext([
      { UserId: 1, UserName: 'Coach', Role: 'coach', Status: 'Active', CoachId: null },
    ]);
    assert.equal(resolveActivityReportMemberType(1, context), ACTIVITY_REPORT_MEMBER_TYPE.MEMBER);
  });

  it('is sponsor when the user has any downline, even if Role is user', () => {
    const context = buildReportingContext([
      { UserId: 1, UserName: 'Leader', Role: 'user', Status: 'Active', CoachId: null },
      { UserId: 2, UserName: 'Child', Role: 'user', Status: 'Active', CoachId: 1 },
    ]);
    assert.equal(resolveActivityReportMemberType(1, context), ACTIVITY_REPORT_MEMBER_TYPE.SPONSOR);
    assert.equal(resolveActivityReportMemberType(2, context), ACTIVITY_REPORT_MEMBER_TYPE.MEMBER);
  });
});

describe('buildActivityReportMemberMeta', () => {
  const X = 100;
  const A1 = 201;
  const A3 = 203;
  const B1 = 301;
  const B2 = 302;
  const C1 = 401;

  function makeTree(b1Status = 'Active') {
    return [
      { UserId: X, UserName: 'Coach', Role: 'coach', CoachId: null, Status: 'Active' },
      { UserId: A1, UserName: 'a1', Role: 'user', CoachId: X, Status: 'Active' },
      { UserId: A3, UserName: 'a3', Role: 'user', CoachId: X, Status: 'Active' },
      { UserId: B1, UserName: 'b1', Role: 'user', CoachId: A3, Status: b1Status },
      { UserId: B2, UserName: 'b2', Role: 'user', CoachId: A3, Status: 'Active' },
      { UserId: C1, UserName: 'c1', Role: 'user', CoachId: B1, Status: 'Active' },
    ];
  }

  it('assigns level 1 to direct team and increments nested members', () => {
    const { levelByUserId, memberTypeByUserId } = metaFor(X, makeTree('Active'));

    assert.equal(levelByUserId.get(X), 0);
    assert.equal(levelByUserId.get(A1), 1);
    assert.equal(levelByUserId.get(A3), 1);
    assert.equal(levelByUserId.get(B1), 2);
    assert.equal(levelByUserId.get(B2), 2);
    assert.equal(levelByUserId.get(C1), 3);

    assert.equal(memberTypeByUserId.get(X), 'sponsor');
    assert.equal(memberTypeByUserId.get(A1), 'member');
    assert.equal(memberTypeByUserId.get(A3), 'sponsor');
    assert.equal(memberTypeByUserId.get(B1), 'sponsor');
    assert.equal(memberTypeByUserId.get(B2), 'member');
    assert.equal(memberTypeByUserId.get(C1), 'member');
  });

  it('keeps rolled-up descendants at reporting depth, not raw CoachId hops', () => {
    const { levelByUserId, memberTypeByUserId } = metaFor(X, makeTree('Inactive'));

    assert.equal(levelByUserId.get(A3), 1);
    assert.equal(levelByUserId.get(B2), 2);
    assert.equal(levelByUserId.get(C1), 2);
    assert.equal(levelByUserId.has(B1), false);
    assert.equal(memberTypeByUserId.get(A3), 'sponsor');
    assert.equal(memberTypeByUserId.get(C1), 'member');
  });

  it('treats shared-team partner directs as level 1 and their nested members as level 2', () => {
    const ROOT = 100;
    const PARTNER = 200;
    const ROOT_MEMBER = 101;
    const PARTNER_MEMBER = 201;
    const PARTNER_NESTED = 202;
    const { levelByUserId, memberTypeByUserId } = metaFor(ROOT, [
      { UserId: ROOT, UserName: 'Root', Role: 'admin', Status: 'Active', CoachId: null },
      { UserId: PARTNER, UserName: 'Partner', Role: 'admin', Status: 'Active', CoachId: null },
      { UserId: ROOT_MEMBER, UserName: 'Root Member', Role: null, Status: 'Active', CoachId: ROOT },
      { UserId: PARTNER_MEMBER, UserName: 'Partner Member', Role: null, Status: 'Active', CoachId: PARTNER },
      { UserId: PARTNER_NESTED, UserName: 'Partner Nested', Role: null, Status: 'Active', CoachId: PARTNER_MEMBER },
    ], { partnerRootIds: [PARTNER] });

    assert.equal(levelByUserId.get(ROOT_MEMBER), 1);
    assert.equal(levelByUserId.get(PARTNER), 1);
    assert.equal(levelByUserId.get(PARTNER_MEMBER), 1);
    assert.equal(levelByUserId.get(PARTNER_NESTED), 2);
    assert.equal(memberTypeByUserId.get(PARTNER), 'sponsor');
    assert.equal(memberTypeByUserId.get(PARTNER_MEMBER), 'sponsor');
    assert.equal(memberTypeByUserId.get(PARTNER_NESTED), 'member');
    assert.equal(memberTypeByUserId.get(ROOT_MEMBER), 'member');
  });
});

describe('lookupActivityReportMemberMeta', () => {
  it('defaults missing users to member with null level', () => {
    assert.deepEqual(lookupActivityReportMemberMeta(9, null), {
      level: null,
      memberType: 'member',
    });
  });

  it('returns viewer self meta as level 0 member', () => {
    const meta = selfActivityReportMemberMeta(42);
    assert.deepEqual(lookupActivityReportMemberMeta(42, meta), {
      level: 0,
      memberType: 'member',
    });
  });
});
