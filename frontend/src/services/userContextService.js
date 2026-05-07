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

// Context update listeners
const contextUpdateListeners = new Set();

/**
 * Fetch user context from backend
 * @param {number} userId - User's database ID
 * @param {boolean} forceRefresh - Force fetch even if cache is valid
 * @returns {Promise<Object>} User context object
 */
export const getUserContext = async (userId, forceRefresh = false) => {
  if (!userId) {
    console.warn('[USER CONTEXT] ⚠️ No userId provided');
    return null;
  }

  // Return cached data if still valid (unless force refresh)
  if (!forceRefresh && cachedContext && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION_MS)) {
    // console.log('[USER CONTEXT] ✅ Returning cached context');
    return cachedContext;
  }

  try {
    // console.log('[USER CONTEXT] 🔄 Fetching user context...');
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
      // console.log(`[USER CONTEXT] ✅ Context loaded in ${loadTime}ms:`, {
      //   personalCorrections: result.data.personalCorrections.length,
      //   globalPatterns: result.data.globalPatterns.length,
      //   dietPreference: result.data.dietPreference,
      //   recentMeals: result.data.recentMeals.length
      // });
      
      // Debug: Log actual data to see what we got
      if (result.data.recentMeals.length === 0) {
        // console.log('[USER CONTEXT] ℹ️ No recent meals found - you may need to upload food images');
      }
      if (result.data.globalPatterns.length === 0) {
        // console.log('[USER CONTEXT] ℹ️ No global patterns found - need 3+ users making same correction');
      }

      // Cache the result
      cachedContext = result.data;
      cacheTimestamp = Date.now();
      
      // Notify all listeners that context has been updated
      notifyContextUpdate(result.data);

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
      .join('\n  ');
    parts.push(`User's food corrections:\n  ${corrections}`);
  }

  // Diet preference (exclude Non-Vegetarian as it's default)
  if (context.dietPreference && context.dietPreference !== 'Non-Vegetarian') {
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
      .join('\n  ');
    parts.push(`Common corrections:\n  ${patterns}`);
  }

  return parts.join('\n\n');
};

/**
 * Subscribe to context updates
 * @param {Function} callback - Called when context is updated
 * @returns {Function} Unsubscribe function
 */
export const subscribeToContextUpdates = (callback) => {
  contextUpdateListeners.add(callback);
  // Return unsubscribe function
  return () => contextUpdateListeners.delete(callback);
};

/**
 * Notify all listeners of context update
 * @param {Object} context - Updated context
 */
const notifyContextUpdate = (context) => {
  contextUpdateListeners.forEach(listener => {
    try {
      listener(context);
    } catch (error) {
      console.error('[USER CONTEXT] Error in listener:', error);
    }
  });
};

export default {
  getUserContext,
  clearContextCache,
  getCachedContext,
  formatContextForAI,
  subscribeToContextUpdates
};
