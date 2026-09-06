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
  it('defaults missing and unknown values to attended (legacy)', () => {
    assert.equal(normalizeActivityReportAttendance(undefined), ACTIVITY_REPORT_ATTENDANCE.ATTENDED);
    assert.equal(normalizeActivityReportAttendance(''), ACTIVITY_REPORT_ATTENDANCE.ATTENDED);
    assert.equal(normalizeActivityReportAttendance('maybe'), ACTIVITY_REPORT_ATTENDANCE.ATTENDED);
    assert.equal(normalizeActivityReportAttendance('attended'), ACTIVITY_REPORT_ATTENDANCE.ATTENDED);
  });

  it('accepts not_attended spellings', () => {
    assert.equal(
      normalizeActivityReportAttendance('not_attended'),
      ACTIVITY_REPORT_ATTENDANCE.NOT_ATTENDED,
    );
    assert.equal(
      normalizeActivityReportAttendance('not-attended'),
      ACTIVITY_REPORT_ATTENDANCE.NOT_ATTENDED,
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
  it('uses attended ids for the legacy default', () => {
    assert.deepEqual(
      resolveActivityReportTableUserIds('attended', [1, 2, 3], [2]),
      [2],
    );
    assert.deepEqual(
      resolveActivityReportTableUserIds(undefined, [1, 2, 3], [2]),
      [2],
    );
  });

  it('uses missing ids for not_attended, including when nobody logged', () => {
    assert.deepEqual(
      resolveActivityReportTableUserIds('not_attended', [1, 2, 3], [2]),
      [1, 3],
    );
    assert.deepEqual(
      resolveActivityReportTableUserIds('not_attended', [1, 2], []),
      [1, 2],
    );
  });
});
