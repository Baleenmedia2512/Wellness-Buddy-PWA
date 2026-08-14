/**
 * Run: node --test frontend/src/features/reports/utils/__tests__/reportsViewedMember.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveReportsViewedUser,
  reportsSelectedUserLabel,
  reportsMemberPossessiveTitle,
} from '../reportsViewedMember.js';

const sessionUser = { id: 1, userName: 'Coach A' };
const downline = { id: 22, userName: 'A2', isSelf: false };

describe('resolveReportsViewedUser', () => {
  it('defaults to the logged-in user', () => {
    assert.equal(resolveReportsViewedUser(null, sessionUser), sessionUser);
    assert.equal(
      resolveReportsViewedUser({ id: 1, isSelf: true }, sessionUser),
      sessionUser,
    );
  });

  it('returns the selected downline member', () => {
    assert.equal(resolveReportsViewedUser(downline, sessionUser), downline);
  });
});

describe('reports titles', () => {
  it('uses My Profile / My Nutrition for self', () => {
    assert.equal(reportsSelectedUserLabel(null), 'My Profile');
    assert.equal(reportsMemberPossessiveTitle(null, 'Nutrition'), 'My Nutrition');
    assert.equal(reportsMemberPossessiveTitle(null, 'Weight Trend'), 'My Weight Trend');
  });

  it('uses the member name when a downline user is selected', () => {
    assert.equal(reportsSelectedUserLabel(downline), 'A2');
    assert.equal(reportsMemberPossessiveTitle(downline, 'Nutrition'), "A2's Nutrition");
    assert.equal(reportsMemberPossessiveTitle(downline, 'Weight Trend'), "A2's Weight Trend");
  });
});
