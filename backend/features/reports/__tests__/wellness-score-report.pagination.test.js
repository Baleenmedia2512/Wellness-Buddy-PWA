/**
 * Run: node --test backend/features/reports/__tests__/wellness-score-report.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WELLNESS_SCORE_REPORT_DEFAULT_PAGE_SIZE,
  normalizeWellnessScoreReportPagination,
  paginateWellnessScoreReportRecords,
  sortWellnessScoreReportRows,
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
    percentage: partial.percentage ?? null,
    totalEarned: partial.totalEarned ?? null,
    wellnessScore: partial.totalEarned ?? partial.wellnessScore ?? null,
    wellnessScorePossible: 1000,
    computedAt: partial.computedAt ?? null,
    sponsor: partial.sponsor ?? null,
    isDirect: partial.isDirect === true,
  };
}

describe('normalizeWellnessScoreReportPagination', () => {
  it('defaults to page 1, limit 10, direct team, score sort desc', () => {
    const p = normalizeWellnessScoreReportPagination({});
    assert.equal(p.page, 1);
    assert.equal(p.limit, WELLNESS_SCORE_REPORT_DEFAULT_PAGE_SIZE);
    assert.equal(p.limit, 10);
    assert.equal(p.teamFilter, TEAM_FILTERS.DIRECT);
    assert.equal(p.sort, SORT_KEYS.SCORE);
    assert.equal(p.sortDir, 'desc');
    assert.equal(p.exportAll, false);
  });

  it('accepts all column sort keys and directions', () => {
    const nameAsc = normalizeWellnessScoreReportPagination({ sort: 'name', sortDir: 'asc' });
    assert.equal(nameAsc.sort, SORT_KEYS.NAME);
    assert.equal(nameAsc.sortDir, 'asc');

    const weight = normalizeWellnessScoreReportPagination({ sort: 'weight' });
    assert.equal(weight.sort, SORT_KEYS.WEIGHT);
    assert.equal(weight.sortDir, 'asc');

    const vs = normalizeWellnessScoreReportPagination({ sort: 'difference', sortDir: 'desc' });
    assert.equal(vs.sort, SORT_KEYS.VS_PREVIOUS);
    assert.equal(vs.sortDir, 'desc');

    const sponsor = normalizeWellnessScoreReportPagination({ sort: 'sponsor_name' });
    assert.equal(sponsor.sort, SORT_KEYS.SPONSOR);
    assert.equal(sponsor.sortDir, 'asc');
  });
});

describe('sortWellnessScoreReportRows', () => {
  it('sorts name A-Z / Z-A', () => {
    const rows = [
      row({ userId: 1, name: 'Priya', isDirect: true }),
      row({ userId: 2, name: 'Asha', isDirect: true }),
      row({ userId: 3, name: 'Zara', isDirect: true }),
    ];
    const asc = sortWellnessScoreReportRows(rows, SORT_KEYS.NAME, 'asc').map((r) => r.name);
    assert.deepEqual(asc, ['Asha', 'Priya', 'Zara']);
    const desc = sortWellnessScoreReportRows(rows, SORT_KEYS.NAME, 'desc').map((r) => r.name);
    assert.deepEqual(desc, ['Zara', 'Priya', 'Asha']);
  });

  it('sorts weight with nulls last in both directions', () => {
    const rows = [
      row({ userId: 1, name: 'A', todayWeight: 80, isDirect: true }),
      row({ userId: 2, name: 'B', todayWeight: null, isDirect: true }),
      row({ userId: 3, name: 'C', todayWeight: 70, isDirect: true }),
    ];
    const lightestFirst = sortWellnessScoreReportRows(rows, SORT_KEYS.WEIGHT, 'asc');
    assert.deepEqual(
      lightestFirst.map((r) => r.todayWeight),
      [70, 80, null],
    );
    const heaviestFirst = sortWellnessScoreReportRows(rows, SORT_KEYS.WEIGHT, 'desc');
    assert.deepEqual(
      heaviestFirst.map((r) => r.todayWeight),
      [80, 70, null],
    );
  });

  it('sorts by weight difference with nulls last', () => {
    const rows = [
      row({ userId: 1, difference: -0.4, isDirect: true }),
      row({ userId: 2, difference: null, isDirect: true }),
      row({ userId: 3, difference: 1.2, isDirect: true }),
    ];
    const desc = sortWellnessScoreReportRows(rows, SORT_KEYS.VS_PREVIOUS, 'desc');
    assert.deepEqual(
      desc.map((r) => r.difference),
      [1.2, -0.4, null],
    );
  });
});

describe('paginateWellnessScoreReportRecords — percentage order', () => {
  const self = row({
    userId: 352,
    name: 'CoachTop',
    totalEarned: 660,
    percentage: 66,
    isDirect: false,
  });
  const members = [
    row({
      userId: 610,
      name: 'Rekha',
      totalEarned: 550,
      percentage: 55,
      computedAt: '2026-08-07T14:00:00.000Z',
      isDirect: true,
    }),
    row({
      userId: 3,
      name: 'bharathi',
      totalEarned: 510,
      percentage: 51,
      computedAt: '2026-08-07T10:00:00.000Z',
      isDirect: true,
    }),
    row({
      userId: 4,
      name: 'Priya',
      totalEarned: 506,
      percentage: 51,
      computedAt: '2026-08-07T12:00:00.000Z',
      isDirect: true,
    }),
  ];

  it('Full Team is downline only — coach is under Mine, not Full', () => {
    const { records, teamScopeCounts } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'full',
      exportAll: true,
    });
    assert.equal(teamScopeCounts.full, 3);
    assert.equal(teamScopeCounts.mine, 1);
    assert.equal(records.length, 3);
    assert.equal(records[0].name, 'Rekha');
    assert.equal(records.every((r) => r.name !== 'CoachTop'), true);
  });

  it('orders by percentage DESC then computed_at DESC on ties', () => {
    const { records } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'direct',
      exportAll: true,
    });
    assert.deepEqual(
      records.map((r) => [r.name, r.percentage]),
      [
        ['Rekha', 55],
        ['Priya', 51],
        ['bharathi', 51],
      ],
    );
  });

  it('pages 10 records with SQL-style meta', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      row({
        userId: i + 1,
        name: `M${i + 1}`,
        percentage: 100 - i,
        totalEarned: 1000 - i * 10,
        isDirect: true,
      }),
    );
    const { records, pagination } = paginateWellnessScoreReportRecords(self, many, {
      teamFilter: 'direct',
      page: 2,
      limit: 10,
    });
    assert.equal(pagination.page, 2);
    assert.equal(pagination.limit, 10);
    assert.equal(pagination.totalRecords, 25);
    assert.equal(pagination.totalPages, 3);
    assert.equal(records.length, 10);
    assert.equal(records[0].percentage, 90);
    assert.equal(pagination.hasNextPage, true);
    assert.equal(pagination.hasPreviousPage, true);
  });
});

describe('computeWeightDifferenceKg', () => {
  it('returns today − previous', () => {
    assert.equal(computeWeightDifferenceKg(72.4, 72.8), -0.4);
    assert.equal(computeWeightDifferenceKg(81.2, 80), 1.2);
  });
});
