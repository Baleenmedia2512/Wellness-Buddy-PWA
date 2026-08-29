import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Trophy } from "lucide-react";
import { debugLog } from '../../../shared/utils/logger.js';
import { resolveSponsorCoachNames } from '../../../shared/utils/sponsorCoachLabels.js';
import { setVisibilityAwareInterval } from '../../../shared/utils/visibilityAwareInterval.js';
import { useAutoScrollStrip } from '../../../shared/hooks/useAutoScrollStrip.js';
import LeaderboardAvatar from '../../leaderboard/components/LeaderboardAvatar.js';

// ---------------------------------------------------------------------------
// SWR cache — hierarchy-scoped (per logged-in user).
// Stale data shows instantly on back-navigation; fresh data arrives quietly.
// ---------------------------------------------------------------------------
const WEIGHT_LB_CACHE_TTL = 5 * 60 * 1000;
// v4: hierarchy-scoped Top N (per logged-in user)
const WEIGHT_LB_CACHE_KEY_PREFIX = 'wv.lb.weight.v4.';
const WEIGHT_LB_LEGACY_KEYS = ['wv.lb.weight', 'wv.lb.weight.v2', 'wv.lb.weight.v3'];

const cacheKeyFor = (userId) => `${WEIGHT_LB_CACHE_KEY_PREFIX}${userId || 'anon'}`;

const stripWeightAvatars = (data) =>
  (data || []).map(({ profileImage, ...rest }) => rest);

const readWeightLBCache = (userId) => {
  try {
    WEIGHT_LB_LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(cacheKeyFor(userId));
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.ts < WEIGHT_LB_CACHE_TTL ? c.data : null;
  } catch { return null; }
};
const writeWeightLBCache = (userId, data) => {
  try {
    // Do not cache base64 avatars — quota blows and leaves stale null-avatar data.
    localStorage.setItem(
      cacheKeyFor(userId),
      JSON.stringify({ data: stripWeightAvatars(data), ts: Date.now() }),
    );
  } catch {
    try { localStorage.removeItem(cacheKeyFor(userId)); } catch { /* ignore */ }
  }
};

/**
 * WeightLossLeaderboard Component
 * Displays hierarchy-scoped weight loss leaderboard strip (Weight Loss Today vs Yesterday)
 *
 * Features:
 * - Ranked among logged-in user's allowed hierarchy (upline + sibling peers + own downline)
 * - Shows rank, profile avatar, user name, coach name, weight loss
 * - Auto-scroll with native swipe / drag
 * - Smooth fade-in when data arrives
 * - Hides completely if no eligible users
 * - Exposes refresh method via ref for manual updates
 *
 * @param {string} apiBaseUrl - API base URL
 * @param {number} topN - Number of top users to show (default: 10)
 * @param {number|string} userId - Logged-in user id (required for hierarchy scope)
 */
