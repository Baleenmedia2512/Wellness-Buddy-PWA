/**
 * Run: node --test frontend/src/features/activity/utils/__tests__/activityReportShareText.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivityReportShareText,
  formatActivityReportLevel,
  formatActivityReportMemberType,
  formatActivityReportTime,
} from '../activityReportShareText.js';

describe('formatActivityReportTime', () => {
  it('formats 24h Reg. Time as 12h like Diary', () => {
    assert.equal(formatActivityReportTime('16:33:19'), '4:33 PM');
    assert.equal(formatActivityReportTime('07:00:00'), '7:00 AM');
    assert.equal(formatActivityReportTime('00:05:00'), '12:05 AM');
    assert.equal(formatActivityReportTime('12:00:00'), '12:00 PM');
  });
});

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

  it('includes member type, club, then sponsor in share lines', () => {
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
    assert.match(text, /Ana \| Sponsor \| Level: 1 \| Club: Remote \| Sponsor: Kiran/);
    assert.match(text, /2026-09-05 7:00 AM/);
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
