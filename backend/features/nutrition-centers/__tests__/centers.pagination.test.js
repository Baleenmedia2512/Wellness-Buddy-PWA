/**
 * Run: node --test backend/features/nutrition-centers/__tests__/centers.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CENTERS_LIST_DEFAULT_PAGE_SIZE,
  normalizeCentersListPagination,
  paginateCentersListRecords,
  toCentersListSummary,
} from '../domain/centers.pagination.js';

describe('normalizeCentersListPagination', () => {
  it('defaults to page 1 and limit 20', () => {
    const p = normalizeCentersListPagination({});
    assert.equal(p.page, 1);
    assert.equal(p.limit, CENTERS_LIST_DEFAULT_PAGE_SIZE);
    assert.equal(p.search, '');
  });
});

describe('paginateCentersListRecords', () => {
  const centers = Array.from({ length: 55 }, (_, i) => ({
    id: i + 1,
    center_name: i % 3 === 0 ? `Alpha Club ${i}` : `Beta Club ${i}`,
    ownerName: i % 2 === 0 ? 'Coach A' : 'Coach B',
    todayAttendance: i,
    attendancePercentage: i > 0 ? 100 : 0,
    latitude: 12 + i * 0.01,
    longitude: 77 + i * 0.01,
    owner_phone: '9999999999',
    owner_user_id: 100 + i,
    education_hour: '18:00',
    registered_at: '2026-01-01',
    status: 'active',
  }));

  it('returns slim summary fields only', () => {
    const { records } = paginateCentersListRecords(centers, { page: 1, limit: 5 });
    assert.equal(records.length, 5);
    const row = records[0];
    assert.ok('id' in row);
    assert.ok('center_name' in row);
    assert.ok('ownerName' in row);
    assert.ok('todayAttendance' in row);
    assert.ok('latitude' in row);
    assert.ok('longitude' in row);
    assert.equal('registered_at' in row, false);
    assert.equal('status' in row, false);
  });

  it('sorts by attendance DESC', () => {
    const { records } = paginateCentersListRecords(centers, { page: 1, limit: 10 });
    for (let i = 1; i < records.length; i += 1) {
      assert.ok(records[i - 1].todayAttendance >= records[i].todayAttendance);
    }
  });

  it('includes totalAttendance and attendedCenters in meta', () => {
    const { pagination } = paginateCentersListRecords(centers, { page: 1, limit: 20 });
    assert.equal(pagination.totalRecords, 55);
    assert.ok(pagination.totalAttendance > 0);
    assert.equal(
      pagination.attendedCenters.length,
      centers.filter((c) => c.todayAttendance > 0).length,
    );
  });

  it('filters by centre or owner name', () => {
    const { pagination } = paginateCentersListRecords(centers, { search: 'alpha', limit: 100 });
    assert.equal(
      pagination.totalRecords,
      centers.filter((c) => c.center_name.toLowerCase().includes('alpha')).length,
    );
  });
});

describe('toCentersListSummary', () => {
  it('maps required fields', () => {
    const summary = toCentersListSummary({
      id: 1,
      center_name: 'Test',
      ownerName: 'Owner',
      todayAttendance: 3,
      attendancePercentage: 100,
      latitude: 1,
      longitude: 2,
      owner_phone: '1',
      owner_user_id: 9,
      education_hour: null,
      extra: 'drop-me',
    });
    assert.equal(summary.extra, undefined);
    assert.equal(summary.id, 1);
  });
});
