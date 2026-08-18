import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Award, Star } from 'lucide-react';
import { debugLog } from '../../../shared/utils/logger.js';
import { resolveSponsorCoachNames } from '../../../shared/utils/sponsorCoachLabels.js';
import { setVisibilityAwareInterval } from '../../../shared/utils/visibilityAwareInterval.js';
import { useAutoScrollStrip } from '../../../shared/hooks/useAutoScrollStrip.js';
import LeaderboardAvatar from './LeaderboardAvatar.js';

const CACHE_TTL = 5 * 60 * 1000;
// v5: hierarchy-scoped Top 10 (per logged-in user) — test API requires userId
const CACHE_KEY_PREFIX = 'wv.lb.wellness.v5.';
const LEGACY_CACHE_KEYS = [
  'wv.lb.wellness',
  'wv.lb.wellness.v2',
  'wv.lb.wellness.v3',
  'wv.lb.wellness.v4',
];

const cacheKeyFor = (userId) => `${CACHE_KEY_PREFIX}${userId || 'anon'}`;

const stripAvatars = (data) =>
  (data || []).map(({ profileImage, ...rest }) => rest);

/** Home marquee order: #10, #9, #8 … #1 (highest rank number first). */
const toDescendingRankOrder = (data) =>
  [...(data || [])].sort((a, b) => (Number(b.rank) || 0) - (Number(a.rank) || 0));

const readCache = (userId) => {
  try {
    LEGACY_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(cacheKeyFor(userId));
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.ts < CACHE_TTL ? toDescendingRankOrder(c.data) : null;
  } catch { return null; }
};
const writeCache = (userId, data) => {
  try {
    // Do not cache base64 avatars — quota blows and leaves stale null-avatar data.
    localStorage.setItem(
      cacheKeyFor(userId),
      JSON.stringify({ data: stripAvatars(toDescendingRankOrder(data)), ts: Date.now() }),
    );
  } catch {
    try { localStorage.removeItem(cacheKeyFor(userId)); } catch { /* ignore */ }
  }
};

/**
 * Top wellness scores for today (IST) — swipeable strip on Home.
 * Display order: Rank N → Rank 1 (descending).
 * Ranked among the logged-in user's allowed hierarchy (test API requires userId).
 */
