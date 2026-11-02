/**
 * Upline may appear in Full Team *view*, but must not be editable for health issues.
 * Run: node --test backend/utils/__tests__/sharedTeamReporting.uplineEdit.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportingContext } from '../reportingHierarchyService.js';
import {
  getSharedTeamFullMembers,
  getSharedTeamFullMembersWithUplines,
} from '../sharedTeamReporting.js';

const UPLINE = 50;
const ROOT = 100;
const ROOT_MEMBER = 101;

function ids(list) {
  return new Set(list.map((m) => Number(m.UserId)));
}

describe('sharedTeamReporting health-issue edit scope', () => {
  it('Full with uplines includes upline for view, editable downline set excludes upline', () => {
    const context = buildReportingContext([
      { UserId: UPLINE, UserName: 'Upline', Role: 'coach', Status: 'Active', CoachId: null },
      { UserId: ROOT, UserName: 'Root', Role: 'coach', Status: 'Active', CoachId: UPLINE },
      { UserId: ROOT_MEMBER, UserName: 'Root Member', Role: null, Status: 'Active', CoachId: ROOT },
    ]);

    const viewIds = ids(getSharedTeamFullMembersWithUplines(ROOT, context));
    const editIds = ids(getSharedTeamFullMembers(ROOT, context));

    assert.equal(viewIds.has(UPLINE), true, 'upline visible in Full Team');
    assert.equal(viewIds.has(ROOT_MEMBER), true);
    assert.equal(editIds.has(UPLINE), false, 'upline not editable');
    assert.equal(editIds.has(ROOT_MEMBER), true, 'downline editable');
  });
});
