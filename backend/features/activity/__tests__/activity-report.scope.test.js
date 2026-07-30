/**
 * Run: node --test backend/features/activity/__tests__/activity-report.scope.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTeamScope, TEAM_SCOPES } from '../domain/activity-report.scope.js';

function buildCoachScopeIds(hierarchy, userId) {
  const isActiveDownline = (m) => (
    Number(m.UserId) !== Number(userId)
    && String(m.Status || '').toLowerCase() === 'active'
    && !m.IsCoCoach
    && !m.IsLoggedInCoach
  );
  return {
    directIds: hierarchy
      .filter((m) => m.HierarchyLevel === 1 && isActiveDownline(m))
      .map((m) => m.UserId),
    fullIds: hierarchy.filter(isActiveDownline).map((m) => m.UserId),
  };
}

describe('activity-report.scope', () => {
  it('normalizeTeamScope defaults invalid values to full', () => {
    assert.equal(normalizeTeamScope(undefined), TEAM_SCOPES.FULL);
    assert.equal(normalizeTeamScope('invalid'), TEAM_SCOPES.FULL);
  });

  it('normalizeTeamScope accepts mine, direct, full', () => {
    assert.equal(normalizeTeamScope('mine'), TEAM_SCOPES.MINE);
    assert.equal(normalizeTeamScope('direct'), TEAM_SCOPES.DIRECT);
    assert.equal(normalizeTeamScope('FULL'), TEAM_SCOPES.FULL);
  });

  it('coach scope excludes inactive and co-coach from direct/full', () => {
    const userId = 100;
    const hierarchy = [
      { UserId: 100, HierarchyLevel: 0, Status: 'Active', IsLoggedInCoach: true },
      { UserId: 101, HierarchyLevel: 1, Status: 'Active', IsCoCoach: true },
      { UserId: 102, HierarchyLevel: 1, Status: 'Active' },
      { UserId: 103, HierarchyLevel: 1, Status: 'Inactive' },
      { UserId: 104, HierarchyLevel: 2, Status: 'Active' },
    ];
    const { directIds, fullIds } = buildCoachScopeIds(hierarchy, userId);
    assert.deepEqual(directIds, [102]);
    assert.deepEqual(fullIds, [102, 104]);
  });
});
