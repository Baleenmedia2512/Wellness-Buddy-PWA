/**
 * Session cache for the Home daily wellness score.
 * Sheet → Home sync seeds this so the carousel card shows the same total
 * the sheet just displayed (without waiting on a slower /daily refetch).
 */
import { getLatestActivityLogId } from '../../../shared/services/homeDashboardActivity';

const dailyScoreCache = new Map();
const listeners = new Set();

/** @type {{ key: string, userId: string, date: string, score: object, activityLogId: number } | null} */
let pinnedSeed = null;

function dailyKey(userId, date) {
  return `${userId || ''}|${date || ''}`;
}

export function getDailyWellnessScoreCached(userId, date) {
  if (date && userId != null) {
    const hit = dailyScoreCache.get(dailyKey(userId, date));
    if (hit) return hit;
  }
  if (!date) return null;
  const suffix = `|${date}`;
  for (const [key, score] of dailyScoreCache.entries()) {
    if (key.endsWith(suffix)) return score;
  }
  return null;
}

export function setDailyWellnessScoreCached(userId, date, score) {
  if (userId == null || !date || !score) return;
  dailyScoreCache.set(dailyKey(userId, date), score);
}

/**
 * Seed Home with the sheet's current day score and pin it across the next
 * nutrition-refresh invalidate (sheet close bumps the activity log).
 */
export function seedDailyWellnessScoreCache(userId, date, score) {
  if (userId == null || !date || !score) return;
  const key = dailyKey(userId, date);
  const activityLogId = getLatestActivityLogId();
  dailyScoreCache.set(key, score);
  pinnedSeed = {
    key,
    userId: String(userId),
    date: String(date),
    score,
    activityLogId,
  };
  listeners.forEach((fn) => {
    try {
      fn({ userId: pinnedSeed.userId, date: pinnedSeed.date, score });
    } catch {
      /* listener errors must not break seed */
    }
  });
}

/**
 * Drop cached totals before a food/weight refetch so Home does not treat a
 * pre-save total as fresh. Restores a sheet→Home pin when it matches the
 * current activity watermark (seed happened after the refresh was recorded).
 */
export function invalidateDailyWellnessScoreCache(userId, date) {
  if (userId == null || !date) {
    dailyScoreCache.clear();
  } else {
    dailyScoreCache.delete(dailyKey(userId, date));
  }

  if (
    pinnedSeed
    && pinnedSeed.activityLogId === getLatestActivityLogId()
    && (userId == null || !date || pinnedSeed.key === dailyKey(userId, date))
  ) {
    dailyScoreCache.set(pinnedSeed.key, pinnedSeed.score);
  }
}

/** Active sheet→Home pin, if any. */
export function getPinnedDailyWellnessScore() {
  return pinnedSeed;
}

/** Clear pin after a successful network fetch for that day (when not pinned). */
export function clearPinnedDailyWellnessScore(userId, date) {
  if (!pinnedSeed) return;
  if (userId != null && date && pinnedSeed.key !== dailyKey(userId, date)) return;
  pinnedSeed = null;
}

export function subscribeDailyWellnessScoreSeed(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @internal */
export function __resetDailyWellnessScoreCacheForTests() {
  dailyScoreCache.clear();
  pinnedSeed = null;
  listeners.clear();
}
