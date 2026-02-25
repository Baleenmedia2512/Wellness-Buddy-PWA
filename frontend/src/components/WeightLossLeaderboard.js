import React, { useState, useEffect, useCallback } from 'react';
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
 * 
 * @param {string} apiBaseUrl - API base URL
 * @param {number} topN - Number of top users to show (default: 10)
 * @param {boolean} debug - Show debug info when no data (for testing)
 */
const WeightLossLeaderboard = ({ apiBaseUrl, topN = 10, debug = false, useDemoData = false }) => {
  // Demo data for testing/preview (7 users to support all display modes)
  const demoData = [
    {
      rank: 1,
      userId: 101,
      userName: 'Priya Sharma',
      email: 'priya@example.com',
      coachName: 'Coach Rahul',
      weightLoss: 2.1,
      todayWeight: 67.9,
      yesterdayWeight: 70.0,
      comparison: 'Today vs Yesterday'
    },
    {
      rank: 2,
      userId: 102,
      userName: 'Amit Kumar',
      email: 'amit@example.com',
      coachName: 'Coach Neha',
      weightLoss: 1.7,
      todayWeight: 78.3,
      yesterdayWeight: 80.0,
      comparison: 'Today vs Yesterday'
    },
    {
      rank: 3,
      userId: 103,
      userName: 'Sneha Patel',
      email: 'sneha@example.com',
      coachName: 'Coach Vikram',
      weightLoss: 1.3,
      todayWeight: 63.7,
      yesterdayWeight: 65.0,
      comparison: 'Today vs Yesterday'
    },
    {
      rank: 4,
      userId: 104,
      userName: 'Rajesh Verma',
      email: 'rajesh@example.com',
      coachName: 'Coach Shalini',
      weightLoss: 1.1,
      todayWeight: 82.9,
      yesterdayWeight: 84.0,
      comparison: 'Today vs Yesterday'
    },
    {
      rank: 5,
      userId: 105,
      userName: 'Anita Desai',
      email: 'anita@example.com',
      coachName: 'Coach Kiran',
      weightLoss: 0.9,
      todayWeight: 59.1,
      yesterdayWeight: 60.0,
      comparison: 'Today vs Yesterday'
    },
    {
      rank: 6,
      userId: 106,
      userName: 'Suresh Reddy',
      email: 'suresh@example.com',
      coachName: 'Coach Priti',
      weightLoss: 0.7,
      todayWeight: 74.3,
      yesterdayWeight: 75.0,
      comparison: 'Today vs Yesterday'
    },
    {
      rank: 7,
      userId: 107,
      userName: 'Kavita Singh',
      email: 'kavita@example.com',
      coachName: 'Coach Arun',
      weightLoss: 0.5,
      todayWeight: 69.5,
      yesterdayWeight: 70.0,
      comparison: 'Today vs Yesterday'
    }
  ];

  const [leaderboardData, setLeaderboardData] = useState(useDemoData ? demoData.slice(0, topN) : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(useDemoData);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    // If using demo data, skip API call
    if (useDemoData) {
      console.log('🧪 [LEADERBOARD] Using demo data');
      setLeaderboardData(demoData.slice(0, topN));
      setIsVisible(true);
      return;
    }

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
        // Fallback to demo data if API has no data
        if (useDemoData) {
          console.log('🧪 [LEADERBOARD] Falling back to demo data');
          setLeaderboardData(demoData.slice(0, topN));
          setIsVisible(true);
        } else {
          setLeaderboardData([]);
          setIsVisible(false);
        }
      }
    } catch (error) {
      console.error('❌ [LEADERBOARD] Error fetching data:', error);
      // Fallback to demo data on error
      if (useDemoData) {
        console.log('🧪 [LEADERBOARD] Error - falling back to demo data');
        setLeaderboardData(demoData.slice(0, topN));
        setIsVisible(true);
      } else {
        setLeaderboardData([]);
        setIsVisible(false);
      }
    }
  }, [apiBaseUrl, topN, useDemoData]);

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
  const getAvatar = (email, userName) => {
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

  // Get rank badge color
  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
    if (rank === 3) return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
    return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
  };

  // Don't render if no data or loading failed
  if (!isVisible || leaderboardData.length === 0) {
    // Show message when no real data is available (instead of hiding completely)
    if (!useDemoData) {
      return (
        <div className="w-full bg-blue-50 border-b border-blue-200 py-3 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-blue-800">
              🏆 <strong>Weight Loss Leaderboard</strong>
              <br />
              <span className="text-xs">No weight loss data yet. Users need today's & yesterday's weight entries, and must have lost weight to appear here.</span>
            </p>
          </div>
        </div>
      );
    }
    
    // Debug mode: Show additional debug info
    if (debug) {
      return (
        <div className="w-full bg-yellow-50 border-b border-yellow-200 py-3 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-yellow-800">
              🏆 <strong>Leaderboard Debug Mode:</strong> No data available. 
              <br />
              <span className="text-xs">Run test data API or add weight records for today and yesterday.</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  // Top 1: Testimonial style (continuous scroll)
  if (leaderboardData.length === 1) {
    const user = leaderboardData[0];
    return (
      <div className="w-full bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 border-b border-green-100 overflow-hidden">
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
                <span className="font-bold text-green-600 text-lg">-{user.weightLoss} kg</span>
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
            {getAvatar(user.email, user.userName)}
            <div className="flex flex-col flex-shrink-0">
              <span className="font-bold text-gray-800 text-base">{user.userName}</span>
              <span className="text-sm text-gray-600">Coach: {user.coachName}</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-green-600" />
              <div className="flex flex-col">
                <span className="font-bold text-green-600 text-lg">-{user.weightLoss} kg</span>
                <span className="text-xs text-gray-500">{user.comparison}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Top 3 or Top 7: Auto-slide one card at a time
  const currentUser = leaderboardData[currentIndex];

  return (
    <div className="w-full bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 border-b border-green-100">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-3 transition-all duration-500 ease-in-out">
          {/* Left: Trophy + Rank */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <div className={`px-2 py-1 rounded-full text-xs font-bold ${getRankColor(currentUser.rank)}`}>
              #{currentUser.rank}
            </div>
          </div>

          {/* Center: Profile + Details */}
          <div className="flex items-center gap-2 flex-1">
            {getAvatar(currentUser.email, currentUser.userName)}
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 text-sm leading-tight whitespace-nowrap">{currentUser.userName}</span>
              <span className="text-xs text-gray-500 leading-tight whitespace-nowrap">
                Coach: {currentUser.coachName}
              </span>
            </div>
          </div>

          {/* Right: Weight Loss */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg shadow-sm flex-shrink-0">
            <TrendingDown className="w-4 h-4 text-green-600" />
            <div className="flex flex-col">
              <span className="font-bold text-green-600 text-base leading-tight">-{currentUser.weightLoss} kg</span>
              <span className="text-[10px] text-gray-500 leading-tight">{currentUser.comparison}</span>
            </div>
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
};

export default WeightLossLeaderboard;
