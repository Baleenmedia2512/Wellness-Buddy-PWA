/**
 * Run: node --test backend/features/activity/__tests__/activity-report.scope.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTeamScope, TEAM_SCOPES } from '../domain/activity-report.scope.js';

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
});
