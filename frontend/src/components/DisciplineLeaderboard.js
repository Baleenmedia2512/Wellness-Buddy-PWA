import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Award, Star } from "lucide-react";
import LEADERBOARD_CONFIG from "../config/leaderboardConfig";

/**
 * DisciplineLeaderboard Component
 * Displays global discipline leaderboard showing top performers
 *
 * Features:
 * - Shows rank, profile avatar, user name, coach name, discipline %
 * - Smooth marquee animation (continuous horizontal scroll)
 * - Pause on hover for better UX
 * - Color-coded badges: Gold (≥90%), Silver (80-89%), Bronze (70-79%), Green (<70%)
 * - Hides completely if no eligible users
 * - Exposes refresh method via ref for manual updates
 *
 * @param {string} apiBaseUrl - API base URL
 * @param {number} topN - Number of top users to show (default: 10)
 */
const DisciplineLeaderboard = forwardRef(({ apiBaseUrl, topN = 10 }, ref) => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      // console.log(
      //   "⭐ [DISCIPLINE-LEADERBOARD] Fetching data from:",
      //   `${apiBaseUrl}/api/leaderboard/get-discipline-leaderboard?topN=${topN}`,
      // );

      const response = await fetch(
        `${apiBaseUrl}/api/leaderboard/get-discipline-leaderboard?topN=${topN}&t=${Date.now()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      );

      // console.log(
      //   "⭐ [DISCIPLINE-LEADERBOARD] Response status:",
      //   response.status,
      // );
      const result = await response.json();
      // console.log("⭐ [DISCIPLINE-LEADERBOARD] Result:", result);

      if (result.success && result.data && result.data.length > 0) {
        // console.log(
        //   "✅ [DISCIPLINE-LEADERBOARD] Data found:",
        //   result.data.length,
        //   "users",
        // );
        setLeaderboardData(result.data);
        setIsVisible(true);
      } else {
        console.log(
          "⚠️ [DISCIPLINE-LEADERBOARD] No data available:",
          result.message || "Empty data",
        );
        setLeaderboardData([]);
        setIsVisible(false);
      }
    } catch (error) {
      console.error("❌ [DISCIPLINE-LEADERBOARD] Error fetching data:", error);
      setLeaderboardData([]);
      setIsVisible(false);
    }
  }, [apiBaseUrl, topN]);

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: fetchLeaderboard,
  }));

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
    // Refresh every 5 minutes for real-time updates
    const refreshInterval = setInterval(fetchLeaderboard, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchLeaderboard]);

  // Generate profile avatar from email or name
  const getAvatar = (email, userName, profileImage) => {
    // If profile image exists, use it with lazy loading
    if (profileImage) {
      return (
        <img
          src={profileImage}
          alt={userName || "User"}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-md border-2 border-white"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      );
    }

    // Otherwise, generate initial-based avatar
    const initial = userName
      ? userName.charAt(0).toUpperCase()
      : email
      ? email.charAt(0).toUpperCase()
      : "?";

    // Generate color based on email/name
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-yellow-500",
      "bg-red-500",
      "bg-teal-500",
    ];
    const colorIndex = (userName || email || "").length % colors.length;

    return (
      <div
        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-md`}
      >
        {initial}
      </div>
    );
  };

  // Get rank badge color based on discipline percentage
  const getRankColor = (disciplinePercentage) => {
    if (disciplinePercentage >= 90)
      return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white"; // Gold
    if (disciplinePercentage >= 80)
      return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800"; // Silver
    if (disciplinePercentage >= 70)
      return "bg-gradient-to-r from-orange-400 to-orange-600 text-white"; // Bronze
    return "bg-gradient-to-r from-green-500 to-green-600 text-white"; // Green
  };

  // Get star icon based on discipline percentage
  const getStarIcon = (disciplinePercentage) => {
    if (disciplinePercentage >= 90) {
      return (
        <Star className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-500 fill-yellow-500" />
      );
    }
    if (disciplinePercentage >= 80) {
      return (
        <Star className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-400 fill-gray-400" />
      );
    }
    if (disciplinePercentage >= 70) {
      return (
        <Star className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-orange-500 fill-orange-500" />
      );
    }
    return (
      <Award className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-500" />
    );
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
      className="inline-flex items-center gap-2 sm:gap-3 md:gap-4 mx-4 sm:mx-6 md:mx-8 flex-shrink-0"
    >
      {/* Star/Award + Rank */}
      <div className="inline-flex flex-col items-center justify-center gap-0.5 flex-shrink-0 w-10 sm:w-12 md:w-14">
        {getStarIcon(user.disciplinePercentage)}
        <div
          className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold leading-none ${getRankColor(
            user.disciplinePercentage,
          )}`}
        >
          #{user.rank}
        </div>
      </div>

      {/* Profile Avatar */}
      <div className="flex-shrink-0">
        {getAvatar(user.email, user.userName, user.profileImage)}
      </div>

      {/* User Details */}
      <div className="flex flex-col justify-center flex-shrink-0 min-w-0 max-w-[140px] sm:max-w-[180px] md:max-w-[200px]">
        <span className="font-bold text-gray-800 text-sm sm:text-base md:text-lg truncate leading-tight">
          {user.userName}
        </span>
        {user.coachName && user.coachName.toLowerCase() !== "no coach" && (
          <span className="text-xs sm:text-sm md:text-base text-gray-600 truncate leading-tight">
            Coach: {user.coachName}
          </span>
        )}
      </div>

      {/* Discipline Percentage Badge */}
      <div className="flex items-center gap-0.5 bg-white px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm flex-shrink-0">
        <span className="font-bold text-purple-600 text-sm sm:text-base md:text-lg whitespace-nowrap">
          {user.disciplinePercentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );

  // Marquee Animation with manual scroll capability
  return (
    <div className="w-full bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 shadow-sm">
      <div className="py-2 sm:py-2.5 px-3 sm:px-4">
        {/* Title */}
        <div className="flex items-center justify-between mb-1.5">
          {/* <span className="text-xs sm:text-sm font-semibold text-purple-700">
            🌟 Discipline Champions
          </span> */}
          <span className="text-[10px] sm:text-xs text-purple-600">
            (Last 10 Days)
          </span>
        </div>

        <div
          className="overflow-x-auto overflow-y-hidden scrollbar-hide cursor-pointer"
          onClick={() => setIsPaused(!isPaused)}
        >
          <div
            className="animate-smooth-marquee whitespace-nowrap inline-flex"
            style={{
              animationDuration: `${Math.max(25, leaderboardData.length * 4)}s`,
              animationPlayState: isPaused ? "paused" : "running",
              WebkitAnimationDuration: `${Math.max(25, leaderboardData.length * 4)}s`,
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
  );
});

export default DisciplineLeaderboard;
