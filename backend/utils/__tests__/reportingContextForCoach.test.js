/**
 * Yasheer (339) hierarchy — Full team should match Ideal Weight (25 members).
 * Run: node --test backend/utils/__tests__/reportingContextForCoach.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportingContext,
  getDirectReportingMembers,
  getFullReportingMembers,
} from '../reportingHierarchyService.js';

const X = 339;

/** CoachId edges from Ideal Weight API sample (user 339). */
const YASHEER_TEAM = [
  { UserId: 339, UserName: 'YASHEER', Role: 'coach', CoachId: null, Status: 'Active' },
  { UserId: 735, UserName: 'Prethip', Role: 'coach', CoachId: 339, Status: 'Active' },
  { UserId: 341, UserName: 'adithya', Role: 'coach', CoachId: 339, Status: 'Active' },
  { UserId: 279, UserName: 'BALAJI', Role: 'coach', CoachId: 735, Status: 'Active' },
  { UserId: 791, UserName: 'NITHEESH', Role: 'coach', CoachId: 341, Status: 'Active' },
  { UserId: 797, UserName: 'Avinash', Role: 'user', CoachId: 341, Status: 'Active' },
  { UserId: 754, UserName: 'Kabilan', Role: 'user', CoachId: 341, Status: 'Active' },
  { UserId: 405, UserName: 'Leenah', Role: 'coach', CoachId: 279, Status: 'Active' },
  { UserId: 756, UserName: 'Sweenah', Role: 'user', CoachId: 279, Status: 'Active' },
  { UserId: 749, UserName: 'bharathi', Role: 'user', CoachId: 279, Status: 'Active' },
  { UserId: 306, UserName: 'Usharaj', Role: 'coach', CoachId: 279, Status: 'Active' },
  { UserId: 679, UserName: 'ThanigaSalam', Role: 'coach', CoachId: 279, Status: 'Active' },
  { UserId: 445, UserName: 'lawrence', Role: 'coach', CoachId: 405, Status: 'Active' },
  { UserId: 730, UserName: 'prathaban', Role: 'user', CoachId: 445, Status: 'Active' },
  { UserId: 748, UserName: 'Priya', Role: 'user', CoachId: 445, Status: 'Active' },
  { UserId: 757, UserName: 'Sofiya', Role: 'user', CoachId: 405, Status: 'Active' },
  { UserId: 609, UserName: 'thilagavathi', Role: 'user', CoachId: 306, Status: 'Active' },
  { UserId: 327, UserName: 'gomathi', Role: 'user', CoachId: 306, Status: 'Active' },
  { UserId: 553, UserName: 'Latha', Role: 'user', CoachId: 306, Status: 'Active' },
  { UserId: 346, UserName: 'vasantha', Role: 'coach', CoachId: 306, Status: 'Active' },
  { UserId: 523, UserName: 'Ayyavu', Role: 'user', CoachId: 346, Status: 'Active' },
  { UserId: 475, UserName: 'Clara', Role: 'user', CoachId: 346, Status: 'Active' },
  { UserId: 392, UserName: 'Vanitha', Role: 'user', CoachId: 346, Status: 'Active' },
  { UserId: 770, UserName: 'Sathiya', Role: 'user', CoachId: 346, Status: 'Active' },
  { UserId: 775, UserName: 'RAMESH', Role: 'user', CoachId: 791, Status: 'Active' },
  { UserId: 751, UserName: 'Vijayakumari', Role: 'user', CoachId: 679, Status: 'Active' },
];

function simulateSubtreeBfs(allUsers, rootId, { skipExisting = false } = {}) {
  const usersById = new Map(allUsers.map((u) => [u.UserId, u]));
  const rootUser = usersById.get(rootId);
  if (!rootUser) return buildReportingContext([]);

  let currentCoachIds = [rootId, 341];
  let depth = 0;
  const loaded = new Map([[rootId, rootUser], [341, usersById.get(341)]]);

  while (currentCoachIds.length > 0 && depth < 12) {
    const children = allUsers.filter((u) => currentCoachIds.includes(u.CoachId));
    const nextCoachIds = [];
    for (const child of children) {
      if (skipExisting && loaded.has(child.UserId)) continue;
      loaded.set(child.UserId, child);
      nextCoachIds.push(child.UserId);
    }
    currentCoachIds = nextCoachIds;
    depth += 1;
  }
  return buildReportingContext([...loaded.values()]);
}

describe('Yasheer team scope parity with Ideal Weight', () => {
  const fullContext = buildReportingContext(YASHEER_TEAM);

  it('full context yields 25 members and 2 direct', () => {
    const direct = getDirectReportingMembers(X, fullContext);
    const full = getFullReportingMembers(X, fullContext);
    assert.equal(direct.length, 2);
    assert.equal(full.length, 25);
    assert.deepEqual(
      direct.map((m) => m.UserId).sort((a, b) => a - b),
      [341, 735],
    );
  });

  it('partial BFS with skip-existing bug drops members', () => {
    const partial = simulateSubtreeBfs(YASHEER_TEAM, X, { skipExisting: true });
    const full = getFullReportingMembers(X, partial);
    assert.ok(full.length < 25, 'skip bug should reduce count');
  });

  it('partial BFS without skip matches full context', () => {
    const partial = simulateSubtreeBfs(YASHEER_TEAM, X, { skipExisting: false });
    const full = getFullReportingMembers(X, partial);
    assert.equal(full.length, 25);
  });
});
