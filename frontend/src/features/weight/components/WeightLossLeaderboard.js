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
import LeaderboardAvatar from '../../leaderboard/components/LeaderboardAvatar.js';

// ---------------------------------------------------------------------------
// SWR cache — global leaderboard is identical for all users, no userId key.
// Stale data shows instantly on back-navigation; fresh data arrives quietly.
// ---------------------------------------------------------------------------
const WEIGHT_LB_CACHE_TTL = 5 * 60 * 1000;
const WEIGHT_LB_CACHE_KEY = 'wv.lb.weight.v2';
const WEIGHT_LB_LEGACY_KEYS = ['wv.lb.weight'];

const stripWeightAvatars = (data) =>
  (data || []).map(({ profileImage, ...rest }) => rest);

const readWeightLBCache = () => {
  try {
    WEIGHT_LB_LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(WEIGHT_LB_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.ts < WEIGHT_LB_CACHE_TTL ? c.data : null;
  } catch { return null; }
};
const writeWeightLBCache = (data) => {
  try {
    // Do not cache base64 avatars — quota blows and leaves stale null-avatar data.
    localStorage.setItem(
      WEIGHT_LB_CACHE_KEY,
      JSON.stringify({ data: stripWeightAvatars(data), ts: Date.now() }),
    );
  } catch {
    try { localStorage.removeItem(WEIGHT_LB_CACHE_KEY); } catch { /* ignore */ }
  }
};

/**
 * WeightLossLeaderboard Component
 * Displays global weight loss leaderboard strip showing top performers
 *
 * Features:
 * - Shows rank, profile avatar, user name, coach name, weight loss
 * - Smooth marquee animation (continuous horizontal scroll)
 * - Pause on hover for better UX
 * - Hides completely if no eligible users
 * - Exposes refresh method via ref for manual updates
 *
 * @param {string} apiBaseUrl - API base URL
 * @param {number} topN - Number of top users to show (default: 10)
 */
const WeightLossLeaderboard = forwardRef(({ apiBaseUrl, topN = 10 }, ref) => {
  const [leaderboardData, setLeaderboardData] = useState(() => readWeightLBCache() ?? []);
  const [isVisible, setIsVisible] = useState(() => (readWeightLBCache()?.length ?? 0) > 0);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      // debugLog(
      //   "≡ƒÅå [LEADERBOARD] Fetching data from:",
      //   `${apiBaseUrl}/api/leaderboard/get-global-leaderboard?topN=${topN}`,
      // );

      const response = await fetch(
        `${apiBaseUrl}/api/leaderboard/get-global-leaderboard?topN=${topN}`,
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
        // debugLog(
        //   "Γ£à [LEADERBOARD] Data found:",
        //   result.data.length,
        //   "users",
        // );
        setLeaderboardData(result.data);
        setIsVisible(true);
        writeWeightLBCache(result.data);
      } else {
        debugLog(
          "ΓÜá∩╕Å [LEADERBOARD] No data available:",
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
  }, [apiBaseUrl, topN]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    // refresh: re-fetches from server (retries after 4s for DB propagation)
    refresh: () => {
      fetchLeaderboard();
    },
    // injectEntry: instantly show the current user's entry in the strip
    // without waiting for any API call. The next refresh will replace with real data.
    injectEntry: ({ userId, userName, email, weightLoss, profileImage, coachName }) => {
      // Match API: loss-only and ≤ 3 kg for Today vs Yesterday strip
      if (!weightLoss || weightLoss <= 0 || weightLoss > 3) return;
      setLeaderboardData((prev) => {
        // Remove any existing entry for this user, then add new one at top
        const filtered = prev.filter((u) => u.userId !== userId);
        const injected = [{
          userId,
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
    if (!readWeightLBCache()) {
      fetchLeaderboard();
    }
    return setVisibilityAwareInterval(fetchLeaderboard, WEIGHT_LB_CACHE_TTL);
  }, [fetchLeaderboard]);

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
    // Hide completely when no data (don't show message)
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

  // Marquee Animation with manual scroll capability
  return (
    <div className="w-full bg-white shadow-sm">
      <div className="py-0 px-0">
        <div className="relative h-[56px] sm:h-[60px] overflow-hidden">
          <div className="absolute inset-y-0 left-0 z-10 pointer-events-none">
            <div className="flex h-full w-[68px] sm:w-[72px] items-center justify-center border-r border-gray-200 bg-white shadow-sm px-1.5 text-center text-[9px] sm:text-[10px] font-medium leading-tight text-green-700">
              Today vs<br />Yesterday
            </div>
          </div>

          <div
            className="h-full overflow-hidden cursor-pointer"
            onClick={() => setIsPaused(!isPaused)}
          >
            <div
              className="animate-smooth-marquee whitespace-nowrap inline-flex items-center h-full"
              style={{
                animationDuration: `${Math.max(20, leaderboardData.length * 3)}s`,
                animationPlayState: isPaused ? "paused" : "running",
                WebkitAnimationDuration: `${Math.max(20, leaderboardData.length * 3)}s`,
                WebkitAnimationPlayState: isPaused ? "paused" : "running",
              }}
            >
              {/* First set of items */}
              {leaderboardData.map((user) =>
                renderLeaderboardCard(user, `first-${user.userId}`),
              )}

              {/* Duplicate set for seamless loop */}
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
