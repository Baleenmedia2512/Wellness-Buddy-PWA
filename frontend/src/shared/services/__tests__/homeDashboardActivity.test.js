/**
 * @jest-environment node
 */
import {
  recordDashboardActivity,
  shouldRefreshHomeDashboard,
  markHomeDashboardProcessed,
  getLatestActivityLogId,
  getLastProcessedActivityLogId,
  setHomeDashboardSnapshot,
  getHomeDashboardSnapshot,
  shouldRefreshWellnessScore,
  markWellnessScoreProcessed,
  getLastProcessedWellnessScoreActivityLogId,
  setWellnessScoreSnapshot,
  getWellnessScoreSnapshot,
  clearHomeDashboardSnapshot,
  __resetHomeDashboardActivityForTests,
} from '../homeDashboardActivity';

describe('homeDashboardActivity', () => {
  beforeEach(() => {
    __resetHomeDashboardActivityForTests();
  });

  it('requires refresh on first visit (never processed)', () => {
    expect(shouldRefreshHomeDashboard()).toBe(true);
    expect(getLastProcessedActivityLogId()).toBeNull();
  });

  it('skips refresh when no newer activity log exists', () => {
    markHomeDashboardProcessed(0);
    expect(shouldRefreshHomeDashboard()).toBe(false);
  });

  it('refreshes when a newer activity log is recorded', () => {
    markHomeDashboardProcessed(0);
    const id = recordDashboardActivity('food-upload');
    expect(id).toBe(1);
    expect(getLatestActivityLogId()).toBe(1);
    expect(shouldRefreshHomeDashboard()).toBe(true);

    markHomeDashboardProcessed(id);
    expect(shouldRefreshHomeDashboard()).toBe(false);
  });

  it('refreshes after each subsequent activity', () => {
    recordDashboardActivity('weight-upload');
    markHomeDashboardProcessed(getLatestActivityLogId());
    expect(shouldRefreshHomeDashboard()).toBe(false);

    recordDashboardActivity('water-intake');
    expect(shouldRefreshHomeDashboard()).toBe(true);
  });

  it('stores and clears home snapshot independently of log ids', () => {
    setHomeDashboardSnapshot({ dateKey: '2026-07-14', analyses: [], dailyStats: {} });
    expect(getHomeDashboardSnapshot()?.dateKey).toBe('2026-07-14');
    __resetHomeDashboardActivityForTests();
    expect(getHomeDashboardSnapshot()).toBeNull();
  });

  it('tracks wellness score refresh independently of home', () => {
    expect(shouldRefreshWellnessScore()).toBe(true);
    markWellnessScoreProcessed(0);
    markHomeDashboardProcessed(0);
    expect(shouldRefreshWellnessScore()).toBe(false);
    expect(shouldRefreshHomeDashboard()).toBe(false);

    const id = recordDashboardActivity('food-upload');
    expect(shouldRefreshWellnessScore()).toBe(true);
    expect(shouldRefreshHomeDashboard()).toBe(true);

    markWellnessScoreProcessed(id);
    expect(shouldRefreshWellnessScore()).toBe(false);
    expect(shouldRefreshHomeDashboard()).toBe(true);
    expect(getLastProcessedWellnessScoreActivityLogId()).toBe(id);
  });

  it('stores wellness score snapshot and clears it with home clear', () => {
    setWellnessScoreSnapshot({
      rangeKey: '2026-07-14__2026-07-14',
      days: [{ date: '2026-07-14', totalEarned: 10 }],
    });
    expect(getWellnessScoreSnapshot()?.days).toHaveLength(1);

    clearHomeDashboardSnapshot();
    expect(getWellnessScoreSnapshot()).toBeNull();
    expect(getLastProcessedWellnessScoreActivityLogId()).toBeNull();
  });
});
