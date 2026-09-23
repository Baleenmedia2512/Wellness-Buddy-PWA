/**
 * Run: node --test backend/features/activity/__tests__/activity-report.hidden-users.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_REPORT_HIDE_ROLES,
  activityReportHiddenCacheToken,
  canManageActivityReportHiddenUsers,
  excludeHiddenActivityReportUserIds,
  normalizeActivityReportViewerRole,
} from '../domain/activity-report.hidden-users.js';

describe('canManageActivityReportHiddenUsers', () => {
  it('allows admin, developer, coach, and upline', () => {
    for (const role of ACTIVITY_REPORT_HIDE_ROLES) {
      assert.equal(canManageActivityReportHiddenUsers({ role }), true, role);
    }
  });

  it('allows sponsor and co-sponsor (co-coach) lead seats', () => {
    assert.equal(canManageActivityReportHiddenUsers({ role: 'user', leadSeat: 'sponsor' }), true);
    assert.equal(canManageActivityReportHiddenUsers({ role: 'user', leadSeat: 'co-sponsor' }), true);
  });

  it('denies regular customers without a lead seat', () => {
    assert.equal(canManageActivityReportHiddenUsers({ role: 'user' }), false);
    assert.equal(canManageActivityReportHiddenUsers({ role: 'member' }), false);
    assert.equal(canManageActivityReportHiddenUsers({}), false);
  });
});

describe('excludeHiddenActivityReportUserIds', () => {
  it('removes hidden ids and keeps the rest', () => {
    assert.deepEqual(
      excludeHiddenActivityReportUserIds([1, 2, 3, 4], [2, 4]),
      [1, 3],
    );
  });

  it('returns all ids when nothing is hidden', () => {
    assert.deepEqual(excludeHiddenActivityReportUserIds([5, 6], []), [5, 6]);
    assert.deepEqual(excludeHiddenActivityReportUserIds([5, 6], null), [5, 6]);
  });

  it('keeps hidden users out even when filters would otherwise include them', () => {
    // Simulates attendance/date filter still applying to the remaining visible set only.
    const scopeIds = [10, 20, 30];
    const hiddenIds = [20];
    const visible = excludeHiddenActivityReportUserIds(scopeIds, hiddenIds);
    assert.deepEqual(visible, [10, 30]);
    assert.ok(!visible.includes(20));
  });
});

describe('activityReportHiddenCacheToken', () => {
  it('returns none for empty sets and a stable sorted token otherwise', () => {
    assert.equal(activityReportHiddenCacheToken([]), 'none');
    assert.equal(activityReportHiddenCacheToken([3, 1, 2]), '1,2,3');
    assert.equal(activityReportHiddenCacheToken(['2', 1]), '1,2');
  });
});

describe('normalizeActivityReportViewerRole', () => {
  it('maps member/customer to user', () => {
    assert.equal(normalizeActivityReportViewerRole('member'), 'user');
    assert.equal(normalizeActivityReportViewerRole('Customer'), 'user');
    assert.equal(normalizeActivityReportViewerRole('coach'), 'coach');
  });
});
