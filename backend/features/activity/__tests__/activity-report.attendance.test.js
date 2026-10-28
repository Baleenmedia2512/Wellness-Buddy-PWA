/**
 * Run: node --test backend/features/activity/__tests__/activity-report.attendance.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_REPORT_ATTENDANCE,
  missingActivityUserIds,
  normalizeActivityReportAttendance,
  buildNotPostedSummaryCounts,
  resolveActivityReportTableUserIds,
} from '../domain/activity-report.attendance.js';

describe('normalizeActivityReportAttendance', () => {
  it('defaults missing and unknown values to posted (legacy)', () => {
    assert.equal(normalizeActivityReportAttendance(undefined), ACTIVITY_REPORT_ATTENDANCE.POSTED);
    assert.equal(normalizeActivityReportAttendance(''), ACTIVITY_REPORT_ATTENDANCE.POSTED);
    assert.equal(normalizeActivityReportAttendance('maybe'), ACTIVITY_REPORT_ATTENDANCE.POSTED);
    assert.equal(normalizeActivityReportAttendance('posted'), ACTIVITY_REPORT_ATTENDANCE.POSTED);
  });

  it('accepts legacy attended as posted', () => {
    assert.equal(normalizeActivityReportAttendance('attended'), ACTIVITY_REPORT_ATTENDANCE.POSTED);
  });

  it('accepts not_posted and legacy not_attended spellings', () => {
    assert.equal(
      normalizeActivityReportAttendance('not_posted'),
      ACTIVITY_REPORT_ATTENDANCE.NOT_POSTED,
    );
    assert.equal(
      normalizeActivityReportAttendance('not-posted'),
      ACTIVITY_REPORT_ATTENDANCE.NOT_POSTED,
    );
    assert.equal(
      normalizeActivityReportAttendance('not_attended'),
      ACTIVITY_REPORT_ATTENDANCE.NOT_POSTED,
    );
    assert.equal(
      normalizeActivityReportAttendance('not-attended'),
      ACTIVITY_REPORT_ATTENDANCE.NOT_POSTED,
    );
  });
});

describe('missingActivityUserIds', () => {
  it('returns scoped members who did not log', () => {
    assert.deepEqual(missingActivityUserIds([1, 2, 3, 4], [2, 4]), [1, 3]);
  });

  it('returns the full scope when nobody logged', () => {
    assert.deepEqual(missingActivityUserIds([10, 20], []), [10, 20]);
  });

  it('returns empty when everyone in scope logged', () => {
    assert.deepEqual(missingActivityUserIds([1, 2], [1, 2, 2]), []);
  });

  it('coerces string ids and drops duplicates', () => {
    assert.deepEqual(missingActivityUserIds(['1', 1, '3'], ['1']), [3]);
  });
});

describe('resolveActivityReportTableUserIds', () => {
  it('uses posted ids for the legacy default', () => {
    assert.deepEqual(
      resolveActivityReportTableUserIds('posted', [1, 2, 3], [2]),
      [2],
    );
    assert.deepEqual(
      resolveActivityReportTableUserIds(undefined, [1, 2, 3], [2]),
      [2],
    );
    assert.deepEqual(
      resolveActivityReportTableUserIds('attended', [1, 2, 3], [2]),
      [2],
    );
  });

  it('uses missing ids for not_posted, including when nobody logged', () => {
    assert.deepEqual(
      resolveActivityReportTableUserIds('not_posted', [1, 2, 3], [2]),
      [1, 3],
    );
    assert.deepEqual(
      resolveActivityReportTableUserIds('not_posted', [1, 2], []),
      [1, 2],
    );
    assert.deepEqual(
      resolveActivityReportTableUserIds('not_attended', [1, 2, 3], [2]),
      [1, 3],
    );
  });
});

describe('buildNotPostedSummaryCounts', () => {
  it('counts scope members who did not post each category', () => {
    assert.deepEqual(
      buildNotPostedSummaryCounts(
        { weight: 1, education: 1, breakfast: 3, lunch: 0, dinner: 2, water: 3, calories: 0 },
        [10, 20, 30],
      ),
      {
        weight: 2,
        education: 2,
        breakfast: 0,
        lunch: 3,
        dinner: 1,
        water: 0,
        calories: 3,
      },
    );
  });

  it('treats an empty scope as zero not-posted', () => {
    assert.deepEqual(
      buildNotPostedSummaryCounts({ education: 1 }, []),
      {
        weight: 0,
        education: 0,
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        water: 0,
        calories: 0,
      },
    );
  });

  it('dedupes scope ids and never goes below zero', () => {
    assert.equal(
      buildNotPostedSummaryCounts({ education: 5 }, ['1', 1, 2]).education,
      0,
    );
  });
});
