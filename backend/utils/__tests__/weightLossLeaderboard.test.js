/**
 * Run: node --test backend/utils/__tests__/weightLossLeaderboard.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TEN_DAY_LOSS_KG,
  buildWindowWeightLossCandidates,
} from '../weightLossLeaderboard.js';

describe('buildWindowWeightLossCandidates', () => {
  const toYmd = (ts) => String(ts).slice(0, 10);

  it('ranks net loss from earliest to latest weigh-in across different days', () => {
    const records = [
      { UserId: 1, CreatedAt: '2026-11-16T08:00:00Z', Weight: 70 },
      { UserId: 1, CreatedAt: '2026-11-10T08:00:00Z', Weight: 72.5 },
      { UserId: 2, CreatedAt: '2026-11-16T09:00:00Z', Weight: 80 },
      { UserId: 2, CreatedAt: '2026-11-07T09:00:00Z', Weight: 81 },
    ];
    const candidates = buildWindowWeightLossCandidates(
      records,
      toYmd,
      MAX_TEN_DAY_LOSS_KG,
    );
    candidates.sort((a, b) => b.weightLoss - a.weightLoss);
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].userId, 1);
    assert.equal(candidates[0].weightLoss, 2.5);
    assert.equal(candidates[0].startWeight, 72.5);
    assert.equal(candidates[0].endWeight, 70);
    assert.equal(candidates[1].userId, 2);
    assert.equal(candidates[1].weightLoss, 1);
  });

  it('skips same-day only weigh-ins and gains', () => {
    const records = [
      { UserId: 1, CreatedAt: '2026-11-16T10:00:00Z', Weight: 70 },
      { UserId: 1, CreatedAt: '2026-11-16T08:00:00Z', Weight: 71 },
      { UserId: 2, CreatedAt: '2026-11-16T09:00:00Z', Weight: 82 },
      { UserId: 2, CreatedAt: '2026-11-10T09:00:00Z', Weight: 80 },
    ];
    const candidates = buildWindowWeightLossCandidates(
      records,
      toYmd,
      MAX_TEN_DAY_LOSS_KG,
    );
    assert.equal(candidates.length, 0);
  });

  it('excludes losses above the 10-day plausibility cap', () => {
    const records = [
      { UserId: 1, CreatedAt: '2026-11-16T08:00:00Z', Weight: 60 },
      { UserId: 1, CreatedAt: '2026-11-07T08:00:00Z', Weight: 72 },
    ];
    const candidates = buildWindowWeightLossCandidates(
      records,
      toYmd,
      MAX_TEN_DAY_LOSS_KG,
    );
    assert.equal(candidates.length, 0);
  });

  it('uses newest and oldest rows when multiple exist per user', () => {
    const records = [
      { UserId: 1, CreatedAt: '2026-11-16T12:00:00Z', Weight: 69.2 },
      { UserId: 1, CreatedAt: '2026-11-14T12:00:00Z', Weight: 70 },
      { UserId: 1, CreatedAt: '2026-11-08T12:00:00Z', Weight: 71.2 },
    ];
    const [candidate] = buildWindowWeightLossCandidates(
      records,
      toYmd,
      MAX_TEN_DAY_LOSS_KG,
    );
    assert.equal(candidate.weightLoss, 2);
    assert.equal(candidate.startWeight, 71.2);
    assert.equal(candidate.endWeight, 69.2);
  });
});
