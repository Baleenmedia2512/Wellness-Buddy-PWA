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

function scoreDateMismatches(score, date) {
  return Boolean(score?.date) && String(score.date) !== String(date);
}

function numericField(score, key) {
  const value = score?.[key];
  return value == null || value === '' ? null : Number(value);
}

/** Same day totals — used to avoid re-notifying listeners (seed ↔ history loop). */
function scoresEquivalent(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return numericField(a, 'totalEarned') === numericField(b, 'totalEarned')
    && numericField(a, 'totalPossible') === numericField(b, 'totalPossible')
    && String(a.date || '') === String(b.date || '')
    && numericField(a, 'percentage') === numericField(b, 'percentage');
}

export function getDailyWellnessScoreCached(userId, date) {
  if (!date) return null;
  let score = null;
  // Known identity: only that user's row. Never fall through to another
  // person's same-date score (Reports Nutrition viewing a downline).
  if (userId != null && userId !== '') {
    score = dailyScoreCache.get(dailyKey(userId, date)) || null;
  } else {
    // Home first paint before userId resolves — date-only match is OK.
    const suffix = `|${date}`;
    for (const [key, cached] of dailyScoreCache.entries()) {
      if (key.endsWith(suffix)) {
        score = cached;
        break;
      }
    }
  }
  if (scoreDateMismatches(score, date)) {
    if (userId != null && userId !== '') dailyScoreCache.delete(dailyKey(userId, date));
    return null;
  }
  return score;
}

function notifyDailyScoreListeners({ userId, date, score }) {
  listeners.forEach((fn) => {
    try {
      fn({ userId: String(userId), date: String(date), score });
    } catch {
      /* listener errors must not break cache writes */
    }
  });
}

export function setDailyWellnessScoreCached(userId, date, score) {
  if (userId == null || !date || !score) return;
  if (scoreDateMismatches(score, date)) return;
  const key = dailyKey(userId, date);
  const previous = dailyScoreCache.get(key);
  dailyScoreCache.set(key, score);
  if (scoresEquivalent(previous, score)) return;
  notifyDailyScoreListeners({ userId, date, score });
}

/**
 * Seed Home with the sheet's current day score and pin it across the next
 * nutrition-refresh invalidate (sheet close bumps the activity log).
 */
export function seedDailyWellnessScoreCache(userId, date, score) {
  if (userId == null || !date || !score) return;
  if (scoreDateMismatches(score, date)) return;
  const key = dailyKey(userId, date);
  const activityLogId = getLatestActivityLogId();
  const previous = dailyScoreCache.get(key);
  const pinUnchanged = Boolean(
    pinnedSeed
    && pinnedSeed.key === key
    && pinnedSeed.activityLogId === activityLogId
    && scoresEquivalent(pinnedSeed.score, score),
  );
  dailyScoreCache.set(key, score);
  pinnedSeed = {
    key,
    userId: String(userId),
    date: String(date),
    score,
    activityLogId,
  };
  if (pinUnchanged && scoresEquivalent(previous, score)) return;
  notifyDailyScoreListeners({ userId, date, score });
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
