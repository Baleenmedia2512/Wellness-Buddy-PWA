/**
 * Run: node --test frontend/src/features/activity/utils/__tests__/activityReportShareText.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivityReportShareText,
  formatActivityReportLevel,
  formatActivityReportMemberType,
} from '../activityReportShareText.js';

describe('activity report level / member type display', () => {
  it('formats level 0 as 0, not a dash', () => {
    assert.equal(formatActivityReportLevel(0), '0');
    assert.equal(formatActivityReportLevel(2), '2');
    assert.equal(formatActivityReportLevel(null), '—');
  });

  it('formats member type from downline flag, not profile role', () => {
    assert.equal(formatActivityReportMemberType('sponsor'), 'Sponsor');
    assert.equal(formatActivityReportMemberType('member'), 'Customer');
    assert.equal(formatActivityReportMemberType('coach'), 'Customer');
  });

  it('includes member type, sponsor, then level in share lines', () => {
    const text = buildActivityReportShareText({
      activityLabel: 'Weight',
      activityId: 'weight',
      totalRecords: 1,
      records: [{
        memberName: 'Ana',
        level: 1,
        memberType: 'sponsor',
        sponsorName: 'Kiran',
        clubName: 'N/A',
        date: '2026-09-05',
        time: '07:00:00',
        weight: 62,
      }],
    });
    assert.match(text, /Ana \| Sponsor \| Level: 1 \| Sponsor: Kiran/);
  });

  it('includes attendance in the share header', () => {
    const text = buildActivityReportShareText({
      activityLabel: 'Education',
      dateLabel: 'Today',
      scopeLabel: 'Direct Team (3)',
      attendanceLabel: 'Not attended',
      totalRecords: 0,
      records: [],
    });
    assert.match(text, /Period: Today · Team: Direct Team \(3\) · Not attended/);
  });
});
