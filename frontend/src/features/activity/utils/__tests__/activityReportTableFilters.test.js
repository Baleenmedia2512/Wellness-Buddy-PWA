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
} from '../activityReportTableFilters.js';

describe('activityReportTableFilters', () => {
  it('omits empty facet values from the query', () => {
    assert.deepEqual(activityReportFilterQuery({ memberType: '', city: '' }), {});
    assert.deepEqual(activityReportFilterQuery({}), {});
  });

  it('sends stacked filter_<column> params', () => {
    assert.deepEqual(
      activityReportFilterQuery({ memberType: 'sponsor', city: 'Pune', level: '' }),
      { filter_memberType: 'sponsor', filter_city: 'Pune' },
    );
  });

  it('lists active chips for marketplace-style filters', () => {
    const chips = activeActivityReportTableFilters({
      memberType: 'sponsor',
      city: 'Pune',
      level: '',
    });
    assert.deepEqual(chips.map((chip) => `${chip.label}:${chip.displayValue}`), [
      'Member Type:Sponsor',
      'City:Pune',
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
