/**
 * Run: node --test frontend/src/features/activity/utils/__tests__/activityReportHiddenUsers.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canManageActivityReportHiddenUsers } from '../activityReportHiddenUsers.js';

describe('canManageActivityReportHiddenUsers (frontend)', () => {
  it('allows hide when Activity is available', () => {
    assert.equal(canManageActivityReportHiddenUsers({ activityAvailable: true }), true);
  });

  it('denies hide when Activity is not available', () => {
    assert.equal(canManageActivityReportHiddenUsers({ activityAvailable: false }), false);
    assert.equal(canManageActivityReportHiddenUsers({}), false);
  });
});
