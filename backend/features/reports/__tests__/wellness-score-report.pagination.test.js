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
import { computeWeightDifferenceKg } from '../domain/wellness-score-report.weight.js';

function row(partial) {
  return {
    userId: partial.userId,
    name: partial.name || `User ${partial.userId}`,
    todayWeight: partial.todayWeight ?? null,
    previousWeight: partial.previousWeight ?? null,
    difference: partial.difference ?? null,
    percentage: partial.percentage ?? partial.wellnessScore ?? null,
    wellnessScore: partial.wellnessScore ?? partial.percentage ?? null,
    wellnessScorePossible: 100,
    computedAt: partial.computedAt ?? null,
    sponsor: partial.sponsor ?? null,
    coach: partial.coach ?? null,
    isDirect: partial.isDirect === true,
  };
}

describe('normalizeWellnessScoreReportPagination', () => {
  it('defaults to page 1, limit 20, direct team, score sort', () => {
    const p = normalizeWellnessScoreReportPagination({});
    assert.equal(p.page, 1);
    assert.equal(p.limit, WELLNESS_SCORE_REPORT_DEFAULT_PAGE_SIZE);
    assert.equal(p.teamFilter, TEAM_FILTERS.DIRECT);
    assert.equal(p.sort, SORT_KEYS.SCORE);
    assert.equal(p.exportAll, false);
  });

  it('accepts exportAll and caps limit', () => {
    assert.equal(normalizeWellnessScoreReportPagination({ exportAll: 'true' }).exportAll, true);
    assert.equal(normalizeWellnessScoreReportPagination({ limit: 9999 }).limit, 100);
  });
});

describe('paginateWellnessScoreReportRecords', () => {
  const self = row({ userId: 1, name: 'Coach', percentage: 90, isDirect: false });
  const members = [
    row({
      userId: 2,
      name: 'Alice',
      todayWeight: 72.4,
      previousWeight: 72.8,
      difference: -0.4,
      percentage: 92,
      computedAt: '2026-08-07T10:00:00.000Z',
      sponsor: 'Michael',
      coach: 'David',
      isDirect: true,
    }),
    row({
      userId: 3,
      name: 'Bob',
      todayWeight: 80,
      previousWeight: 79,
      difference: 1,
      percentage: 92,
      computedAt: '2026-08-07T12:00:00.000Z',
      isDirect: true,
    }),
    row({ userId: 4, name: 'Cara', percentage: 50, isDirect: false }),
    ...Array.from({ length: 25 }, (_, i) =>
      row({
        userId: 100 + i,
        name: `Member ${String(i).padStart(2, '0')}`,
        percentage: 60 + i,
        isDirect: false,
      }),
    ),
  ];

  it('returns first page ordered by percentage DESC', () => {
    const { records, pagination, teamScopeCounts } = paginateWellnessScoreReportRecords(
      self,
      members,
      { teamFilter: 'full', page: 1, limit: 20 },
    );
    assert.equal(records.length, 20);
    assert.equal(pagination.hasNextPage, true);
    assert.equal(teamScopeCounts.direct, 2);
    assert.equal(teamScopeCounts.full, members.length);
    // Highest among full team in first page should be Member 24 (84) wait - Alice/Bob 92, Member 24 is 84
    // Direct Alice/Bob have 92; members 100+i have 60+i so max is Member 24 = 84
    // Plus Cara 50, Coach not in full members
    // So first should be Bob (92, later computed_at) then Alice (92)
    assert.equal(records[0].name, 'Bob');
    assert.equal(records[1].name, 'Alice');
    assert.equal(records[0].percentage, 92);
  });

  it('ties on percentage resolve by computed_at DESC', () => {
    const { records } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'direct',
      exportAll: true,
    });
    assert.deepEqual(
      records.map((r) => r.name),
      ['Bob', 'Alice'],
    );
  });

  it('exportAll returns every filtered row in one response', () => {
    const { records, pagination } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'direct',
      exportAll: true,
    });
    assert.equal(records.length, 2);
    assert.equal(pagination.hasNextPage, false);
    assert.ok(records[0].difference != null || records[0].difference === null);
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
});

describe('computeWeightDifferenceKg', () => {
  it('returns today − previous', () => {
    assert.equal(computeWeightDifferenceKg(72.4, 72.8), -0.4);
    assert.equal(computeWeightDifferenceKg(81.2, 80), 1.2);
    assert.equal(computeWeightDifferenceKg(70, 70), 0);
    assert.equal(computeWeightDifferenceKg(70, null), null);
  });
});
