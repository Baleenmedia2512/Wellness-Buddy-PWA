/* LEADERBOARD FUNCTIONALITY COMMENTED OUT
/**
 * Weight Loss Leaderboard Configuration
 * 
 * Settings can be overridden via localStorage:
 * - localStorage.getItem('leaderboard_topN') → number (default: 10)
 * - localStorage.getItem('leaderboard_useDemoData') → 'true' or 'false'
 * 
 * Default values:
 * - TOP_N: 10 (shows top 10 users with auto-slide)
 * - USE_DEMO_DATA: false (uses real data from database)
 */

// Helper to get settings from localStorage with fallback to defaults
const getTopN = () => {
  const saved = localStorage.getItem('leaderboard_topN');
  return saved ? parseInt(saved) : 10;
};

const getUseDemoData = () => {
  const saved = localStorage.getItem('leaderboard_useDemoData');
  return saved !== null ? saved === 'true' : false;
};

export const LEADERBOARD_CONFIG = {
  // Get from localStorage or use defaults
  get TOP_N() {
    return getTopN();
  },
  
  get USE_DEMO_DATA() {
    return getUseDemoData();
  },
  
  // Static configuration (not changed via UI)
  REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  SLIDE_INTERVAL: 5 * 1000,        // 5 seconds
  MARQUEE_DURATION: 20,             // 20 seconds for scroll
};

export default LEADERBOARD_CONFIG;
*/
