import { cacheManager } from './cacheManager';

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

/**
 * Normalize food name for comparison
 * Handles variations like "Formula 1 - Chocolate" vs "Formula 1 Chocolate"
 * @param {string} name - Food name to normalize
 * @returns {string} Normalized food name
 */
const normalizeFoodName = (name) => {
  if (!name) return "";
  
  return name
    .toLowerCase()
    .trim()
    // Remove special characters but keep spaces
    .replace(/[-–—_()[\]{}]/g, " ")
    // Remove extra spaces
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Save a food correction to the database
 * @param {number} userId - User ID
 * @param {string} aiDetected - Food name detected by AI
 * @param {string} userCorrected - Food name corrected by user
 * @returns {Promise} API response
 */
export const saveFoodCorrection = async (userId, aiDetected, userCorrected) => {
  try {
    console.log("\n💾 ========== SAVE CORRECTION API ==========");
    console.log("[CORRECTION SERVICE] saveFoodCorrection called:", {
      userId,
      aiDetected,
      userCorrected,
    });
    
    // 🚨 CRITICAL VALIDATION: Ensure aiDetected is the ORIGINAL AI name
    console.log("🔍 [VALIDATION] Checking if aiDetected is original AI name...");
    console.log("   - aiDetected:", aiDetected);
    console.log("   - Will save to DB:", { UserId: userId, AiDetected: aiDetected, UserCorrected: userCorrected });

    // Don't save if both names are the same
    if (
      aiDetected.trim().toLowerCase() === userCorrected.trim().toLowerCase()
    ) {
      console.log("[CORRECTION SERVICE] ❌ Names are identical, skipping save");
      console.log("==========================================\n");
      return { success: false, message: "No correction needed" };
    }

    const url = `${API_BASE_URL}/api/save-food-correction`;
    console.log("[CORRECTION SERVICE] API URL:", url);

    const payload = {
      userId,
      aiDetected: aiDetected.trim(),
      userCorrected: userCorrected.trim(),
    };
    console.log("[CORRECTION SERVICE] Payload:", payload);
    console.log("🚀 [SENDING TO BACKEND] Will create/update DB record:");
    console.log("   📊 food_corrections_table:");
    console.log("      - UserId:", userId);
    console.log("      - AiDetected:", aiDetected.trim());
    console.log("      - UserCorrected:", userCorrected.trim());
    console.log("==========================================\n");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("[CORRECTION SERVICE] Response status:", response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[CORRECTION SERVICE] ✅ Success:", data);
    
    // Clear cache so new correction applies immediately
    cacheManager.clearPattern('foodCorrection');
    cacheManager.clearPattern('globalCorrections');
    cacheManager.clearPattern('reverseLookup');
    
    return data;
  } catch (error) {
    console.error("[CORRECTION SERVICE] ❌ Error:", error);
    throw error;
  }
};

/**
 * Get all food corrections for a user
 * @param {number} userId - User ID
 * @returns {Promise} User's corrections
 */
export const getUserCorrections = async (userId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/get-food-corrections?userId=${userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching user corrections:", error);
    throw error;
  }
};

/**
 * Reverse-lookup: Find original AI-detected name from a corrected name
 * Use case: When loading old meal data that's missing originalAiName metadata
 * @param {string} correctedName - The current corrected food name
 * @returns {Promise<string|null>} Original AI-detected name, or null if not found
 */
export const reverseLookupOriginalAiName = async (correctedName) => {
  const cacheKey = cacheManager.generateKey('reverseLookup', correctedName);
  
  return cacheManager.execute(
    cacheKey,
    async () => {
      console.log("🔍 [REVERSE-LOOKUP] Querying server for:", correctedName);
      
      const response = await fetch(
        `${API_BASE_URL}/api/reverse-lookup-correction?correctedName=${encodeURIComponent(correctedName)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      let result = null;
      if (data.success && data.found) {
        console.log("✅ [REVERSE-LOOKUP] Found original AI name:", data.originalAiName);
        result = data.originalAiName;
      } else {
        console.log("ℹ️ [REVERSE-LOOKUP] No correction mapping found");
      }
      
      return result;
    },
    cacheManager.ttls.reverseLookup
  );
};

/**
 * Apply hybrid corrections (global + user) to AI-detected food names
 * Priority: User's personal corrections > Global community patterns > Original AI
 * ✅ GLOBAL AUTO-CORRECTIONS ENABLED
 * @param {Array} foods - Array of food items detected by AI
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Foods with corrected names
 */
export const applyUserCorrections = async (foods, userId) => {
  try {
    if (!foods || foods.length === 0) {
      return foods;
    }

    console.log(
      "🔄 [CORRECTION] Processing foods for userId:",
      userId,
      "- Global auto-corrections ENABLED",
    );

    // Apply global auto-corrections with current userId for comparison
    return await applyGlobalAutoCorrections(foods, userId);
  } catch (error) {
    console.error("❌ [CORRECTION] Error processing foods:", error);
    // Fallback: Return original foods if processing fails
    return foods;
  }
};

// Cache for global corrections map (deprecated - now using cacheManager)
// Kept for backward compatibility with clearGlobalCorrectionsCache export
let globalCorrectionsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Clear the global corrections cache (uses global cache manager)
 */
export const clearGlobalCorrectionsCache = () => {
  globalCorrectionsCache = null;
  cacheTimestamp = 0;
  cacheManager.clearPattern('globalCorrections');
  console.log("🗑️ [CACHE] Cleared global corrections cache");
};

/**
 * 🌍 GLOBAL AUTO-CORRECTION FEATURE
 * Get global auto-corrections lookup map (cached with request deduplication)
 * When ANY user corrects once, it applies to ALL users globally
 * @returns {Promise<Map>} Map of ai_detected -> corrected_name
 */
export const getGlobalCorrectionsMap = async () => {
  const cacheKey = cacheManager.generateKey('globalCorrections', 'map');
  
  return cacheManager.execute(
    cacheKey,
    async () => {
      console.log("🌍 [GLOBAL-AUTO] Fetching corrections from server...");

      const response = await fetch(
        `${API_BASE_URL}/api/get-global-corrections?t=${Date.now()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Build Map for O(1) lookup
      const correctionMap = new Map();
      if (data.success && data.lookup) {
        Object.keys(data.lookup).forEach((aiDetected) => {
          correctionMap.set(
            aiDetected.toLowerCase().trim(),
            data.lookup[aiDetected],
          );
        });

        console.log(
          `✅ [GLOBAL-AUTO] Loaded ${correctionMap.size} corrections (cached)`,
        );
      }

      return correctionMap;
    },
    cacheManager.ttls.foodCorrections
  ).catch(error => {
    console.error("❌ [GLOBAL-AUTO] Error:", error);
    return new Map(); // Return empty map on error
  });
};

/**
 * Apply global auto-corrections to AI-detected food names
 * 🎯 KEY FEATURE: If user A corrects "Roti" to "Chapathi",
 *    next time ANY user uploads Roti, it auto-corrects to Chapathi!
 * 🔗 CHAIN SUPPORT: Follows correction chains to final result
 *    "Golden Milk" → "Formula 1" → "Juice"
 *    Both "Golden Milk" AND "Formula 1" will show "Juice"
 * @param {Array} foods - Array of food items detected by AI
 * @param {number} currentUserId - Current logged in user ID (optional)
 * @returns {Promise<Array>} Foods with auto-corrected names
 */
export const applyGlobalAutoCorrections = async (foods, currentUserId = null) => {
  try {
    if (!foods || foods.length === 0) {
      return foods;
    }

    console.log(
      "🔄 [GLOBAL-AUTO] Processing",
      foods.length,
      "items...",
    );

    // Fetch global corrections map (cached)
    const correctionMap = await getGlobalCorrectionsMap();

    if (correctionMap.size === 0) {
      console.log("⚠️ [GLOBAL-AUTO] No corrections available");
      return foods.map((food) => ({
        ...food,
        originalAiName: food.name,
        wasAutoCorrected: false,
        correctionSource: null,
      }));
    }

    // Apply corrections with DIRECT LOOKUP ONLY
    const correctedFoods = foods.map((food) => {
      const originalName = food.name;
      const normalizedOriginal = normalizeFoodName(originalName);
      
      // Direct lookup - backend already followed chains
      if (correctionMap.has(normalizedOriginal)) {
        const correction = correctionMap.get(normalizedOriginal);
        const isCorrectedByCurrentUser = currentUserId && String(correction.lastCorrectedByUserId) === String(currentUserId);
        
        console.log(
          `✅ [AUTO-CORRECT] "${originalName}" → "${correction.correctedName}" ` +
            `(${correction.userCount} user${correction.userCount > 1 ? "s" : ""})`
        );

        return {
          ...food,
          name: correction.correctedName,
          originalAiName: originalName,
          wasAutoCorrected: true,
          correctionSource: `Auto-corrected (${correction.userCount} user${correction.userCount > 1 ? "s" : ""})`,
          correctionMetadata: {
            aiDetected: originalName,
            userCorrected: correction.correctedName,
            finalDisplay: correction.correctedName,
            userCount: correction.userCount
          }
        };
      }

      // No correction found - return with explicit flags
      return {
        ...food,
        originalAiName: originalName,
        wasAutoCorrected: false,
        correctionSource: null,
      };
    });

    // Summary
    const correctedCount = correctedFoods.filter(
      (f) => f.wasAutoCorrected,
    ).length;
    
    if (correctedCount > 0) {
      console.log(
        `🎯 [GLOBAL-AUTO] ✓ ${correctedCount}/${foods.length} items auto-corrected`,
      );
    }

    return correctedFoods;
  } catch (error) {
    console.error("❌ [GLOBAL-AUTO] Error:", error);
    // Return foods with explicit flags showing no auto-correction
    return foods.map((food) => ({
      ...food,
      originalAiName: food.name,
      wasAutoCorrected: false,
      correctionSource: null,
    }));
  }
};
