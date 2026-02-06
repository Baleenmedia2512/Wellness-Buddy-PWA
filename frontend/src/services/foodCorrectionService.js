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

    // Apply global auto-corrections
    return await applyGlobalAutoCorrections(foods);
  } catch (error) {
    console.error("❌ [CORRECTION] Error processing foods:", error);
    // Fallback: Return original foods if processing fails
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

    // Add cache-busting timestamp to prevent caching issues on Vercel
    const cacheBuster = Date.now();
    const response = await fetch(
      `${API_BASE_URL}/api/get-global-corrections?t=${cacheBuster}`,
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
      // Return foods with explicit flags showing no auto-correction
      return foods.map((food) => ({
        ...food,
        originalAiName: food.name,
        wasAutoCorrected: false,
        correctionSource: null,
      }));
    }

    // Helper function to follow correction chains
    const followCorrectionChain = (foodName, visited = new Set()) => {
      const normalizedName = normalizeFoodName(foodName);

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
        console.log(`🤖 AI detected: ${originalName}`);
        console.log(`🔄 Auto corrected: ${chainResult.finalName}`);

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
