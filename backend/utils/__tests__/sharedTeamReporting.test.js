/**
 * Run: node --test backend/utils/__tests__/sharedTeamReporting.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportingContext } from '../reportingHierarchyService.js';
import {
  getSharedTeamDirectMembers,
  getSharedTeamFullMembers,
} from '../sharedTeamReporting.js';

const ROOT = 100;
const PARTNER = 200;
const ROOT_MEMBER = 101;
const PARTNER_MEMBER = 201;
const PARTNER_NESTED = 202;

function ids(list) {
  return list.map((m) => Number(m.UserId)).sort((a, b) => a - b);
}

describe('sharedTeamReporting', () => {
  it('merges partner lead and partner direct members into direct scope', () => {
    const context = buildReportingContext([
      { UserId: ROOT, UserName: 'Root', Role: 'admin', Status: 'Active', CoachId: null },
      { UserId: PARTNER, UserName: 'Partner', Role: 'admin', Status: 'Active', CoachId: null },
      { UserId: ROOT_MEMBER, UserName: 'Root Member', Role: null, Status: 'Active', CoachId: ROOT },
      { UserId: PARTNER_MEMBER, UserName: 'Partner Member', Role: null, Status: 'Active', CoachId: PARTNER },
      { UserId: PARTNER_NESTED, UserName: 'Partner Nested', Role: null, Status: 'Active', CoachId: PARTNER_MEMBER },
    ]);
    context.partnerRootIds = [PARTNER];

    assert.deepEqual(
      ids(getSharedTeamDirectMembers(ROOT, context)),
      [ROOT_MEMBER, PARTNER, PARTNER_MEMBER],
    );
  });

  it('merges the full partner subtree into full scope', () => {
    const context = buildReportingContext([
      { UserId: ROOT, UserName: 'Root', Role: 'admin', Status: 'Active', CoachId: null },
      { UserId: PARTNER, UserName: 'Partner', Role: 'admin', Status: 'Active', CoachId: null },
      { UserId: ROOT_MEMBER, UserName: 'Root Member', Role: null, Status: 'Active', CoachId: ROOT },
      { UserId: PARTNER_MEMBER, UserName: 'Partner Member', Role: null, Status: 'Active', CoachId: PARTNER },
      { UserId: PARTNER_NESTED, UserName: 'Partner Nested', Role: null, Status: 'Active', CoachId: PARTNER_MEMBER },
    ]);
    context.partnerRootIds = [PARTNER];

    assert.deepEqual(
      ids(getSharedTeamFullMembers(ROOT, context)),
      [ROOT_MEMBER, PARTNER, PARTNER_MEMBER, PARTNER_NESTED],
    );
  });
});
