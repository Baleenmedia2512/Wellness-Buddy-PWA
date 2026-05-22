// Hybrid corrections lookup map (cached): global Herbalife + user-specific.
import { cacheManager } from '../../../../shared/services/cacheManager';
import { debugLog } from '../../../../shared/utils/logger.js';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export const clearGlobalCorrectionsCache = () => {
  cacheManager.clearPattern('globalCorrections');
  debugLog('[CACHE] Cleared global corrections cache');
};

/**
 * Returns a Map keyed by lowercase ai_detected → correction record.
 * Backend already enforces user-latest > global-latest, so the Map values
 * can be used directly without further priority reconciliation.
 */
export const getGlobalCorrectionsMap = async (userId = null) => {
  const cacheKey = cacheManager.generateKey('globalCorrections', userId || 'global');
  return cacheManager.execute(
    cacheKey,
    async () => {
      debugLog('[HYBRID-AUTO] Fetching corrections from server...');
      if (userId) debugLog(`   👤 Including user-specific corrections for user ${userId}`);

      const url = userId
        ? `${API_BASE_URL}/api/food-corrections/global?userId=${userId}&t=${Date.now()}`
        : `${API_BASE_URL}/api/food-corrections/global?t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const map = new Map();
      if (data.success && data.lookup) {
        Object.keys(data.lookup).forEach((ai) => {
          map.set(ai.toLowerCase().trim(), data.lookup[ai]);
        });
        const g = data.globalCount || 0;
        const u = data.userCount || 0;
        debugLog(`✅ [HYBRID-AUTO] Loaded ${map.size} corrections (${g} global + ${u} user)`);
      }
      return map;
    },
    cacheManager.ttls.foodCorrections,
  ).catch((error) => {
    console.error('[HYBRID-AUTO] Error:', error);
    return new Map();
  });
};
