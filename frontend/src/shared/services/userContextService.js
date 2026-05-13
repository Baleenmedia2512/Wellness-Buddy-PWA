/**
 * @file userContextService — loads and caches the personalized AI
 * context for a user (corrections, global patterns, diet preference,
 * recent meals).
 *
 * Moved from `features/user/services/userContextService.js`. Behavior
 * is preserved exactly; the legacy `export default` was dropped
 * (no consumer imports it as a default — verified at move time).
 *
 * Named exports only.
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

let cachedContext = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 5 * 60 * 1000;

const contextUpdateListeners = new Set();

/**
 * Fetch user context from backend.
 * @param {number|string} userId
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object|null>}
 */
export const getUserContext = async (userId, forceRefresh = false) => {
  if (!userId) {
    console.warn('[USER CONTEXT] No userId provided');
    return null;
  }

  if (!forceRefresh && cachedContext && cacheTimestamp &&
      (Date.now() - cacheTimestamp < CACHE_DURATION_MS)) {
    return cachedContext;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/user/context?userId=${userId}`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();

    if (result.success && result.data) {
      cachedContext = result.data;
      cacheTimestamp = Date.now();
      notifyContextUpdate(result.data);
      return result.data;
    }
    throw new Error(result.error || 'Failed to fetch user context');
  } catch (error) {
    console.error('[USER CONTEXT] Error fetching context:', error);
    if (cachedContext) {
      console.log('[USER CONTEXT] Returning stale cache as fallback');
      return cachedContext;
    }
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
        queryTimeMs: 0,
      },
    };
  }
};

/** Clear cached context (logout / manual refresh). */
export const clearContextCache = () => {
  console.log('[USER CONTEXT] Cache cleared');
  cachedContext = null;
  cacheTimestamp = null;
};

/** Get cached context without making an API call. */
export const getCachedContext = () => cachedContext;

/**
 * Format a user-context object for AI prompt injection.
 * @param {Object|null} context
 * @returns {string}
 */
export const formatContextForAI = (context) => {
  if (!context) return '';
  const parts = [];

  if (context.personalCorrections?.length > 0) {
    const corrections = context.personalCorrections
      .slice(0, 5)
      .map(c => `"${c.ai_detected}" -> "${c.user_corrected}" (${c.times_corrected}x)`)
      .join('\n  ');
    parts.push(`User's food corrections:\n  ${corrections}`);
  }

  if (context.dietPreference && context.dietPreference !== 'Non-Vegetarian') {
    parts.push(`User's diet preference: ${context.dietPreference}`);
  }

  if (context.recentMeals?.length > 0) {
    const recentFoods = context.recentMeals
      .flatMap(meal => meal.foods)
      .slice(0, 5)
      .join(', ');
    parts.push(`Recently eaten foods: ${recentFoods}`);
  }

  if (context.globalPatterns?.length > 0) {
    const patterns = context.globalPatterns
      .slice(0, 3)
      .map(p => `"${p.ai_detected}" -> "${p.user_corrected}" (${p.user_count} users)`)
      .join('\n  ');
    parts.push(`Common corrections:\n  ${patterns}`);
  }

  return parts.join('\n\n');
};

/**
 * Subscribe to context-update notifications.
 * @param {(context: Object) => void} callback
 * @returns {() => void} unsubscribe
 */
export const subscribeToContextUpdates = (callback) => {
  contextUpdateListeners.add(callback);
  return () => contextUpdateListeners.delete(callback);
};

const notifyContextUpdate = (context) => {
  contextUpdateListeners.forEach((listener) => {
    try { listener(context); }
    catch (error) { console.error('[USER CONTEXT] Error in listener:', error); }
  });
};
