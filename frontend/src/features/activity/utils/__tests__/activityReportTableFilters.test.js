/**
 * Run: node --test frontend/src/features/activity/utils/__tests__/activityReportTableFilters.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeActivityReportTableFilters,
  activityReportFilterQuery,
  formatActivityReportAttendance,
  formatActivityReportFilterOption,
  normalizeActivityReportTableFilters,
  toggleActivityReportFilterValue,
} from '../activityReportTableFilters.js';

describe('activityReportTableFilters', () => {
  it('omits empty facet values from the query', () => {
    assert.deepEqual(activityReportFilterQuery({ memberType: [], city: [] }), {});
    assert.deepEqual(activityReportFilterQuery({}), {});
  });

  it('sends stacked multi-value filter_<column> params', () => {
    assert.deepEqual(
      activityReportFilterQuery({
        memberType: ['sponsor'],
        city: ['Pune', 'Mumbai'],
        level: [],
      }),
      { filter_memberType: 'sponsor', filter_city: 'Pune|Mumbai' },
    );
  });

  it('normalizes legacy single-string filters to arrays', () => {
    assert.deepEqual(
      normalizeActivityReportTableFilters({ memberType: 'sponsor', city: 'Pune|Delhi' }),
      {
        memberType: ['sponsor'],
        level: [],
        sponsorName: [],
        clubName: [],
        idealCoachName: [],
        city: ['Pune', 'Delhi'],
        village: [],
      },
    );
  });

  it('toggles multi-select values on one column', () => {
    let next = toggleActivityReportFilterValue({}, 'city', 'Pune');
    assert.deepEqual(next.city, ['Pune']);
    next = toggleActivityReportFilterValue(next, 'city', 'Mumbai');
    assert.deepEqual(next.city, ['Pune', 'Mumbai']);
    next = toggleActivityReportFilterValue(next, 'city', 'Pune');
    assert.deepEqual(next.city, ['Mumbai']);
  });

  it('lists one chip per selected value', () => {
    const chips = activeActivityReportTableFilters({
      memberType: ['sponsor'],
      city: ['Pune', 'Mumbai'],
    });
    assert.deepEqual(chips.map((chip) => `${chip.label}:${chip.displayValue}`), [
      'Member Type:Sponsor',
      'City:Pune',
      'City:Mumbai',
    ]);
  });

  it('labels member type and remote club options', () => {
    assert.equal(formatActivityReportFilterOption('memberType', 'sponsor'), 'Sponsor');
    assert.equal(formatActivityReportFilterOption('memberType', 'member'), 'Member');
    assert.equal(formatActivityReportFilterOption('clubName', 'Remote'), 'Remote');
  });

  it('labels attendance filter values', () => {
    assert.equal(formatActivityReportAttendance('attended'), 'Attended');
    assert.equal(formatActivityReportAttendance('not_attended'), 'Not attended');
  });
});