const WellnessScoreLeaderboard = forwardRef(({ apiBaseUrl, topN = 10, userId }, ref) => {
  const [leaderboardData, setLeaderboardData] = useState(() => readCache(userId) ?? []);
  const [isVisible, setIsVisible] = useState(() => (readCache(userId)?.length ?? 0) > 0);
  const [hasEntered, setHasEntered] = useState(() => (readCache(userId)?.length ?? 0) > 0);
  const { viewportRef, trackRef, interactionHandlers } = useAutoScrollStrip({
    enabled: isVisible && leaderboardData.length > 0,
  });

  const fetchLeaderboard = useCallback(async () => {
    if (userId == null || userId === '') {
      setLeaderboardData([]);
      setIsVisible(false);
      return;
    }
    try {
      const params = new URLSearchParams({
        topN: String(topN),
        userId: String(userId),
      });
      const response = await fetch(
        `${apiBaseUrl}/api/leaderboard/get-wellness-score-leaderboard?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const result = await response.json();

      if (result.success && result.data?.length > 0) {
        const ordered = toDescendingRankOrder(result.data);
        setLeaderboardData(ordered);
        setIsVisible(true);
        writeCache(userId, ordered);
      } else {
        debugLog('[WELLNESS-LB] No data:', result.message || 'Empty');
        setLeaderboardData([]);
        setIsVisible(false);
      }
    } catch (error) {
      console.error('[WELLNESS-LB] Error fetching data:', error);
      setLeaderboardData([]);
      setIsVisible(false);
    }
  }, [apiBaseUrl, topN, userId]);

  useImperativeHandle(ref, () => ({
    refresh: fetchLeaderboard,
  }));

  // Skip network if SWR cache is fresh; background refresh on CACHE_TTL
  useEffect(() => {
    const cached = readCache(userId);
    if (cached?.length) {
      setLeaderboardData(cached);
      setIsVisible(true);
    } else {
      fetchLeaderboard();
    }
    return setVisibilityAwareInterval(fetchLeaderboard, CACHE_TTL);
  }, [fetchLeaderboard, userId]);

  // Smooth enter once data is ready
  useEffect(() => {
    if (!isVisible || leaderboardData.length === 0) {
      setHasEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isVisible, leaderboardData.length]);

  const getRankColor = (pct) => {
    if (pct >= 90) return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
    if (pct >= 80) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
    if (pct >= 70) return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
    return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
  };

  const getStarIcon = (pct) => {
    if (pct >= 90) {
      return <Star className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-yellow-500 fill-yellow-500" />;
    }
    if (pct >= 80) {
      return <Star className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-gray-400 fill-gray-400" />;
    }
    if (pct >= 70) {
      return <Star className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-orange-500 fill-orange-500" />;
    }
    return <Award className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-500" />;
  };

  if (!isVisible || leaderboardData.length === 0) {
    return null;
  }

  const renderLeaderboardCard = (user, key) => (
    <div
      key={key}
      className="inline-flex items-center gap-1.5 sm:gap-2 md:gap-3 mx-2 sm:mx-3 md:mx-4 flex-shrink-0"
    >
      <div className="inline-flex flex-col items-center justify-center gap-0.5 flex-shrink-0 w-8 sm:w-10 md:w-12">
        {getStarIcon(user.wellnessPercentage)}
        <div
          className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] md:text-[10px] font-bold leading-none ${getRankColor(
            user.wellnessPercentage,
          )}`}
        >
          #{user.rank}
        </div>
      </div>

      <div className="flex-shrink-0">
        <LeaderboardAvatar
          apiBaseUrl={apiBaseUrl}
          userId={user.userId}
          email={user.email}
          userName={user.userName}
          profileImage={user.profileImage}
        />
      </div>

      <div className="flex flex-col justify-center flex-shrink-0 min-w-0 max-w-[120px] sm:max-w-[150px] md:max-w-[180px]">
        <span className="font-bold text-gray-800 text-xs sm:text-sm md:text-base truncate leading-tight">
          {user.userName}
        </span>
        {(() => {
          const { sponsorName, idealCoachName } = resolveSponsorCoachNames(user);
          if (!sponsorName && !idealCoachName) return null;
          return (
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-600 leading-tight min-w-0">
              {sponsorName && (
                <span className="block truncate">Sponsor: {sponsorName}</span>
              )}
              {idealCoachName && (
                <span className="block truncate">Coach: {idealCoachName}</span>
              )}
            </div>
          );
        })()}
      </div>

      <div className="flex items-center gap-0.5 bg-white px-1.5 sm:px-2 md:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-sm flex-shrink-0">
        <span className="font-bold text-purple-600 text-xs sm:text-sm md:text-base whitespace-nowrap">
          {Math.round(user.totalEarned ?? 0)}/{Math.round(user.totalPossible ?? 0)}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className={`w-full bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 shadow-sm transition-opacity duration-500 ease-out ${
        hasEntered ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="py-0 px-0">
        <div className="relative h-[56px] sm:h-[60px] overflow-hidden">
          <div className="absolute inset-y-0 left-0 z-10 pointer-events-none">
            <div className="flex h-full w-[68px] sm:w-[72px] items-center justify-center border-r border-purple-100 bg-white shadow-sm px-1.5 text-center text-[9px] sm:text-[10px] font-medium leading-tight text-purple-700">
              Top {topN}<br />Score
            </div>
          </div>

          <div
            ref={viewportRef}
            className="h-full overflow-hidden pl-[68px] sm:pl-[72px] cursor-pointer"
            style={{ touchAction: 'pan-y' }}
            {...interactionHandlers}
          >
            <div
              ref={trackRef}
              className="whitespace-nowrap inline-flex items-center h-full will-change-transform"
              style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
            >
              {leaderboardData.map((user) =>
                renderLeaderboardCard(user, `first-${user.userId}`),
              )}
              {leaderboardData.map((user) =>
                renderLeaderboardCard(user, `second-${user.userId}`),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default WellnessScoreLeaderboard;
