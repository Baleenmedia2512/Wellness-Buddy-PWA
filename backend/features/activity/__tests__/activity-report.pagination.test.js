/**
 * Run: node --test backend/features/activity/__tests__/activity-report.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_REPORT_DEFAULT_PAGE_SIZE,
  buildActivityReportPaginationMeta,
  filterActivityReportRecords,
  normalizeActivityReportPagination,
  paginateActivityReportRecords,
  slicePreparedActivityReportRows,
  sortActivityReportRecords,
} from '../domain/activity-report.pagination.js';

describe('normalizeActivityReportPagination', () => {
  it('defaults to page 1 and page size 10', () => {
    const p = normalizeActivityReportPagination({});
    assert.equal(p.page, 1);
    assert.equal(p.limit, ACTIVITY_REPORT_DEFAULT_PAGE_SIZE);
    assert.equal(p.sort, 'date');
    assert.equal(p.sortDir, 'desc');
    assert.equal(p.exportAll, false);
  });

  it('caps limit and accepts exportAll', () => {
    const p = normalizeActivityReportPagination({ page: '3', limit: '500', exportAll: '1', search: ' Ana ' });
    assert.equal(p.page, 3);
    assert.equal(p.limit, 100);
    assert.equal(p.exportAll, true);
    assert.equal(p.search, 'ana');
  });
});

describe('filter / sort / paginate', () => {
  const rows = [
    { memberName: 'Alice', phone: '111', city: 'Pune', date: '2026-08-05', time: '08:00:00', weight: 70 },
    { memberName: 'Bob', phone: '222', city: 'Mumbai', date: '2026-08-06', time: '07:30:00', weight: 80 },
    { memberName: 'Ana', phone: '333', city: 'Pune', date: '2026-08-06', time: '09:00:00', weight: 65 },
    { memberName: 'Carol', phone: '444', city: 'Delhi', date: '2026-08-04', time: '06:00:00', weight: 72 },
  ];

  it('filters across name/city/phone', () => {
    const filtered = filterActivityReportRecords(rows, 'pune');
    assert.equal(filtered.length, 2);
  });

  it('sorts by memberName ascending', () => {
    const sorted = sortActivityReportRecords(rows, 'memberName', 'asc');
    assert.deepEqual(sorted.map((r) => r.memberName), ['Alice', 'Ana', 'Bob', 'Carol']);
  });

  it('paginates with metadata (LIMIT/OFFSET semantics)', () => {
    const { records, pagination } = paginateActivityReportRecords(rows, {
      page: 2,
      limit: 2,
      search: '',
      sort: 'memberName',
      sortDir: 'asc',
    });
    assert.equal(records.length, 2);
    assert.deepEqual(records.map((r) => r.memberName), ['Bob', 'Carol']);
    assert.equal(pagination.totalRecords, 4);
    assert.equal(pagination.totalPages, 2);
    assert.equal(pagination.currentPage, 2);
    assert.equal(pagination.pageSize, 2);
    assert.equal(pagination.hasNextPage, false);
    assert.equal(pagination.hasPreviousPage, true);
  });

  it('exportAll returns full filtered set', () => {
    const { records, pagination } = paginateActivityReportRecords(rows, {
      page: 1,
      limit: 2,
      search: 'a',
      sort: 'memberName',
      sortDir: 'asc',
      exportAll: true,
    });
    assert.ok(records.length >= 3);
    assert.equal(pagination.exportAll, true);
    assert.equal(pagination.totalRecords, records.length);
  });

  it('slicePrepared preserves prior sort order', () => {
    const prepared = sortActivityReportRecords(rows, 'weight', 'asc');
    const { records, pagination } = slicePreparedActivityReportRows(prepared, { page: 1, limit: 2 });
    assert.equal(records[0].weight, 65);
    assert.equal(records[1].weight, 70);
    assert.equal(pagination.totalRecords, 4);
  });
});

describe('buildActivityReportPaginationMeta', () => {
  it('clamps current page when beyond last page', () => {
    const meta = buildActivityReportPaginationMeta(20, 99, 10);
    assert.equal(meta.currentPage, 2);
    assert.equal(meta.totalPages, 2);
    assert.equal(meta.hasNextPage, false);
  });
});
