import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Trophy, TrendingDown } from 'lucide-react';
import LEADERBOARD_CONFIG from '../config/leaderboardConfig';

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
      console.log('🏆 [LEADERBOARD] Fetching data from:', `${apiBaseUrl}/api/leaderboard/get-global-leaderboard?topN=${topN}`);
      
      const response = await fetch(`${apiBaseUrl}/api/leaderboard/get-global-leaderboard?topN=${topN}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      console.log('🏆 [LEADERBOARD] Response status:', response.status);
      const result = await response.json();
      console.log('🏆 [LEADERBOARD] Result:', result);

      if (result.success && result.data && result.data.length > 0) {
        console.log('✅ [LEADERBOARD] Data found:', result.data.length, 'users');
        setLeaderboardData(result.data);
        setIsVisible(true);
      } else {
        console.log('⚠️ [LEADERBOARD] No data available:', result.message || 'Empty data');
        setLeaderboardData([]);
        setIsVisible(false);
      }
    } catch (error) {
      console.error('❌ [LEADERBOARD] Error fetching data:', error);
      setLeaderboardData([]);
      setIsVisible(false);
    }
  }, [apiBaseUrl, topN]);

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: fetchLeaderboard
  }));

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
    // Refresh every 5 minutes (configurable)
    const refreshInterval = setInterval(fetchLeaderboard, LEADERBOARD_CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(refreshInterval);
  }, [fetchLeaderboard]);

  // Auto-slide animation (5 seconds)
  useEffect(() => {
    if (leaderboardData.length <= 1) return;

    const slideInterval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % leaderboardData.length);
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
          alt={userName || 'User'}
          className="w-10 h-10 rounded-full object-cover shadow-md border-2 border-white"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      );
    }
    
    // Otherwise, generate initial-based avatar
    const initial = userName ? userName.charAt(0).toUpperCase() : 
                    email ? email.charAt(0).toUpperCase() : '?';
    
    // Generate color based on email/name
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500'
    ];
    const colorIndex = (userName || email || '').length % colors.length;
    
    return (
      <div className={`w-10 h-10 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
        {initial}
      </div>
    );
  };

  // Format weight loss display (grams for < 1kg, kg for >= 1kg)
  const formatWeightLoss = (weightLoss) => {
    if (weightLoss < 1) {
      const grams = Math.round(weightLoss * 1000);
      return `${grams}g`;
    }
    return `${weightLoss} kg`;
  };

  // Get rank badge color
  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
    if (rank === 3) return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
    return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
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
          className="animate-marquee whitespace-nowrap py-3 px-4"
          style={{ animationDuration: `${LEADERBOARD_CONFIG.MARQUEE_DURATION}s` }}
        >
          <div className="inline-flex items-center gap-4 mx-8">
            <Trophy className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${getRankColor(user.rank)} flex-shrink-0`}>
              Rank #{user.rank}
            </div>
            {getAvatar(user.email, user.userName)}
            <div className="flex flex-col flex-shrink-0">
              <span className="font-bold text-gray-800 text-base">{user.userName}</span>
              <span className="text-sm text-gray-600">Coach: {user.coachName}</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-green-600" />
              <div className="flex flex-col">
                <span className="font-bold text-green-600 text-lg">-{formatWeightLoss(user.weightLoss)}</span>
                <span className="text-xs text-gray-500">{user.comparison}</span>
              </div>
            </div>
          </div>
          {/* Duplicate for seamless loop */}
          <div className="inline-flex items-center gap-4 mx-8">
            <Trophy className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${getRankColor(user.rank)} flex-shrink-0`}>
              Rank #{user.rank}
            </div>
            {getAvatar(user.email, user.userName, user.profileImage)}
            <div className="flex flex-col flex-shrink-0">
              <span className="font-bold text-gray-800 text-base">{user.userName}</span>
              <span className="text-sm text-gray-600">Coach: {user.coachName}</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-green-600" />
              <div className="flex flex-col">
                <span className="font-bold text-green-600 text-lg">-{formatWeightLoss(user.weightLoss)}</span>
                <span className="text-xs text-gray-500">{user.comparison}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Top 3 or Top 7: Auto-slide one card at a time
  return (
    <div className="w-full bg-gradient-to-r from-green-50 via-emerald-50 to-green-50">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="overflow-hidden">
          <div 
            className="flex transition-transform duration-1000 ease-in-out"
            style={{
              transform: `translateX(-${currentIndex * 100}%)`
            }}
          >
            {leaderboardData.map((user) => (
              <div 
                key={user.userId}
                className="min-w-full flex-shrink-0 flex items-center gap-2 sm:gap-3 px-0.5"
              >
                {/* Left: Trophy + Rank */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <div className={`px-2 py-1 rounded-full text-xs font-bold ${getRankColor(user.rank)}`}>
                    #{user.rank}
                  </div>
                </div>

                {/* Center: Profile + Details */}
                <div className="flex items-center gap-2 flex-1">
                  {getAvatar(user.email, user.userName, user.profileImage)}
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 text-sm leading-tight whitespace-nowrap">{user.userName}</span>
                    <span className="text-xs text-gray-500 leading-tight whitespace-nowrap">
                      Coach: {user.coachName}
                    </span>
                  </div>
                </div>

                {/* Right: Weight Loss */}
                <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg shadow-sm flex-shrink-0">
                  <TrendingDown className="w-4 h-4 text-green-600" />
                  <div className="flex flex-col">
                    <span className="font-bold text-green-600 text-base leading-tight">-{formatWeightLoss(user.weightLoss)}</span>
                    <span className="text-[10px] text-gray-500 leading-tight">{user.comparison}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination dots */}
        {leaderboardData.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {leaderboardData.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'w-6 bg-green-600' 
                    : 'w-1.5 bg-green-300 hover:bg-green-400'
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
