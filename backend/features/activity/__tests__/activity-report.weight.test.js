import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserWeightRowsAsc,
  collectUserIdsMissingPreviousWeight,
  mergePriorWeightRows,
  parseActivityReportWeightKg,
  resolvePreviousWeightKg,
} from '../domain/activity-report.weight.js';

describe('parseActivityReportWeightKg', () => {
  it('parses finite weights and rejects invalid', () => {
    assert.equal(parseActivityReportWeightKg({ Weight: 72.4 }), 72.4);
    assert.equal(parseActivityReportWeightKg({ Weight: '70.5' }), 70.5);
    assert.equal(parseActivityReportWeightKg({ Weight: null }), null);
    assert.equal(parseActivityReportWeightKg({ Weight: 'N/A' }), null);
    assert.equal(parseActivityReportWeightKg(null), null);
  });
});

describe('resolvePreviousWeightKg', () => {
  const rows = [
    { UserId: 1, Weight: 74, CreatedAt: '2026-11-10 06:00:00' },
    { UserId: 1, Weight: 73, CreatedAt: '2026-11-11 06:00:00' },
    { UserId: 1, Weight: 72.5, CreatedAt: '2026-11-12 06:00:00' },
  ];

  it('returns the latest earlier weight', () => {
    assert.equal(resolvePreviousWeightKg('2026-11-12 06:00:00', rows), 73);
    assert.equal(resolvePreviousWeightKg('2026-11-11 06:00:00', rows), 74);
  });

  it('returns null when there is no earlier log', () => {
    assert.equal(resolvePreviousWeightKg('2026-11-10 06:00:00', rows), null);
    assert.equal(resolvePreviousWeightKg('2026-11-12 06:00:00', []), null);
  });
});

describe('buildUserWeightRowsAsc + mergePriorWeightRows', () => {
  it('groups by user and keeps CreatedAt ascending after prior merge', () => {
    const byUser = buildUserWeightRowsAsc([
      { UserId: 2, Weight: 80, CreatedAt: '2026-11-12 07:00:00' },
      { UserId: 2, Weight: 81, CreatedAt: '2026-11-11 07:00:00' },
    ]);
    mergePriorWeightRows(byUser, [
      { UserId: 2, Weight: 82, CreatedAt: '2026-11-10 07:00:00' },
    ]);
    const list = byUser.get('2');
    assert.equal(list[0].Weight, 82);
    assert.equal(resolvePreviousWeightKg('2026-11-12 07:00:00', list), 81);
    assert.equal(resolvePreviousWeightKg('2026-11-11 07:00:00', list), 82);
  });
});

describe('collectUserIdsMissingPreviousWeight', () => {
  it('lists users whose row has no earlier weight in the map', () => {
    const byUser = buildUserWeightRowsAsc([
      { UserId: 1, Weight: 70, CreatedAt: '2026-11-12 06:00:00' },
      { UserId: 2, Weight: 80, CreatedAt: '2026-11-11 06:00:00' },
      { UserId: 2, Weight: 79, CreatedAt: '2026-11-12 06:00:00' },
    ]);
    const missing = collectUserIdsMissingPreviousWeight([
      { UserId: 1, CreatedAt: '2026-11-12 06:00:00' },
      { UserId: 2, CreatedAt: '2026-11-12 06:00:00' },
    ], byUser);
    assert.deepEqual(missing, [1]);
  });
});
