import { getUserContext } from "./userContextService.js";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

/**
 * Save a food correction to the database
 * @param {number} userId - User ID
 * @param {string} aiDetected - Food name detected by AI
 * @param {string} userCorrected - Food name corrected by user
 * @returns {Promise} API response
 */
export const saveFoodCorrection = async (userId, aiDetected, userCorrected) => {
  try {
    console.log("[CORRECTION SERVICE] saveFoodCorrection called:", {
      userId,
      aiDetected,
      userCorrected,
    });

    // Don't save if both names are the same
    if (
      aiDetected.trim().toLowerCase() === userCorrected.trim().toLowerCase()
    ) {
      console.log("[CORRECTION SERVICE] ❌ Names are identical, skipping save");
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
 * Apply hybrid corrections (global + user) to AI-detected food names
 * Priority: User's personal corrections > Global community patterns > Original AI
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
      "🔄 [HYBRID] Starting hybrid correction process for userId:",
      userId,
    );

    // Fetch user context (includes both personal + global corrections)
    const context = await getUserContext(userId);

    if (!context) {
      console.log(
        "⚠️ [HYBRID] No context available, using original AI detection",
      );
      return foods;
    }

    // STEP 1: Build GLOBAL correction map (from community patterns)
    const globalCorrectionMap = new Map();

    if (context.globalPatterns && context.globalPatterns.length > 0) {
      context.globalPatterns.forEach((pattern) => {
        const aiDetected = pattern.ai_detected.toLowerCase().trim();
        globalCorrectionMap.set(aiDetected, {
          correctedName: pattern.user_corrected,
          userCount: pattern.user_count,
          totalCorrections: pattern.total_corrections,
          type: "global",
        });
      });
      console.log(
        `🌍 [HYBRID] Loaded ${globalCorrectionMap.size} global patterns (3+ users)`,
      );
    } else {
      console.log("🌍 [HYBRID] No global patterns available yet");
    }

    // STEP 2: Build USER correction map (personal preferences - overrides global)
    const userCorrectionMap = new Map();

    if (context.personalCorrections && context.personalCorrections.length > 0) {
      context.personalCorrections.forEach((correction) => {
        const aiDetected = correction.ai_detected
          ? correction.ai_detected.toLowerCase().trim()
          : correction.AiDetected.toLowerCase().trim();
        const userCorrected =
          correction.user_corrected || correction.UserCorrected;
        const timesCorrected =
          correction.times_corrected || correction.TimesCorrected;

        userCorrectionMap.set(aiDetected, {
          correctedName: userCorrected,
          timesCorrected: timesCorrected,
          type: "user",
        });
      });
      console.log(
        `👤 [HYBRID] Loaded ${userCorrectionMap.size} personal corrections`,
      );
    } else {
      console.log("👤 [HYBRID] No personal corrections found");
    }

    // STEP 3: Apply corrections with priority: User > Global > Original
    // Global corrections now include single-user corrections (threshold = 1)
    const correctedFoods = foods.map((food) => {
      const originalName = food.name;
      const normalizedName = originalName.toLowerCase().trim();

      // Priority 1: User-specific correction (highest priority)
      if (userCorrectionMap.has(normalizedName)) {
        const correction = userCorrectionMap.get(normalizedName);
        console.log(
          `✅ [USER] "${originalName}" → "${correction.correctedName}" (your preference, used ${correction.timesCorrected}x)`,
        );
        return {
          ...food,
          name: correction.correctedName,
          originalAiName: originalName,
          wasAutoCorrected: true,
          correctionType: "user",
          correctionSource: `Your preference (used ${correction.timesCorrected}x)`,
        };
      }

      // Priority 2: Global community correction (includes single-user corrections)
      if (globalCorrectionMap.has(normalizedName)) {
        const correction = globalCorrectionMap.get(normalizedName);
        const userLabel = correction.userCount === 1 ? '1 user' : `${correction.userCount} users`;
        console.log(
          `✅ [GLOBAL] "${originalName}" → "${correction.correctedName}" (${userLabel}, ${correction.totalCorrections} correction${correction.totalCorrections > 1 ? 's' : ''})`,
        );
        return {
          ...food,
          name: correction.correctedName,
          originalAiName: originalName,
          wasAutoCorrected: true,
          correctionType: "global",
          correctionSource: `Community (${userLabel})`,
        };
      }

      // Priority 3: No correction, use original AI detection
      console.log(`⚪ [NO MATCH] "${originalName}" (keeping AI detection)`);
      return food;
    });

    // Summary statistics
    const userCorrectedCount = correctedFoods.filter(
      (f) => f.correctionType === "user",
    ).length;
    const globalCorrectedCount = correctedFoods.filter(
      (f) => f.correctionType === "global",
    ).length;
    const totalCorrectedCount = userCorrectedCount + globalCorrectedCount;

    if (totalCorrectedCount > 0) {
      console.log(
        `🎯 [HYBRID] Applied ${totalCorrectedCount} corrections (${userCorrectedCount} personal, ${globalCorrectedCount} community)`,
      );
      console.log("\n📋 ========== HYBRID CORRECTION SUMMARY ==========");
      correctedFoods.forEach((food, index) => {
        if (food.wasAutoCorrected) {
          const icon = food.correctionType === "user" ? "👤" : "🌍";
          console.log(
            `${index + 1}. ${icon} "${food.originalAiName}" → "${food.name}" [${
              food.correctionSource
            }]`,
          );
        } else {
          console.log(`${index + 1}. 🤖 "${food.name}" (AI original)`);
        }
      });
      console.log("=================================================\n");
    } else {
      console.log(
        "📝 [HYBRID] No corrections applied, using all AI detections",
      );
    }

    return correctedFoods;
  } catch (error) {
    console.error("❌ [HYBRID] Error applying corrections:", error);
    // Fallback: Return original foods if correction fails
    return foods;
  }
};

