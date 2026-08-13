/**
 * @jest-environment node
 */
import {
  recordDashboardActivity,
  __resetHomeDashboardActivityForTests,
} from '../../../../shared/services/homeDashboardActivity';
import {
  seedDailyWellnessScoreCache,
  getDailyWellnessScoreCached,
  invalidateDailyWellnessScoreCache,
  getPinnedDailyWellnessScore,
  subscribeDailyWellnessScoreSeed,
  __resetDailyWellnessScoreCacheForTests,
} from '../dailyWellnessScoreCache';

describe('dailyWellnessScoreCache sheet→Home pin', () => {
  beforeEach(() => {
    __resetHomeDashboardActivityForTests();
    __resetDailyWellnessScoreCacheForTests();
  });

  test('restores sheet seed across invalidate when activity watermark matches', () => {
    recordDashboardActivity('wellness-score-closed');
    const score = { totalEarned: 349, totalPossible: 400, percentage: 87 };
    seedDailyWellnessScoreCache('42', '2026-08-10', score);

    invalidateDailyWellnessScoreCache();

    expect(getDailyWellnessScoreCached('42', '2026-08-10')).toEqual(score);
    expect(getPinnedDailyWellnessScore()?.score.totalEarned).toBe(349);
  });

  test('does not restore a stale seed after a newer food activity', () => {
    recordDashboardActivity('wellness-score-closed');
    seedDailyWellnessScoreCache('42', '2026-08-10', {
      totalEarned: 349,
      totalPossible: 400,
      percentage: 87,
    });

    recordDashboardActivity('capture-food-saved');
    invalidateDailyWellnessScoreCache();

    expect(getDailyWellnessScoreCached('42', '2026-08-10')).toBeNull();
  });

  test('reads a date match when userId is not ready yet', () => {
    seedDailyWellnessScoreCache('339', '2026-08-13', { totalEarned: 496 });
    expect(getDailyWellnessScoreCached(null, '2026-08-13').totalEarned).toBe(496);
  });
    const seen = [];
    const unsub = subscribeDailyWellnessScoreSeed((payload) => seen.push(payload));
    seedDailyWellnessScoreCache('7', '2026-08-10', { totalEarned: 10 });
    unsub();
    expect(seen).toHaveLength(1);
    expect(seen[0].userId).toBe('7');
    expect(seen[0].score.totalEarned).toBe(10);
  });
});
