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
    percentage: partial.percentage ?? null,
    totalEarned: partial.totalEarned ?? null,
    wellnessScore: partial.totalEarned ?? partial.wellnessScore ?? null,
    wellnessScorePossible: 1000,
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
});

describe('paginateWellnessScoreReportRecords — total_earned order', () => {
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

  it('Full Team includes self so coach 660 ranks above downline 550', () => {
    const { records, teamScopeCounts } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'full',
      exportAll: true,
    });
    assert.equal(teamScopeCounts.full, 4);
    assert.equal(records[0].name, 'CoachTop');
    assert.equal(records[0].totalEarned, 660);
    assert.equal(records[1].name, 'Rekha');
    assert.equal(records[1].totalEarned, 550);
  });

  it('orders downline by total_earned DESC even when percentage ties', () => {
    const { records } = paginateWellnessScoreReportRecords(self, members, {
      teamFilter: 'direct',
      exportAll: true,
    });
    assert.deepEqual(
      records.map((r) => [r.name, r.totalEarned]),
      [
        ['Rekha', 550],
        ['bharathi', 510],
        ['Priya', 506],
      ],
    );
  });
});

describe('computeWeightDifferenceKg', () => {
  it('returns today − previous', () => {
    assert.equal(computeWeightDifferenceKg(72.4, 72.8), -0.4);
    assert.equal(computeWeightDifferenceKg(81.2, 80), 1.2);
  });
});