/**
 * 🌍 GLOBAL AUTO-CORRECTION FEATURE
 * Get global auto-corrections lookup map (fresh data every time)
 * When ANY user corrects once, it applies to ALL users globally
 * @returns {Promise<Map>} Map of ai_detected -> corrected_name
 */
export const getGlobalCorrectionsMap = async () => {
  try {
    console.log("🌍 [GLOBAL-AUTO] Fetching corrections...");

    const response = await fetch(`${API_BASE_URL}/api/get-global-corrections`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

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
        `✅ [GLOBAL-AUTO] Loaded ${
          correctionMap.size
        } corrections (threshold: ${data.threshold || 1} user)`,
      );
    }

    return correctionMap;
  } catch (error) {
    console.error("❌ [GLOBAL-AUTO] Error:", error);
    return new Map(); // Return empty map on error
  }
};

/**
 * Apply global auto-corrections to AI-detected food names
 * 🎯 KEY FEATURE: If user A corrects "Roti" to "Chapathi",
 *    next time ANY user uploads Roti, it auto-corrects to Chapathi!
 * 🔗 CHAIN SUPPORT: Follows correction chains to final result
 *    "Golden Milk" → "Formula 1" → "Juice"
 *    Both "Golden Milk" AND "Formula 1" will show "Juice"
 * @param {Array} foods - Array of food items detected by AI
 * @returns {Promise<Array>} Foods with auto-corrected names
 */
export const applyGlobalAutoCorrections = async (foods) => {
  try {
    if (!foods || foods.length === 0) {
      return foods;
    }

    console.log(
      "🔄 [GLOBAL-AUTO] Checking auto-corrections for",
      foods.length,
      "items...",
    );

    // Fetch global corrections map
    const correctionMap = await getGlobalCorrectionsMap();

    if (correctionMap.size === 0) {
      console.log("⚠️ [GLOBAL-AUTO] No corrections available yet");
      return foods;
    }

    // Helper function to follow correction chains
    const followCorrectionChain = (foodName, visited = new Set()) => {
      const normalizedName = foodName.toLowerCase().trim();

      // Prevent infinite loops
      if (visited.has(normalizedName)) {
        return { finalName: foodName, chainLength: 0 };
      }
      visited.add(normalizedName);

      // Check if this name has a correction
      if (correctionMap.has(normalizedName)) {
        const correction = correctionMap.get(normalizedName);
        // Recursively follow the chain
        const nextStep = followCorrectionChain(
          correction.correctedName,
          visited,
        );
        return {
          finalName: nextStep.finalName,
          chainLength: 1 + nextStep.chainLength,
          correction: correction,
        };
      }

      // End of chain
      return { finalName: foodName, chainLength: 0 };
    };

    // Apply corrections with chain following
    const correctedFoods = foods.map((food) => {
      const originalName = food.name;
      const chainResult = followCorrectionChain(originalName);

      // If chain was followed (chainLength > 0)
      if (chainResult.chainLength > 0) {
        console.log(
          `✅ [AUTO-CORRECT] "${originalName}" → "${chainResult.finalName}" ` +
            `(chain: ${chainResult.chainLength} step${
              chainResult.chainLength > 1 ? "s" : ""
            }, ` +
            `${chainResult.correction.userCount} user${
              chainResult.correction.userCount > 1 ? "s" : ""
            })`,
        );

        return {
          ...food,
          name: chainResult.finalName,
          originalAiName: originalName,
          wasAutoCorrected: true,
          correctionSource: `Auto-corrected (${
            chainResult.correction.userCount
          } user${chainResult.correction.userCount > 1 ? "s" : ""})`,
        };
      }

      // No correction found
      return food;
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
    return foods; // Return original on error
  }
};