const WeightLossLeaderboard = forwardRef(({ apiBaseUrl, topN = 10, userId, email }, ref) => {
  const [leaderboardData, setLeaderboardData] = useState(() => readWeightLBCache(userId) ?? []);
  const [isVisible, setIsVisible] = useState(() => (readWeightLBCache(userId)?.length ?? 0) > 0);
  const [hasEntered, setHasEntered] = useState(() => (readWeightLBCache(userId)?.length ?? 0) > 0);
  const { viewportRef, trackRef, interactionHandlers } = useAutoScrollStrip({
    enabled: isVisible && leaderboardData.length > 0,
  });

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    const emailTrim = String(email || '').trim();
    if ((userId == null || userId === '') && !emailTrim) {
      setLeaderboardData([]);
      setIsVisible(false);
      return;
    }
    try {
      const params = new URLSearchParams({
        topN: String(topN),
      });
      if (userId != null && userId !== '') params.set('userId', String(userId));
      if (emailTrim) params.set('email', emailTrim);
      const response = await fetch(
        `${apiBaseUrl}/api/leaderboard/get-global-leaderboard?${params}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        debugLog("[LEADERBOARD] API returned", response.status);
        return;
      }

      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        setLeaderboardData(result.data);
        setIsVisible(true);
        writeWeightLBCache(userId, result.data);
      } else {
        debugLog(
          "⚠ [LEADERBOARD] No data available:",
          result.message || "Empty data",
        );
        setLeaderboardData([]);
        setIsVisible(false);
      }
    } catch (error) {
      debugLog("[LEADERBOARD] Error fetching data:", error?.message || error);
      setLeaderboardData([]);
      setIsVisible(false);
    }
  }, [apiBaseUrl, topN, userId, email]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    // refresh: re-fetches from server (retries after 4s for DB propagation)
    refresh: () => {
      fetchLeaderboard();
    },
    // injectEntry: instantly show the current user's entry in the strip
    // without waiting for any API call. The next refresh will replace with real data.
    injectEntry: ({ userId: entryUserId, userName, email, weightLoss, profileImage, coachName }) => {
      // Match API: loss-only and ≤ 3 kg for Weight Loss Today vs Yesterday strip
      if (!weightLoss || weightLoss <= 0 || weightLoss > 3) return;
      setLeaderboardData((prev) => {
        // Remove any existing entry for this user, then add new one at top
        const filtered = prev.filter((u) => u.userId !== entryUserId);
        const injected = [{
          userId: entryUserId,
          userName: userName || "You",
          email: email || "",
          coachName: coachName || "",
          profileImage: profileImage || null,
          weightLoss: parseFloat(weightLoss.toFixed(2)),
          rank: 1,
          todayWeight: null,
          yesterdayWeight: null,
        }, ...filtered];
        // Re-rank after injection
        return injected.map((u, i) => ({ ...u, rank: i + 1 }));
      });
      setIsVisible(true);
    },
  }));

  // Skip network if SWR cache is fresh; refresh every 5 min while visible
  useEffect(() => {
    const cached = readWeightLBCache(userId);
    if (cached?.length) {
      setLeaderboardData(cached);
      setIsVisible(true);
    } else {
      fetchLeaderboard();
    }
    return setVisibilityAwareInterval(fetchLeaderboard, WEIGHT_LB_CACHE_TTL);
  }, [fetchLeaderboard, userId]);

  // Smooth fade-in when the strip becomes visible
  useEffect(() => {
    if (!isVisible || leaderboardData.length === 0) {
      setHasEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isVisible, leaderboardData.length]);

  // Format weight loss display (grams for < 1kg, kg for >= 1kg)
  const formatWeightLoss = (weightLoss) => {
    if (weightLoss < 1) {
      const grams = Math.round(weightLoss * 1000);
      return { value: grams, unit: "g" };
    }
    // Round to 1 decimal place for kg
    const kg = Math.round(weightLoss * 10) / 10;
    return { value: kg, unit: "kg" };
  };

  // Get rank badge color
  const getRankColor = (rank) => {
    if (rank === 1)
      return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
    if (rank === 2)
      return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800";
    if (rank === 3)
      return "bg-gradient-to-r from-orange-400 to-orange-600 text-white";
    return "bg-gradient-to-r from-green-500 to-green-600 text-white";
  };

  // Don't render if no data or loading failed
  if (!isVisible || leaderboardData.length === 0) {
    return null;
  }

  // Render leaderboard card
  const renderLeaderboardCard = (user, key) => (
    <div
      key={key}
      className="inline-flex items-center gap-1.5 sm:gap-2 md:gap-3 mx-2 sm:mx-3 md:mx-4 flex-shrink-0"
    >
      {/* Trophy + Rank */}
      <div className="inline-flex flex-col items-center justify-center gap-0.5 flex-shrink-0 w-8 sm:w-10 md:w-12">
        <Trophy className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-yellow-500" />
        <div
          className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] md:text-[10px] font-bold leading-none ${getRankColor(
            user.rank,
          )}`}
        >
          #{user.rank}
        </div>
      </div>

      {/* Profile Avatar */}
      <div className="flex-shrink-0">
        <LeaderboardAvatar
          apiBaseUrl={apiBaseUrl}
          userId={user.userId}
          email={user.email}
          userName={user.userName}
          profileImage={user.profileImage}
        />
      </div>

      {/* User Details */}
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

      {/* Weight Loss Badge */}
      <div className="flex items-center gap-0.5 bg-white px-1.5 sm:px-2 md:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-sm flex-shrink-0">
        <span className="font-bold text-green-600 text-xs sm:text-sm md:text-base whitespace-nowrap">
          -{formatWeightLoss(user.weightLoss).value}{" "}
          <span className="font-medium text-[10px] sm:text-xs md:text-sm">
            {formatWeightLoss(user.weightLoss).unit}
          </span>
        </span>
      </div>
    </div>
  );

  return (
    <div
      className={`w-full bg-white shadow-sm transition-opacity duration-500 ease-out ${
        hasEntered ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="py-0 px-0">
        <div className="relative h-[68px] sm:h-[72px] overflow-hidden">
          <div className="absolute inset-y-0 left-0 z-10 pointer-events-none flex items-stretch">
            <div
              className="flex h-full w-[60px] sm:w-[64px] items-center justify-center rounded-r-md bg-white px-1 py-2 text-center text-[9px] sm:text-[10px] font-semibold leading-[1.2] text-green-700 shadow-sm"
              aria-label="Weight Loss Today vs Yesterday"
            >
              Weight Loss<br />Today vs<br />Yesterday
            </div>
          </div>

          <div
            ref={viewportRef}
            className="h-full overflow-hidden pl-[58px] sm:pl-[62px] cursor-pointer"
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

export default WeightLossLeaderboard;
