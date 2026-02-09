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
    
    // Log initial food names being processed
    console.log('📝 [FOODS-INPUT] Processing these AI-detected items:');
    console.table(
      foods.map((food, idx) => ({
        '#': idx + 1,
        'AI Detected Name': food.name,
        'Quantity': food.quantity || 'N/A',
        'Calories': food.calories || 'N/A'
      }))
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

    // Debug: Show what's in the correction map
    console.log("\n🗺️ [CORRECTION-MAP] Available corrections:");
    console.table(
      Array.from(correctionMap.entries()).map(([aiName, correction]) => ({
        'AI Detected': aiName,
        'Will Show': correction.correctedName,
        'Users': correction.userCount
      }))
    );

    // Apply corrections with DIRECT LOOKUP ONLY
    // Backend already handles chain following, frontend just does exact match
    const correctedFoods = foods.map((food) => {
      const originalName = food.name;
      const normalizedOriginal = normalizeFoodName(originalName);
      
      console.log(`\n🔍 [LOOKUP] Checking: "${originalName}" (normalized: "${normalizedOriginal}")`);
      
      // Direct lookup - backend already followed chains
      if (correctionMap.has(normalizedOriginal)) {
        const correction = correctionMap.get(normalizedOriginal);
        console.log(`   ✅ Found correction: "${correction.correctedName}" (Last corrected by User ${correction.lastCorrectedByUserId})`);
        console.log(
          `✅ [AUTO-CORRECT] "${originalName}" → "${correction.correctedName}" ` +
            `(${correction.userCount} user${correction.userCount > 1 ? "s" : ""}, Last by User ${correction.lastCorrectedByUserId})`,
        );
        
        // ============================================
        // 📋 DETAILED CORRECTION LOG (Vercel-ready)
        // ============================================
        console.log(`
╔════════════════════════════════════════════════════════════════
║ 🔄 FOOD CORRECTION FLOW
╠════════════════════════════════════════════════════════════════
║ 🤖 AI Detected Name:    "${originalName}" (normalized: "${normalizedOriginal}")
║ 👤 User Corrected To:   "${correction.correctedName}"
║ 📊 Final Display Name:  "${correction.correctedName}"
║ 👥 Last Corrected By:   User ${correction.lastCorrectedByUserId}
║ 📈 Total Users:         ${correction.userCount} user(s)
╚════════════════════════════════════════════════════════════════
        `);
        
        // Individual runtime logs for Vercel
        console.log(`🤖 [AI-DETECTED] Original: ${originalName} (normalized: ${normalizedOriginal})`);
        console.log(`👤 [USER-CORRECTED] Mapped to: ${correction.correctedName}`);
        console.log(`📊 [FINAL-DISPLAY] Will show: ${correction.correctedName}`);
        console.log(`👥 [USER-COUNT] Corrected by: ${correction.userCount} user(s)`);
        console.log(`🆔 [LAST-USER-ID] Last corrected by: User ${correction.lastCorrectedByUserId}`);
        
        // Structured data for debugging
        console.log('[CORRECTION-DATA]', {
          aiDetected: originalName,
          aiDetectedNormalized: normalizedOriginal,
          userCorrected: correction.correctedName,
          finalDisplay: correction.correctedName,
          userCount: correction.userCount,
          lastCorrectedByUserId: correction.lastCorrectedByUserId,
          timestamp: new Date().toISOString()
        });

        return {
          ...food,
          name: correction.correctedName,
          originalAiName: originalName,
          wasAutoCorrected: true,
          correctionSource: `Auto-corrected (${correction.userCount} user${correction.userCount > 1 ? "s" : ""})`,
          // Additional metadata for runtime inspection
          correctionMetadata: {
            aiDetected: originalName,
            userCorrected: correction.correctedName,
            finalDisplay: correction.correctedName,
            userCount: correction.userCount
          }
        };
      }

      // No correction found - return with explicit flags
      console.log(`   ⚪ No correction found - using AI detected name`);
      console.log(`⚪ [NO-CORRECTION] "${originalName}" - Using AI detected name (no user corrections found)`);
      
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
      
      // Detailed summary table
      console.log('\n📊 [CORRECTION-SUMMARY] Auto-correction results:');
      console.table(
        correctedFoods
          .filter((f) => f.wasAutoCorrected)
          .map((f) => ({
            'AI Detected': f.originalAiName,
            'User Corrected': f.correctionMetadata?.userCorrected || 'N/A',
            'Final Display': f.name,
            'User Count': f.correctionMetadata?.userCount || 0
          }))
      );
    } else {
      console.log(`⚪ [GLOBAL-AUTO] ℹ No auto-corrections applied (0/${foods.length} items)`);
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
