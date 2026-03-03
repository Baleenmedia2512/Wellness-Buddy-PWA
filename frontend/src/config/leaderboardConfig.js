/**
 * Weight Loss Leaderboard Configuration
 * 
 * Settings can be overridden via localStorage:
 * - localStorage.getItem('leaderboard_topN') → number (default: 10)
 * 
 * Default values:
 * - TOP_N: 10 (shows top 10 users with auto-slide)
 */

// Helper to get settings from localStorage with fallback to defaults
const getTopN = () => {
  const saved = localStorage.getItem('leaderboard_topN');
  return saved ? parseInt(saved) : 10;
};

export const LEADERBOARD_CONFIG = {
  // Get from localStorage or use defaults
  get TOP_N() {
    return getTopN();
  },
  
  // Static configuration (not changed via UI)
  REFRESH_INTERVAL: 1 * 60 * 1000, // 1 minute (real-time updates)
  SLIDE_INTERVAL: 5 * 1000,        // 5 seconds
  MARQUEE_DURATION: 20,             // 20 seconds for scroll
};

export default LEADERBOARD_CONFIG;
