/**
 * Run: node --test frontend/src/features/activity/utils/__tests__/activityReportHiddenUsers.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canManageActivityReportHiddenUsers } from '../activityReportHiddenUsers.js';

describe('canManageActivityReportHiddenUsers (frontend)', () => {
  it('allows admin and developer', () => {
    assert.equal(canManageActivityReportHiddenUsers({ userRole: 'admin' }), true);
    assert.equal(canManageActivityReportHiddenUsers({ userRole: 'developer' }), true);
  });

  it('allows coach and upline', () => {
    assert.equal(canManageActivityReportHiddenUsers({ userRole: 'coach' }), true);
    assert.equal(canManageActivityReportHiddenUsers({ userRole: 'upline' }), true);
  });

  it('allows elevated coach API role or team-scope (sponsor / co-coach)', () => {
    assert.equal(
      canManageActivityReportHiddenUsers({ userRole: 'user', effectiveRole: 'coach' }),
      true,
    );
    assert.equal(
      canManageActivityReportHiddenUsers({ userRole: 'user', showTeamScope: true }),
      true,
    );
  });

  it('denies regular customers', () => {
    assert.equal(
      canManageActivityReportHiddenUsers({
        userRole: 'user',
        effectiveRole: 'member',
        showTeamScope: false,
      }),
      false,
    );
  });
});
