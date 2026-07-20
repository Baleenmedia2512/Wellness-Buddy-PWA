import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Award, Star } from 'lucide-react';
import { debugLog } from '../../../shared/utils/logger.js';

const CACHE_TTL = 5 * 60 * 1000;
const readCache = () => {
  try {
    const raw = localStorage.getItem('wv.lb.wellness');
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.ts < CACHE_TTL ? c.data : null;
  } catch { return null; }
};
const writeCache = (data) => {
  try {
    localStorage.setItem('wv.lb.wellness', JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
};

/**
 * Top wellness scores for today (IST) — marquee strip on Home.
 */
const WellnessScoreLeaderboard = forwardRef(({ apiBaseUrl, topN = 10 }, ref) => {
  const [leaderboardData, setLeaderboardData] = useState(() => readCache() ?? []);
  const [isVisible, setIsVisible] = useState(() => (readCache()?.length ?? 0) > 0);
  const [isPaused, setIsPaused] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/leaderboard/get-wellness-score-leaderboard?topN=${topN}&t=${Date.now()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        },
      );

      const result = await response.json();

      if (result.success && result.data?.length > 0) {
        setLeaderboardData(result.data);
        setIsVisible(true);
        writeCache(result.data);
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
  }, [apiBaseUrl, topN]);

  useImperativeHandle(ref, () => ({
    refresh: fetchLeaderboard,
  }));

  useEffect(() => {
    fetchLeaderboard();
    const refreshInterval = setInterval(fetchLeaderboard, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchLeaderboard]);

  const getAvatar = (email, userName, profileImage) => {
    if (profileImage) {
      return (
        <img
          src={profileImage}
          alt={userName || 'User'}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-md border-2 border-white"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      );
    }

    const initial = userName
      ? userName.charAt(0).toUpperCase()
      : email
        ? email.charAt(0).toUpperCase()
        : '?';

    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500',
    ];
    const colorIndex = (userName || email || '').length % colors.length;

    return (
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md`}
      >
        {initial}
      </div>
    );
  };

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
        {getAvatar(user.email, user.userName, user.profileImage)}
      </div>

      <div className="flex flex-col justify-center flex-shrink-0 min-w-0 max-w-[120px] sm:max-w-[150px] md:max-w-[180px]">
        <span className="font-bold text-gray-800 text-xs sm:text-sm md:text-base truncate leading-tight">
          {user.userName}
        </span>
        {user.coachName && user.coachName.toLowerCase() !== 'no coach' && (
          <span className="text-[10px] sm:text-xs md:text-sm text-gray-600 truncate leading-tight">
            Coach: {user.coachName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 bg-white px-1.5 sm:px-2 md:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-sm flex-shrink-0">
        <span className="font-bold text-purple-600 text-xs sm:text-sm md:text-base whitespace-nowrap">
          {Math.round(user.totalEarned ?? 0)}/{Math.round(user.totalPossible ?? 0)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 shadow-sm">
      <div className="py-0 px-0">
        <div className="relative h-[56px] sm:h-[60px] overflow-hidden">
          <div className="absolute inset-y-0 left-0 z-10 pointer-events-none">
            <div className="flex h-full w-[68px] sm:w-[72px] items-center justify-center border-r border-gray-200 bg-white shadow-sm px-1.5 text-center text-[9px] sm:text-[10px] font-medium leading-tight text-purple-700">
              Top {topN}<br />Wellness
            </div>
          </div>

          <div
            className="h-full overflow-hidden cursor-pointer"
            onClick={() => setIsPaused(!isPaused)}
          >
            <div
              className="animate-smooth-marquee whitespace-nowrap inline-flex items-center h-full"
              style={{
                animationDuration: `${Math.max(25, leaderboardData.length * 4)}s`,
                animationPlayState: isPaused ? 'paused' : 'running',
                WebkitAnimationDuration: `${Math.max(25, leaderboardData.length * 4)}s`,
                WebkitAnimationPlayState: isPaused ? 'paused' : 'running',
              }}
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
