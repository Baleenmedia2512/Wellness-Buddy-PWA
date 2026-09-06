/**
 * Run: node --test backend/features/activity/__tests__/activity-report.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_REPORT_CLUB_REMOTE,
  ACTIVITY_REPORT_DEFAULT_PAGE_SIZE,
  buildActivityReportPaginationMeta,
  collectActivityReportClubNames,
  collectActivityReportFilterOptions,
  filterActivityReportRecords,
  filterActivityReportRecordsByClub,
  filterActivityReportRecordsByColumn,
  normalizeActivityReportPagination,
  paginateActivityReportRecords,
  slicePreparedActivityReportRows,
  sortActivityReportRecords,
} from '../domain/activity-report.pagination.js';

describe('normalizeActivityReportPagination', () => {
  it('defaults to page 1 and page size 20', () => {
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

  it('accepts clubName filter', () => {
    const p = normalizeActivityReportPagination({ clubName: ' Pune Club ' });
    assert.equal(p.clubFilter, 'Pune Club');
  });

  it('accepts table column filter', () => {
    const p = normalizeActivityReportPagination({
      filterColumn: 'memberType',
      filterValue: 'sponsor',
    });
    assert.equal(p.filterColumn, 'memberType');
    assert.equal(p.filterValue, 'sponsor');
    assert.deepEqual(p.columnFilters, { memberType: 'sponsor' });
  });

  it('ignores unknown filter columns', () => {
    const p = normalizeActivityReportPagination({
      filterColumn: 'role',
      filterValue: 'coach',
    });
    assert.equal(p.filterColumn, '');
    assert.equal(p.filterValue, '');
    assert.deepEqual(p.columnFilters, {});
  });

  it('stacks multiple filter_<column> params with AND', () => {
    const p = normalizeActivityReportPagination({
      filter_memberType: 'sponsor',
      filter_level: '1',
      filter_city: 'Pune',
    });
    assert.deepEqual(p.columnFilters, {
      memberType: 'sponsor',
      level: '1',
      city: 'Pune',
    });
  });
});

describe('club filter', () => {
  const rows = [
    { memberName: 'Alice', clubName: 'Club A', date: '2026-08-05' },
    { memberName: 'Bob', clubName: 'Club B', date: '2026-08-06' },
    { memberName: 'Carol', clubName: 'N/A', date: '2026-08-04' },
  ];

  it('returns all rows when club filter is empty', () => {
    assert.equal(filterActivityReportRecordsByClub(rows, '').length, 3);
  });

  it('filters by exact club name (case-insensitive)', () => {
    const filtered = filterActivityReportRecordsByClub(rows, 'club a');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].memberName, 'Alice');
  });

  it('filters remote rows with ACTIVITY_REPORT_CLUB_REMOTE', () => {
    const filtered = filterActivityReportRecordsByClub(rows, ACTIVITY_REPORT_CLUB_REMOTE);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].memberName, 'Carol');
  });

  it('collects unique sorted club names with Remote last', () => {
    assert.deepEqual(collectActivityReportClubNames(rows), ['Club A', 'Club B', 'Remote']);
  });

  it('paginates with club filter before search', () => {
    const { records, pagination } = paginateActivityReportRecords(rows, {
      page: 1,
      limit: 10,
      search: '',
      sort: 'memberName',
      sortDir: 'asc',
      clubFilter: 'Club B',
    });
    assert.equal(records.length, 1);
    assert.equal(records[0].memberName, 'Bob');
    assert.equal(pagination.totalRecords, 1);
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

  it('filters by member type without using profile role', () => {
    const typed = [
      { memberName: 'Alice', memberType: 'sponsor', date: '2026-08-05' },
      { memberName: 'Bob', memberType: 'member', date: '2026-08-06' },
    ];
    const filtered = filterActivityReportRecords(typed, 'sponsor');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].memberName, 'Alice');
  });

  it('filters by table column memberType and level', () => {
    const typed = [
      { memberName: 'Alice', memberType: 'sponsor', level: 1, date: '2026-08-05' },
      { memberName: 'Bob', memberType: 'member', level: 2, date: '2026-08-06' },
    ];
    const sponsors = filterActivityReportRecordsByColumn(typed, 'memberType', 'sponsor');
    assert.deepEqual(sponsors.map((r) => r.memberName), ['Alice']);
    const levelTwo = filterActivityReportRecordsByColumn(typed, 'level', '2');
    assert.deepEqual(levelTwo.map((r) => r.memberName), ['Bob']);
  });

  it('applies stacked column filters with AND', () => {
    const typed = [
      { memberName: 'Alice', memberType: 'sponsor', level: 1, city: 'Pune', date: '2026-08-05' },
      { memberName: 'Bob', memberType: 'sponsor', level: 2, city: 'Pune', date: '2026-08-06' },
      { memberName: 'Carol', memberType: 'member', level: 1, city: 'Pune', date: '2026-08-04' },
    ];
    const { records, pagination } = paginateActivityReportRecords(typed, {
      page: 1,
      limit: 20,
      search: '',
      sort: 'memberName',
      sortDir: 'asc',
      filter_memberType: 'sponsor',
      filter_city: 'Pune',
    });
    assert.deepEqual(records.map((r) => r.memberName), ['Alice', 'Bob']);
    assert.equal(pagination.totalRecords, 2);
    assert.equal(pagination.pageSize, 20);
  });

  it('collects column filter options from rows', () => {
    const options = collectActivityReportFilterOptions([
      { memberType: 'sponsor', level: 1, sponsorName: 'Adhithya', clubName: 'N/A', city: 'Pune' },
      { memberType: 'member', level: 2, sponsorName: 'Adhithya', clubName: 'Club A', city: 'N/A' },
    ]);
    assert.deepEqual(options.memberType, ['member', 'sponsor']);
    assert.deepEqual(options.level, ['1', '2']);
    assert.deepEqual(options.sponsorName, ['Adhithya']);
    assert.ok(options.clubName.includes('Club A'));
    assert.ok(options.clubName.includes('Remote'));
    assert.deepEqual(options.city, ['Pune']);
  });

  it('sorts by level numeric and memberType alpha', () => {
    const typed = [
      { memberName: 'Alice', level: 2, memberType: 'sponsor', date: '2026-08-05' },
      { memberName: 'Bob', level: 1, memberType: 'member', date: '2026-08-06' },
      { memberName: 'Carol', level: 3, memberType: 'member', date: '2026-08-04' },
    ];
    assert.deepEqual(
      sortActivityReportRecords(typed, 'level', 'asc').map((r) => r.memberName),
      ['Bob', 'Alice', 'Carol'],
    );
    assert.deepEqual(
      sortActivityReportRecords(typed, 'memberType', 'asc').map((r) => r.memberName),
      ['Bob', 'Carol', 'Alice'],
    );
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
