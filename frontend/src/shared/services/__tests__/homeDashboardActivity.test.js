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
});
