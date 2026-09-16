/**
 * Run: node --test frontend/src/features/activity/utils/__tests__/activityReportTableFilters.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeActivityReportTableFilters,
  activityReportFilterQuery,
  ACTIVITY_REPORT_ATTENDANCE,
  ACTIVITY_REPORT_ATTENDANCE_OPTIONS,
  formatActivityReportAttendance,
  formatActivityReportFilterOption,
  normalizeActivityReportTableFilters,
  toggleActivityReportFilterValue,
} from '../activityReportTableFilters.js';

describe('activityReportTableFilters', () => {
  it('omits empty facet values from the query', () => {
    assert.deepEqual(activityReportFilterQuery({ memberType: [], clubName: [] }), {});
    assert.deepEqual(activityReportFilterQuery({}), {});
  });

  it('sends stacked multi-value filter_<column> params', () => {
    assert.deepEqual(
      activityReportFilterQuery({
        memberType: ['sponsor'],
        clubName: ['Club A', 'Remote'],
        level: [],
      }),
      { filter_memberType: 'sponsor', filter_clubName: 'Club A|Remote' },
    );
  });

  it('ignores removed facet columns (sponsor/city/village/coach)', () => {
    assert.deepEqual(
      activityReportFilterQuery({
        memberType: ['sponsor'],
        city: ['Pune'],
        sponsorName: ['Adhithya'],
        idealCoachName: ['Coach'],
        village: ['X'],
      }),
      { filter_memberType: 'sponsor' },
    );
  });

  it('normalizes legacy single-string filters to arrays', () => {
    assert.deepEqual(
      normalizeActivityReportTableFilters({ memberType: 'sponsor', clubName: 'Club A|Remote' }),
      {
        memberType: ['sponsor'],
        level: [],
        clubName: ['Club A', 'Remote'],
      },
    );
  });

  it('toggles multi-select values on one column', () => {
    let next = toggleActivityReportFilterValue({}, 'clubName', 'Club A');
    assert.deepEqual(next.clubName, ['Club A']);
    next = toggleActivityReportFilterValue(next, 'clubName', 'Remote');
    assert.deepEqual(next.clubName, ['Club A', 'Remote']);
    next = toggleActivityReportFilterValue(next, 'clubName', 'Club A');
    assert.deepEqual(next.clubName, ['Remote']);
  });

  it('lists one chip per selected value', () => {
    const chips = activeActivityReportTableFilters({
      memberType: ['sponsor'],
      clubName: ['Club A', 'Remote'],
    });
    assert.deepEqual(chips.map((chip) => `${chip.label}:${chip.displayValue}`), [
      'Type:Sponsor',
      'Club:Club A',
      'Club:Remote',
    ]);
  });

  it('labels member type and remote club options', () => {
    assert.equal(formatActivityReportFilterOption('memberType', 'sponsor'), 'Sponsor');
    assert.equal(formatActivityReportFilterOption('memberType', 'member'), 'Customer');
    assert.equal(formatActivityReportFilterOption('clubName', 'Remote'), 'Remote');
  });

  it('labels attendance filter values', () => {
    assert.equal(formatActivityReportAttendance('posted'), 'Posted');
    assert.equal(formatActivityReportAttendance('not_posted'), 'Not Posted');
    assert.equal(formatActivityReportAttendance('attended'), 'Posted');
    assert.equal(formatActivityReportAttendance('not_attended'), 'Not Posted');
  });

  it('keeps Posted / Not Posted option ids aligned with the API', () => {
    assert.equal(ACTIVITY_REPORT_ATTENDANCE.POSTED, 'posted');
    assert.equal(ACTIVITY_REPORT_ATTENDANCE.NOT_POSTED, 'not_posted');
    assert.deepEqual(
      ACTIVITY_REPORT_ATTENDANCE_OPTIONS.map((option) => option.id),
      ['posted', 'not_posted'],
    );
    assert.notEqual(
      ACTIVITY_REPORT_ATTENDANCE_OPTIONS[0].id,
      ACTIVITY_REPORT_ATTENDANCE_OPTIONS[1].id,
    );
  });
});
