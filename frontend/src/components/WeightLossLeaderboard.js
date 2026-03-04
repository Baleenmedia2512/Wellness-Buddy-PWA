import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Trophy } from "lucide-react";
import LEADERBOARD_CONFIG from "../config/leaderboardConfig";

/**
 * WeightLossLeaderboard Component
 * Displays global weight loss leaderboard strip showing top performers
 *
 * Features:
 * - Shows rank, profile avatar, user name, coach name, weight loss
 * - Auto-slides every 5 seconds for Top 10
 * - Testimonial-style animation for Top 1
 * - Hides completely if no eligible users
 * - Exposes refresh method via ref for manual updates
 *
 * @param {string} apiBaseUrl - API base URL
 * @param {number} topN - Number of top users to show (default: 10)
 */
const WeightLossLeaderboard = forwardRef(({ apiBaseUrl, topN = 10 }, ref) => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      console.log(
        "🏆 [LEADERBOARD] Fetching data from:",
        `${apiBaseUrl}/api/leaderboard/get-global-leaderboard?topN=${topN}`,
      );

      const response = await fetch(
        `${apiBaseUrl}/api/leaderboard/get-global-leaderboard?topN=${topN}&t=${Date.now()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      );

      console.log("🏆 [LEADERBOARD] Response status:", response.status);
      const result = await response.json();
      console.log("🏆 [LEADERBOARD] Result:", result);

      if (result.success && result.data && result.data.length > 0) {
        console.log(
          "✅ [LEADERBOARD] Data found:",
          result.data.length,
          "users",
        );
        setLeaderboardData(result.data);
        setIsVisible(true);
      } else {
        console.log(
          "⚠️ [LEADERBOARD] No data available:",
          result.message || "Empty data",
        );
        setLeaderboardData([]);
        setIsVisible(false);
      }
    } catch (error) {
      console.error("❌ [LEADERBOARD] Error fetching data:", error);
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
    // Refresh every 1 minute for real-time updates
    const refreshInterval = setInterval(fetchLeaderboard, 1 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchLeaderboard]);

  // Auto-slide animation (5 seconds)
  useEffect(() => {
    if (leaderboardData.length <= 1) return;

    const slideInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % leaderboardData.length);
    }, LEADERBOARD_CONFIG.SLIDE_INTERVAL);

    return () => clearInterval(slideInterval);
  }, [leaderboardData]);

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

  // Top 1: Testimonial style (continuous scroll)
  if (leaderboardData.length === 1) {
    const user = leaderboardData[0];
    return (
      <div className="w-full bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 overflow-hidden">
        <div
          className="animate-marquee whitespace-nowrap py-3 px-3 sm:px-4"
          style={{
            animationDuration: `${LEADERBOARD_CONFIG.MARQUEE_DURATION}s`,
          }}
        >
          <div className="inline-flex items-center gap-2 sm:gap-3 md:gap-4 mx-4 sm:mx-6 md:mx-8">
            <div className="inline-flex flex-col items-center justify-center gap-0.5 flex-shrink-0 w-10 sm:w-12 md:w-14">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-500" />
              <div
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold leading-none ${getRankColor(
                  user.rank,
                )}`}
              >
                #{user.rank}
              </div>
            </div>
            <div className="flex-shrink-0">
              {getAvatar(user.email, user.userName, user.profileImage)}
            </div>
            <div className="flex flex-col justify-center flex-shrink-0 min-w-0 max-w-[140px] sm:max-w-[180px] md:max-w-none">
              <span className="font-bold text-gray-800 text-sm sm:text-base md:text-lg truncate">
                {user.userName}
              </span>
              {user.coachName &&
                user.coachName.toLowerCase() !== "no coach" && (
                  <span className="text-xs sm:text-sm md:text-base text-gray-600 truncate">
                    Coach: {user.coachName}
                  </span>
                )}
            </div>
            <div className="flex items-center gap-0.5 bg-white px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm flex-shrink-0">
              <span className="font-bold text-green-600 text-sm sm:text-base md:text-lg whitespace-nowrap">
                -{formatWeightLoss(user.weightLoss).value}{" "}
                <span className="font-medium text-xs sm:text-sm md:text-base">
                  {formatWeightLoss(user.weightLoss).unit}
                </span>
              </span>
            </div>
          </div>
          {/* Duplicate for seamless loop */}
          <div className="inline-flex items-center gap-2 sm:gap-3 md:gap-4 mx-4 sm:mx-6 md:mx-8">
            <div className="inline-flex flex-col items-center justify-center gap-0.5 flex-shrink-0 w-10 sm:w-12 md:w-14">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-500" />
              <div
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold leading-none ${getRankColor(
                  user.rank,
                )}`}
              >
                #{user.rank}
              </div>
            </div>
            <div className="flex-shrink-0">
              {getAvatar(user.email, user.userName, user.profileImage)}
            </div>
            <div className="flex flex-col justify-center flex-shrink-0 min-w-0">
              <span className="font-bold text-gray-800 text-sm sm:text-base md:text-lg truncate">
                {user.userName}
              </span>
              {user.coachName &&
                user.coachName.toLowerCase() !== "no coach" && (
                  <span className="text-xs sm:text-sm md:text-base text-gray-600 truncate">
                    Coach: {user.coachName}
                  </span>
                )}
            </div>
            <div className="flex items-center gap-0.5 bg-white px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm flex-shrink-0">
              <span className="font-bold text-green-600 text-sm sm:text-base md:text-lg whitespace-nowrap">
                -{formatWeightLoss(user.weightLoss).value}{" "}
                <span className="font-medium text-xs sm:text-sm md:text-base">
                  {formatWeightLoss(user.weightLoss).unit}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Top 3 or Top 7: Auto-slide one card at a time
  return (
    <div className="w-full bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 overflow-hidden">
      <div className="max-w-4xl mx-auto px-2 sm:px-3 md:px-4 py-2.5 sm:py-3">
        <div className="overflow-hidden relative">
          <div
            className="flex transition-transform duration-1000 ease-in-out"
            style={{
              transform: `translateX(-${currentIndex * 100}%)`,
            }}
          >
            {leaderboardData.map((user) => (
              <div
                key={user.userId}
                className="min-w-full flex-shrink-0 flex items-center gap-1.5 sm:gap-2 md:gap-2.5 px-1.5 sm:px-2"
              >
                {/* Left: Trophy + Rank (stacked vertically) */}
                <div className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0 w-10 sm:w-12 md:w-14">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-500" />
                  <div
                    className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold leading-none ${getRankColor(
                      user.rank,
                    )}`}
                  >
                    #{user.rank}
                  </div>
                </div>

                {/* Center: Profile + Details */}
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {getAvatar(user.email, user.userName, user.profileImage)}
                  </div>
                  <div className="flex flex-col justify-center min-w-0 flex-1 max-w-[140px] sm:max-w-[180px] md:max-w-none">
                    <span className="font-bold text-gray-800 text-xs sm:text-sm md:text-base leading-tight truncate">
                      {user.userName}
                    </span>
                    {user.coachName &&
                      user.coachName.toLowerCase() !== "no coach" && (
                        <span className="text-[10px] sm:text-xs md:text-sm text-gray-500 leading-tight truncate">
                          Coach: {user.coachName}
                        </span>
                      )}
                  </div>
                </div>

                {/* Right: Weight Loss */}
                <div className="flex items-center gap-0.5 bg-white px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-lg shadow-sm flex-shrink-0">
                  <span className="font-bold text-green-600 text-xs sm:text-sm md:text-base whitespace-nowrap">
                    -{formatWeightLoss(user.weightLoss).value}{" "}
                    <span className="font-medium text-[10px] sm:text-xs md:text-sm">
                      {formatWeightLoss(user.weightLoss).unit}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination dots */}
        {leaderboardData.length > 1 && (
          <div className="flex justify-center gap-1.5 sm:gap-2 mt-2">
            {leaderboardData.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "w-6 sm:w-8 bg-green-600"
                    : "w-1.5 sm:w-2 bg-green-300 hover:bg-green-400"
                }`}
                aria-label={`Go to rank ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default WeightLossLeaderboard;
