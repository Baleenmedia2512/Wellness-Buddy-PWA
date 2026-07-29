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
