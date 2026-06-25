/**
 * Leaderboard Configuration
 * 
 * Settings can be overridden via localStorage:
 * - localStorage.getItem('leaderboard_topN') → number (default: 10)
 * 
 * Default values:
 * - Weight Loss Leaderboard: TOP_N = 10 (smooth marquee animation)
 * - Discipline Leaderboard: DISCIPLINE_TOP_N = 5 (smooth marquee animation)
 */

// Helper to get settings from localStorage with fallback to defaults
const getTopN = () => {
  const saved = localStorage.getItem('leaderboard_topN');
  return saved ? parseInt(saved) : 10;
};

export const LEADERBOARD_CONFIG = {
  // Weight Loss Leaderboard - Get from localStorage or use defaults
  get TOP_N() {
    return getTopN();
  },
  
  // Discipline Leaderboard - Fixed Top 5
  DISCIPLINE_TOP_N: 5,
  
  // Static configuration (not changed via UI)
  REFRESH_INTERVAL: 1 * 60 * 1000,        // 1 minute (weight loss updates)
  DISCIPLINE_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes (discipline updates)
  SLIDE_INTERVAL: 5 * 1000,               // 5 seconds (deprecated - now using marquee)
  MARQUEE_DURATION: 20,                   // 20 seconds for smooth scroll
};

export default LEADERBOARD_CONFIG;
