/**
 * Run: node --test backend/features/reports/__tests__/wellness-score-report.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WELLNESS_SCORE_REPORT_DEFAULT_PAGE_SIZE,
  normalizeWellnessScoreReportPagination,
  paginateWellnessScoreReportRecords,
  TEAM_FILTERS,
  SORT_KEYS,
} from '../domain/wellness-score-report.pagination.js';

function row(partial) {
  return {
    userId: partial.userId,
    name: partial.name || `User ${partial.userId}`,
    todayWeight: partial.todayWeight ?? null,
    previousWeight: partial.previousWeight ?? null,
    wellnessScore: partial.wellnessScore ?? null,
    wellnessScorePossible: 100,
    sponsor: partial.sponsor ?? null,
    coach: partial.coach ?? null,
    isDirect: partial.isDirect === true,
  };
}

describe('normalizeWellnessScoreReportPagination', () => {
  it('defaults to page 1, limit 20, direct team, name sort', () => {
    const p = normalizeWellnessScoreReportPagination({});
    assert.equal(p.page, 1);
    assert.equal(p.limit, WELLNESS_SCORE_REPORT_DEFAULT_PAGE_SIZE);
    assert.equal(p.teamFilter, TEAM_FILTERS.DIRECT);
    assert.equal(p.sort, SORT_KEYS.NAME);
    assert.equal(p.exportAll, false);
  });

  it('accepts exportAll and caps limit', () => {
    assert.equal(normalizeWellnessScoreReportPagination({ exportAll: 'true' }).exportAll, true);
    assert.equal(normalizeWellnessScoreReportPagination({ limit: 9999 }).limit, 100);
  });
});

describe('paginateWellnessScoreReportRecords', () => {
  const self = row({ userId: 1, name: 'Coach', wellnessScore: 90, isDirect: false });
  const members = [
    row({
      userId: 2,
      name: 'Alice',
      todayWeight: 72.4,
      previousWeight: 72.8,
      wellnessScore: 92,
      sponsor: 'Michael',
      coach: 'David',
      isDirect: true,
    }),
    row({
      userId: 3,
      name: 'Bob',
      todayWeight: 80,
      previousWeight: 79,
      wellnessScore: 70,
      isDirect: true,
    }),
    row({ userId: 4, name: 'Cara', wellnessScore: 50, isDirect: false }),
    ...Array.from({ length: 25 }, (_, i) =>
      row({
        userId: 100 + i,
        name: `Member ${String(i).padStart(2, '0')}`,
        wellnessScore: 60 + i,
        isDirect: false,
      }),
    ),
  ];

  it('returns first page of 20 for full team', () => {
    const { records, pagination, teamScopeCounts } = paginateWellnessScoreReportRecords(
      self,
      members,
      { teamFilter: 'full', page: 1, limit: 20 },
    );
    assert.equal(records.length, 20);
    assert.equal(pagination.hasNextPage, true);
    assert.equal(teamScopeCounts.direct, 2);
    assert.equal(teamScopeCounts.full, members.length);
    assert.equal(records[0].name, 'Alice');
  });

  it('exportAll returns every filtered row in one response', () => {
    const { records, pagination } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'direct',
      exportAll: true,
    });
    assert.equal(records.length, 2);
    assert.equal(pagination.hasNextPage, false);
    assert.deepEqual(
      records.map((r) => r.userId),
      [2, 3],
    );
  });

  it('searches by name / sponsor / coach', () => {
    const { records } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'full',
      search: 'michael',
      exportAll: true,
    });
    assert.equal(records.length, 1);
    assert.equal(records[0].name, 'Alice');
  });

  it('sorts by wellness score descending', () => {
    const { records } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'direct',
      sort: 'score',
      exportAll: true,
    });
    assert.equal(records[0].name, 'Alice');
    assert.equal(records[1].name, 'Bob');
  });
});
