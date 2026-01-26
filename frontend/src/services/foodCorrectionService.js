const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";

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
 * Apply user's past corrections to AI-detected food names
 * @param {Array} foods - Array of food items detected by AI
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Foods with corrected names
 */
export const applyUserCorrections = async (foods, userId) => {
  try {
    if (!userId || !foods || foods.length === 0) {
      return foods;
    }

    console.log(
      "🔄 [AUTO-CORRECT] Fetching user corrections for userId:",
      userId,
    );

    // Fetch user's correction history
    const response = await getUserCorrections(userId);

    if (
      !response.success ||
      !response.corrections ||
      response.corrections.length === 0
    ) {
      console.log("📝 [AUTO-CORRECT] No corrections found for this user");
      return foods;
    }

    const corrections = response.corrections;
    console.log(
      `📝 [AUTO-CORRECT] Found ${corrections.length} corrections in database`,
    );

    // Create a map of AI detected names to user corrected names
    // Normalize to lowercase for case-insensitive matching
    const correctionMap = new Map();
    corrections.forEach((correction) => {
      const aiDetected = correction.ai_detected.toLowerCase().trim();
      const userCorrected = correction.user_corrected.trim();
      correctionMap.set(aiDetected, {
        correctedName: userCorrected,
        timesCorrected: correction.times_corrected,
        originalAiName: correction.ai_detected, // Keep original for logging
      });
      console.log(
        `📝 [AUTO-CORRECT] Loaded correction: "${aiDetected}" → "${userCorrected}"`,
      );
    });

    // Apply corrections to foods
    const correctedFoods = foods.map((food) => {
      const originalName = food.name;
      const normalizedName = originalName.toLowerCase().trim();

      console.log(
        `🔍 [AUTO-CORRECT] Checking: "${originalName}" (normalized: "${normalizedName}")`,
      );

      if (correctionMap.has(normalizedName)) {
        const correction = correctionMap.get(normalizedName);
        console.log(
          `✅ [AUTO-CORRECT] Applying correction: "${originalName}" → "${correction.correctedName}" (corrected ${correction.timesCorrected}x)`,
        );

        return {
          ...food,
          name: correction.correctedName,
          originalAiName: originalName, // Store original for reference
          wasAutoCorrected: true,
        };
      }

      console.log(`⚪ [AUTO-CORRECT] No match for: "${originalName}"`);
      return food;
    });

    const correctedCount = correctedFoods.filter(
      (f) => f.wasAutoCorrected,
    ).length;

    if (correctedCount > 0) {
      console.log(
        `🎯 [AUTO-CORRECT] Applied ${correctedCount} automatic corrections`,
      );
      console.log("\n📋 ========== CORRECTION SUMMARY ==========");
      correctedFoods.forEach((food, index) => {
        if (food.wasAutoCorrected) {
          console.log(
            `${index + 1}. AI Detected: "${
              food.originalAiName
            }" ➜ Corrected: "${food.name}"`,
          );
        } else {
          console.log(`${index + 1}. "${food.name}" (no correction applied)`);
        }
      });
      console.log("==========================================\n");
    }

    return correctedFoods;
  } catch (error) {
    console.error("❌ [AUTO-CORRECT] Error applying corrections:", error);
    // Return original foods if correction fails
    return foods;
  }
};
