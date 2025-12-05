/**
 * User Context Service
 * Manages loading and caching of user's personalized AI context
 * Includes: corrections, global patterns, diet preference, recent meals
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// In-memory cache for user context (session-based)
let cachedContext = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch user context from backend
 * @param {number} userId - User's database ID
 * @returns {Promise<Object>} User context object
 */
export const getUserContext = async (userId) => {
  if (!userId) {
    console.warn('[USER CONTEXT] ⚠️ No userId provided');
    return null;
  }

  // Return cached data if still valid
  if (cachedContext && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION_MS)) {
    console.log('[USER CONTEXT] ✅ Returning cached context');
    return cachedContext;
  }

  try {
    console.log('[USER CONTEXT] 🔄 Fetching user context...');
    const startTime = Date.now();

    const response = await fetch(
      `${API_BASE_URL}/api/get-user-context?userId=${userId}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      const loadTime = Date.now() - startTime;
      console.log(`[USER CONTEXT] ✅ Context loaded in ${loadTime}ms:`, {
        personalCorrections: result.data.personalCorrections.length,
        globalPatterns: result.data.globalPatterns.length,
        dietPreference: result.data.dietPreference,
        recentMeals: result.data.recentMeals.length
      });

      // Cache the result
      cachedContext = result.data;
      cacheTimestamp = Date.now();

      return result.data;
    } else {
      throw new Error(result.error || 'Failed to fetch user context');
    }
  } catch (error) {
    console.error('[USER CONTEXT] ❌ Error fetching context:', error);
    
    // Return cached data as fallback even if expired
    if (cachedContext) {
      console.log('[USER CONTEXT] ⚠️ Returning stale cache as fallback');
      return cachedContext;
    }
    
    // Return empty context structure
    return {
      userId,
      personalCorrections: [],
      globalPatterns: [],
      dietPreference: null,
      recentMeals: [],
      metadata: {
        totalPersonalCorrections: 0,
        totalGlobalPatterns: 0,
        totalRecentMeals: 0,
        queryTimeMs: 0
      }
    };
  }
};

/**
 * Clear cached context (useful for logout or manual refresh)
 */
export const clearContextCache = () => {
  console.log('[USER CONTEXT] 🗑️ Cache cleared');
  cachedContext = null;
  cacheTimestamp = null;
};

/**
 * Get cached context without making API call
 * @returns {Object|null} Cached context or null
 */
export const getCachedContext = () => {
  return cachedContext;
};

/**
 * Format context for AI prompt injection
 * @param {Object} context - User context object
 * @returns {string} Formatted context string for AI prompt
 */
export const formatContextForAI = (context) => {
  if (!context) return '';

  const parts = [];

  // Personal corrections
  if (context.personalCorrections && context.personalCorrections.length > 0) {
    const corrections = context.personalCorrections
      .slice(0, 5) // Top 5
      .map(c => `"${c.ai_detected}" → "${c.user_corrected}" (${c.times_corrected}x)`)
      .join(', ');
    parts.push(`User's food corrections: ${corrections}`);
  }

  // Diet preference
  if (context.dietPreference) {
    parts.push(`User's diet preference: ${context.dietPreference}`);
  }

  // Recent meals
  if (context.recentMeals && context.recentMeals.length > 0) {
    const recentFoods = context.recentMeals
      .flatMap(meal => meal.foods)
      .slice(0, 5)
      .join(', ');
    parts.push(`Recently eaten foods: ${recentFoods}`);
  }

  // Global patterns
  if (context.globalPatterns && context.globalPatterns.length > 0) {
    const patterns = context.globalPatterns
      .slice(0, 3) // Top 3
      .map(p => `"${p.ai_detected}" → "${p.user_corrected}" (${p.user_count} users)`)
      .join(', ');
    parts.push(`Common corrections: ${patterns}`);
  }

  return parts.join('. ');
};

export default {
  getUserContext,
  clearContextCache,
  getCachedContext,
  formatContextForAI
};
