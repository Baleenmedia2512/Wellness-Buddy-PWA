/**
 * Run: node --test backend/features/activity/__tests__/activity-report.attendance.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_REPORT_ATTENDANCE,
  missingActivityUserIds,
  normalizeActivityReportAttendance,
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
