// REST endpoints for food corrections (write + per-user read + reverse lookup).
import { cacheManager } from '../../../../shared/services/cacheManager';
import { debugLog } from '../../../../shared/utils/logger.js';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

// ── Food search (replaces geminiService.searchFood) ───────────────────────────

/** Module-level in-memory cache for food search results. */
const _foodSearchCache = new Map();

/**
 * Transform a backend food-history record into the shape expected by
 * EditableFoodItem / NutritionCard:
 *   { name, category, isLiquid, unit, defaultServing, per100g }
 */
export function toFoodSearchItem(item) {
  const w = item.weight_g > 0 ? item.weight_g : 100;
  const cal = item.calories || 0;
  const prot = item.protein || 0;
  const carbs = item.carbs || 0;
  const fat = item.fat || 0;
  const fiber = item.fiber || 0;
  const nameLower = (item.name || '').toLowerCase();
  const isLiquid = ['ml', 'l'].includes(item.unit || '') ||
    ['juice', 'shake', 'milk', 'tea', 'coffee', 'water', 'drink',
     'chai', 'lassi', 'smoothie', 'soup', 'broth', 'afresh',
    ].some((k) => nameLower.includes(k));
  const unit = isLiquid ? 'ml' : 'g';
  const defaultNutrition = { calories: cal, protein: prot, carbs, fat, fiber };
  const per100g = w > 0 ? {
    calories: Math.round((cal  / w) * 100),
    protein:  Math.round((prot / w) * 100 * 10) / 10,
    carbs:    Math.round((carbs / w) * 100 * 10) / 10,
    fat:      Math.round((fat  / w) * 100 * 10) / 10,
    fiber:    Math.round((fiber / w) * 100 * 10) / 10,
  } : null;
  return {
    name: item.name,
    category: isLiquid ? 'Beverage' : 'Food',
    isLiquid,
    unit,
    defaultServing: { description: `${w}${unit} ${item.name}`, grams: w, nutrition: defaultNutrition },
    per100g,
  };
}

/**
 * Search food history (user + community) via /api/food-corrections/search.
 * Returns a deduplicated array of `toFoodSearchItem`-shaped objects.
 * Results are cached by query for the lifetime of the page.
 *
 * @param {string} query  Min 2 chars.
 * @param {string|number} userId  Required for personalised results.
 * @returns {Promise<Array>}
 */
export async function searchFoods(query, userId) {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `${userId || '_'}::${trimmed.toLowerCase()}`;
  if (_foodSearchCache.has(cacheKey)) return _foodSearchCache.get(cacheKey);

  const res = await fetch(
    `${API_BASE_URL}/api/food-corrections/search?userId=${encodeURIComponent(userId || '')}&query=${encodeURIComponent(trimmed)}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const all = [...(data.myItems || []), ...(data.communityItems || [])];
  const seen = new Set();
  const deduped = all.filter((item) => {
    const key = (item.name || '').toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const results = deduped.map(toFoodSearchItem);
  _foodSearchCache.set(cacheKey, results);
  return results;
}


export const saveFoodCorrection = async (userId, aiDetected, userCorrected, correctedData = {}) => {
  try {
    debugLog('[CORRECTION SERVICE] saveFoodCorrection called:', { userId, aiDetected, userCorrected, correctedData });

    if (aiDetected.trim().toLowerCase() === userCorrected.trim().toLowerCase()) {
      debugLog('[CORRECTION SERVICE] Names are identical, skipping save');
      return { success: false, message: 'No correction needed' };
    }

    const url = `${API_BASE_URL}/api/food-corrections`;
    const payload = {
      userId,
      aiDetected: aiDetected.trim(),
      userCorrected: userCorrected.trim(),
      ...correctedData,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    debugLog('[CORRECTION SERVICE] ✅ Success:', data);

    // Invalidate caches so the new correction applies immediately.
    cacheManager.clearPattern('foodCorrection');
    cacheManager.clearPattern('globalCorrections');
    cacheManager.clearPattern('reverseLookup');
    return data;
  } catch (error) {
    console.error('[CORRECTION SERVICE] Error:', error);
    throw error;
  }
};

export const getUserCorrections = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/food-corrections?userId=${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching user corrections:', error);
    throw error;
  }
};

export const reverseLookupOriginalAiName = async (correctedName) => {
  const cacheKey = cacheManager.generateKey('reverseLookup', correctedName);
  return cacheManager.execute(
    cacheKey,
    async () => {
      debugLog('[REVERSE-LOOKUP] Querying server for:', correctedName);
      const response = await fetch(
        `${API_BASE_URL}/api/token/reverse-lookup?correctedName=${encodeURIComponent(correctedName)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success && data.found) {
        debugLog('✅ [REVERSE-LOOKUP] Found original AI name:', data.originalAiName);
        return data.originalAiName;
      }
      debugLog('[REVERSE-LOOKUP] No correction mapping found');
      return null;
    },
    cacheManager.ttls.reverseLookup,
  );
};
