/**
 * Run: node --test backend/features/reports/__tests__/downline-weight.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOWNLINE_WEIGHT_DEFAULT_PAGE_SIZE,
  normalizeDownlineWeightPagination,
  buildDownlineWeightPaginationMeta,
  applyTeamFilter,
  filterRowsByStatusFilter,
  filterRowsBySearch,
  paginateDownlineWeightRecords,
  TEAM_FILTERS,
  STATUS_FILTERS,
} from '../domain/downline-weight.pagination.js';

function row(partial) {
  return {
    userId: partial.userId,
    userName: partial.userName || `User ${partial.userId}`,
    currentWeight: partial.currentWeight ?? null,
    idealMin: partial.idealMin ?? 50,
    idealMax: partial.idealMax ?? 60,
    status: partial.status,
    isDirect: partial.isDirect === true,
    coachId: partial.coachId ?? 1,
    reportsToCoachId: partial.reportsToCoachId ?? 1,
    teamPerformance: partial.teamPerformance ?? null,
    lastUpdated: partial.lastUpdated ?? null,
  };
}

describe('normalizeDownlineWeightPagination', () => {
  it('defaults to page 1, limit 20, direct team, off_track', () => {
    const p = normalizeDownlineWeightPagination({});
    assert.equal(p.page, 1);
    assert.equal(p.limit, DOWNLINE_WEIGHT_DEFAULT_PAGE_SIZE);
    assert.equal(p.teamFilter, TEAM_FILTERS.DIRECT);
    assert.equal(p.statusFilter, STATUS_FILTERS.OFF_TRACK);
    assert.equal(p.search, '');
    assert.equal(p.sort, 'status');
  });

  it('accepts teamFilter aliases and statusFilter labels', () => {
    assert.equal(
      normalizeDownlineWeightPagination({ teamFilter: 'full', statusFilter: 'On Track' }).statusFilter,
      STATUS_FILTERS.ON_TRACK,
    );
    assert.equal(
      normalizeDownlineWeightPagination({ teamScope: 'mine', statusFilter: 'No Data' }).teamFilter,
      TEAM_FILTERS.MINE,
    );
  });

  it('caps limit at max page size', () => {
    assert.equal(normalizeDownlineWeightPagination({ limit: 9999 }).limit, 100);
  });
});

describe('paginateDownlineWeightRecords', () => {
  const self = row({ userId: 1, userName: 'Coach', status: 'on_track', isDirect: false });
  const members = [
    row({ userId: 2, userName: 'Alice', status: 'above_ideal', isDirect: true, currentWeight: 80, idealMax: 70 }),
    row({ userId: 3, userName: 'Bob', status: 'on_track', isDirect: true, currentWeight: 55 }),
    row({ userId: 4, userName: 'Cara', status: 'no_weight', isDirect: false }),
    row({ userId: 5, userName: 'Dan', status: 'below_ideal', isDirect: false, currentWeight: 40, idealMin: 50 }),
    ...Array.from({ length: 40 }, (_, i) =>
      row({
        userId: 100 + i,
        userName: `Member ${i}`,
        status: i % 2 === 0 ? 'above_ideal' : 'on_track',
        isDirect: false,
        currentWeight: 70 + i,
      }),
    ),
  ];

  it('returns first page of 20 for full + all', () => {
    const { records, pagination, statusCounts, teamScopeCounts } = paginateDownlineWeightRecords(
      self,
      members,
      { teamFilter: 'full', statusFilter: 'all', page: 1, limit: 20 },
    );
    assert.equal(records.length, 20);
    assert.equal(pagination.totalRecords, members.length);
    assert.equal(pagination.hasNextPage, true);
    assert.equal(pagination.page, 1);
    assert.equal(pagination.limit, 20);
    assert.equal(teamScopeCounts.full, members.length);
    assert.equal(teamScopeCounts.direct, 2);
    assert.equal(teamScopeCounts.mine, 1);
    assert.equal(statusCounts.all, members.length);
  });

  it('scopes to direct + off_track and paginates', () => {
    const { records, pagination, statusCounts } = paginateDownlineWeightRecords(self, members, {
      teamFilter: 'direct',
      statusFilter: 'off_track',
      page: 1,
      limit: 20,
    });
    assert.equal(statusCounts.off_track, 1);
    assert.equal(statusCounts.on_track, 1);
    assert.equal(pagination.totalRecords, 1);
    assert.equal(records.length, 1);
    assert.equal(records[0].userName, 'Alice');
    assert.equal(records[0].difference, 10);
  });

  it('mine scope returns only self when status matches', () => {
    const { records, pagination } = paginateDownlineWeightRecords(self, members, {
      teamFilter: 'mine',
      statusFilter: 'on_track',
    });
    assert.equal(pagination.totalRecords, 1);
    assert.equal(records[0].userId, 1);
  });

  it('filters by search name', () => {
    const { records, pagination } = paginateDownlineWeightRecords(self, members, {
      teamFilter: 'full',
      statusFilter: 'all',
      search: 'ali',
      limit: 20,
    });
    assert.equal(pagination.totalRecords, 1);
    assert.equal(records[0].userName, 'Alice');
  });

  it('returns page 3 remainder for large full/all lists', () => {
    const { records, pagination } = paginateDownlineWeightRecords(self, members, {
      teamFilter: 'full',
      statusFilter: 'all',
      page: 3,
      limit: 20,
    });
    assert.equal(pagination.totalRecords, 44);
    assert.equal(records.length, 4);
    assert.equal(pagination.hasNextPage, false);
  });
});

describe('applyTeamFilter / status / search helpers', () => {
  const self = row({ userId: 1, status: 'on_track' });
  const members = [
    row({ userId: 2, status: 'above_ideal', isDirect: true, userName: 'Zed' }),
    row({ userId: 3, status: 'on_track', isDirect: false, userName: 'Ann' }),
  ];

  it('applies team scopes', () => {
    assert.equal(applyTeamFilter(self, members, TEAM_FILTERS.MINE).length, 1);
    assert.equal(applyTeamFilter(self, members, TEAM_FILTERS.DIRECT).length, 1);
    assert.equal(applyTeamFilter(self, members, TEAM_FILTERS.FULL).length, 2);
  });

  it('filters status and search', () => {
    assert.equal(filterRowsByStatusFilter(members, STATUS_FILTERS.OFF_TRACK).length, 1);
    assert.equal(filterRowsBySearch(members, 'ann').length, 1);
  });
});

describe('buildDownlineWeightPaginationMeta', () => {
  it('clamps current page to totalPages', () => {
    const meta = buildDownlineWeightPaginationMeta(10, 99, 20);
    assert.equal(meta.currentPage, 1);
    assert.equal(meta.page, 1);
    assert.equal(meta.totalPages, 1);
  });
});
