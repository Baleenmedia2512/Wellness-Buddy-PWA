import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  getLatestActivityLogId,
  getActivityLogDebug,
  markWellnessScoreProcessed,
  shouldRefreshWellnessScore,
} from '../../../shared/services/homeDashboardActivity';
import { fetchDailyWellnessScore } from '../services/wellnessScore.api';
import { scoreIsForDate } from '../domain/historyPaint';
import { shouldSkipWellnessScoreRefresh } from '../domain/skipWellnessScoreRefresh';
import {
  clearPinnedDailyWellnessScore,
  getDailyWellnessScoreCached,
  getPinnedDailyWellnessScore,
  invalidateDailyWellnessScoreCache,
  seedDailyWellnessScoreCache,
  setDailyWellnessScoreCached,
  subscribeDailyWellnessScoreSeed,
} from '../services/dailyWellnessScoreCache';

export { seedDailyWellnessScoreCache, invalidateDailyWellnessScoreCache };

/**
 * Loads daily wellness score from the backend API.
 *
 * Refetch rules (matches Home activity log):
 * - First load / date change → fetch
 * - `nutritionRefreshKey` bump after AI analysis / manual log / meal save → fetch
 * - Tab switch / app resume with no new activity → keep cached score (no API call)
 * - Sheet seed → paint immediately so Home matches the sheet total
 */
function cachedScoreForDate(userId, date) {
  const cached = getDailyWellnessScoreCached(userId, date);
  if (!cached) return null;
  if (cached.date && !scoreIsForDate(cached, date)) return null;
  return { ...cached, date: cached.date || date };
}

export function useWellnessScore({ user, apiBaseUrl, date, nutritionRefreshKey = 0 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [dataDate, setDataDate] = useState(date);
  const userIdRef = useRef(null);
  const requestIdRef = useRef(0);

  // Drop the previous pill's total during render (effects run too late and flash Today ↔ Yesterday).
  if (date !== dataDate) {
    setDataDate(date);
    const uid = user?.id || userIdRef.current;
    const cached = uid ? cachedScoreForDate(uid, date) : null;
    setData(cached);
    setError(null);
    if (!cached) setLoading(true);
  }

  const reload = useCallback(async ({ background = false, force = false } = {}) => {
    if (!user) {
      setLoading(false);
      setData(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    try {
      const userId = user.id || userIdRef.current || (await getUserId(user));
      if (!userId) throw new Error('Unable to resolve user');
      if (requestId !== requestIdRef.current) return;
      userIdRef.current = userId;

      const cached = cachedScoreForDate(userId, date);

      // Skip network when nothing dashboard-affecting happened since last fetch.
      if (!force && cached && !shouldRefreshWellnessScore()) {
        setData(cached);
        setError(null);
        setLoading(false);
        return;
      }

      // Paint seeded/cached score immediately on forced refresh (sheet → Home sync)
      // so Home does not keep an older total while /daily is in flight.
      if (force && cached) {
        setData(cached);
      }

      if (!background) setLoading(true);
      setError(null);

      const activityLogAtFetch = getLatestActivityLogId();
      const score = await fetchDailyWellnessScore({ userId, date, apiBaseUrl });
      if (requestId !== requestIdRef.current) return;

      // After sheet → Home sync, keep the sheet total for this watermark so a
      // racing /daily response cannot put Home back on an older/different number.
      const pin = getPinnedDailyWellnessScore();
      const pinMatches = Boolean(
        pin
        && pin.key === `${userId || ''}|${date || ''}`
        && pin.activityLogId === getLatestActivityLogId(),
      );
      const nextScore = pinMatches ? pin.score : score;
      if (nextScore && nextScore.date && !scoreIsForDate(nextScore, date)) {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        return;
      }
      const stamped = nextScore ? { ...nextScore, date: nextScore.date || date } : nextScore;
      setDailyWellnessScoreCached(userId, date, stamped);
      if (!pinMatches) clearPinnedDailyWellnessScore(userId, date);
      setData(stamped);

      // Only mark processed if nothing newer landed mid-fetch (food-save race).
      if (getLatestActivityLogId() === activityLogAtFetch) {
        markWellnessScoreProcessed(activityLogAtFetch);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.message || 'Failed to load wellness score');
      if (!background) setData(null);
    } finally {
      if (requestId === requestIdRef.current && !background) setLoading(false);
    }
  }, [user, apiBaseUrl, date]);

  // Sheet (or setup) published a day score — paint Home immediately.
  useEffect(() => {
    return subscribeDailyWellnessScoreSeed(({ userId, date: seedDate, score }) => {
      const uid = userIdRef.current || user?.id;
      if (!uid || String(uid) !== String(userId)) return;
      if (String(seedDate) !== String(date)) return;
      if (score?.date && !scoreIsForDate(score, date)) return;
      setData(score ? { ...score, date: score.date || date } : score);
      setError(null);
      setLoading(false);
    });
  }, [user?.id, date]);

  useEffect(() => {
    reload({ force: shouldRefreshWellnessScore() });
  }, [reload]);

  // Food/weight/camera / manual log bump nutritionRefreshKey via NutritionRefreshContext.
  const activityRefreshMounted = useRef(false);
  useEffect(() => {
    if (!activityRefreshMounted.current) {
      activityRefreshMounted.current = true;
      return;
    }
    if (shouldSkipWellnessScoreRefresh(getActivityLogDebug().lastSource)) return;
    // Keep the last painted total so Home + sheet stay visible while /daily
    // refetches. force=true still bypasses the freshness skip.
    reload({ background: true, force: true });
  }, [nutritionRefreshKey, reload]);

  // Foreground resume — only refetch when a newer async activity log exists.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!shouldRefreshWellnessScore()) return;
      reload({ background: true, force: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  return { loading, error, data, reload: () => reload({ force: true }) };
}
