/**
 * Pure day-split for hierarchy weight leaderboard (yesterday→today range fetch).
 * Run: node --test backend/pages/api/leaderboard/__tests__/leaderboardWeightDaySplit.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirror of get-global-leaderboard day maps (latest CreatedAt first).
 * @param {Array<{ UserId: number, CreatedAt: string, Weight: number }>} records
 * @param {string} todayYmd
 * @param {string} yesterdayYmd
 * @param {(ts: string) => string|null} toYmd
 */
export function splitWeightsByIstDay(records, todayYmd, yesterdayYmd, toYmd) {
  const todayWeightMap = new Map();
  const yesterdayWeightMap = new Map();
  for (const record of records || []) {
    const dayYmd = toYmd(record.CreatedAt);
    if (!dayYmd) continue;
    if (dayYmd === todayYmd) {
      if (!todayWeightMap.has(record.UserId)) {
        todayWeightMap.set(record.UserId, record);
      }
    } else if (dayYmd === yesterdayYmd) {
      if (!yesterdayWeightMap.has(record.UserId)) {
        yesterdayWeightMap.set(record.UserId, record);
      }
    }
  }
  return { todayWeightMap, yesterdayWeightMap };
}

describe('splitWeightsByIstDay', () => {
  const toYmd = (ts) => String(ts).slice(0, 10);

  it('keeps latest row per user per day when records are newest-first', () => {
    const records = [
      { UserId: 1, CreatedAt: '2026-10-14T10:00:00Z', Weight: 70 },
      { UserId: 1, CreatedAt: '2026-10-14T08:00:00Z', Weight: 71 },
      { UserId: 1, CreatedAt: '2026-10-13T09:00:00Z', Weight: 72 },
      { UserId: 2, CreatedAt: '2026-10-13T11:00:00Z', Weight: 80 },
    ];
    const { todayWeightMap, yesterdayWeightMap } = splitWeightsByIstDay(
      records,
      '2026-10-14',
      '2026-10-13',
      toYmd,
    );
    assert.equal(todayWeightMap.get(1).Weight, 70);
    assert.equal(yesterdayWeightMap.get(1).Weight, 72);
    assert.equal(yesterdayWeightMap.has(2), true);
    assert.equal(todayWeightMap.has(2), false);
  });

  it('skips rows with unknown calendar day', () => {
    const { todayWeightMap } = splitWeightsByIstDay(
      [{ UserId: 1, CreatedAt: 'bad', Weight: 70 }],
      '2026-10-14',
      '2026-10-13',
      () => null,
    );
    assert.equal(todayWeightMap.size, 0);
  });
});
