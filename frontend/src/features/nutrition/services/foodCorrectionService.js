import { cacheManager } from '../../../shared/services/cacheManager';

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
    .replace(/[-â€“â€”_()[\]{}]/g, " ")
    // Remove extra spaces
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Detect food type from unit (for type-safe corrections)
 * @param {string} unit - Unit of measurement (ml, g, oz, etc.)
 * @returns {string} 'liquid', 'solid', or 'unknown'
 */
const getFoodTypeByUnit = (unit) => {
  if (!unit) return 'unknown';
  
  const unitLower = unit.toLowerCase().trim();
  
  // Liquid units
  const liquidUnits = ['ml', 'milliliter', 'millilitre', 'l', 'liter', 'litre', 'fl oz', 'fluid ounce'];
  if (liquidUnits.some(u => unitLower.includes(u))) {
    return 'liquid';
  }
  
  // Solid units
  const solidUnits = ['g', 'gram', 'kg', 'kilogram', 'oz', 'ounce', 'lb', 'pound', 'piece', 'slice', 'serving', 'cup', 'bowl', 'plate'];
  if (solidUnits.some(u => unitLower === u || unitLower.includes(u))) {
    return 'solid';
  }
  
  return 'unknown';
};

/**
 * Save a food correction to the database
 * @param {number} userId - User ID
 * @param {string} aiDetected - Food name detected by AI
 * @param {string} userCorrected - Food name corrected by user
 * @param {Object} correctedData - Optional corrected nutrition and quantity data
 * @param {number} correctedData.correctedQuantity - User corrected quantity
 * @param {string} correctedData.correctedUnit - User corrected unit (ml, g, etc.)
 * @param {number} correctedData.correctedCalories - User corrected calories
 * @param {number} correctedData.correctedCarbs - User corrected carbs
 * @param {number} correctedData.correctedProtein - User corrected protein
 * @param {number} correctedData.correctedFat - User corrected fat
 * @param {number} correctedData.correctedFiber - User corrected fiber
 * @returns {Promise} API response
 */
export const saveFoodCorrection = async (userId, aiDetected, userCorrected, correctedData = {}) => {
  try {
    console.log("\nðŸ’¾ ========== SAVE CORRECTION API ==========");
    console.log("[CORRECTION SERVICE] saveFoodCorrection called:", {
      userId,
      aiDetected,
      userCorrected,
      correctedData,
    });
    
    // ðŸš¨ CRITICAL VALIDATION: Ensure aiDetected is the ORIGINAL AI name
    console.log("ðŸ” [VALIDATION] Checking if aiDetected is original AI name...");
    console.log("   - aiDetected:", aiDetected);
    console.log("   - Will save to DB:", { 
      UserId: userId, 
      AiDetected: aiDetected, 
      UserCorrected: userCorrected,
      CorrectedQuantity: correctedData.correctedQuantity,
    });

    // Don't save if both names are the same
    if (
      aiDetected.trim().toLowerCase() === userCorrected.trim().toLowerCase()
    ) {
      console.log("[CORRECTION SERVICE] âŒ Names are identical, skipping save");
      console.log("==========================================\n");
      return { success: false, message: "No correction needed" };
    }

    const url = `${API_BASE_URL}/api/food-corrections`;
    console.log("[CORRECTION SERVICE] API URL:", url);

    const payload = {
      userId,
      aiDetected: aiDetected.trim(),
      userCorrected: userCorrected.trim(),
      // Add corrected nutrition data if provided
      ...correctedData
    };
    console.log("[CORRECTION SERVICE] Payload:", payload);
    console.log("ðŸš€ [SENDING TO BACKEND] Will create/update DB record:");
    console.log("   ðŸ“Š food_corrections_table:");
    console.log("      - UserId:", userId);
    console.log("      - AiDetected:", aiDetected.trim());
    console.log("      - UserCorrected:", userCorrected.trim());
    console.log("\n   ðŸ” [GRAM/ML DEBUG] Corrected nutrition data being sent:");
    if (correctedData.correctedQuantity !== undefined) {
      console.log("      - CorrectedQuantity:", correctedData.correctedQuantity, "(Type:", typeof correctedData.correctedQuantity, ")");
    } else {
      console.log("      - CorrectedQuantity: âŒ MISSING/UNDEFINED");
    }
    if (correctedData.correctedUnit !== undefined) {
      console.log("      - CorrectedUnit:", correctedData.correctedUnit);
    } else {
      console.log("      - CorrectedUnit: âŒ MISSING/UNDEFINED");
    }
    if (correctedData.correctedCalories !== undefined) {
      console.log("      - CorrectedCalories:", correctedData.correctedCalories);
    }
    if (correctedData.correctedCarbs !== undefined) {
      console.log("      - CorrectedCarbs:", correctedData.correctedCarbs);
    }
    if (correctedData.correctedProtein !== undefined) {
      console.log("      - CorrectedProtein:", correctedData.correctedProtein);
    }
    if (correctedData.correctedFat !== undefined) {
      console.log("      - CorrectedFat:", correctedData.correctedFat);
    }
    if (correctedData.correctedFiber !== undefined) {
      console.log("      - CorrectedFiber:", correctedData.correctedFiber);
    }
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
    console.log("[CORRECTION SERVICE] âœ… Success:", data);
    
    // Clear cache so new correction applies immediately
    cacheManager.clearPattern('foodCorrection');
    cacheManager.clearPattern('globalCorrections');
    cacheManager.clearPattern('reverseLookup');
    
    return data;
  } catch (error) {
    console.error("[CORRECTION SERVICE] âŒ Error:", error);
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
      `${API_BASE_URL}/api/food-corrections?userId=${userId}`,
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
      console.log("ðŸ” [REVERSE-LOOKUP] Querying server for:", correctedName);
      
      const response = await fetch(
        `${API_BASE_URL}/api/token/reverse-lookup?correctedName=${encodeURIComponent(correctedName)}`,
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
        console.log("âœ… [REVERSE-LOOKUP] Found original AI name:", data.originalAiName);
        result = data.originalAiName;
      } else {
        console.log("â„¹ï¸ [REVERSE-LOOKUP] No correction mapping found");
      }
      
      return result;
    },
    cacheManager.ttls.reverseLookup
  );
};

/**
 * Apply hybrid corrections (global + user-specific) to AI-detected food names
 * ðŸŽ¯ NEW LOGIC:
 * - Herbalife Formula 1: Global corrections (all users see same correction)
 * - Other foods: User-specific corrections (only that user sees their corrections)
 * @param {Array} foods - Array of food items detected by AI
 * @param {number} userId - User ID for fetching user-specific corrections
 * @returns {Promise<Array>} Foods with corrected names
 */
export const applyUserCorrections = async (foods, userId) => {
  try {
    if (!foods || foods.length === 0) {
      return foods;
    }

    console.log(
      "ðŸ”„ [HYBRID-CORRECTION] Processing foods for userId:",
      userId,
      "- Hybrid mode (global Herbalife + user-specific)",
    );

    // Apply hybrid auto-corrections with current userId
    return await applyGlobalAutoCorrections(foods, userId);
  } catch (error) {
    console.error("âŒ [CORRECTION] Error processing foods:", error);
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
  console.log("ðŸ—‘ï¸ [CACHE] Cleared global corrections cache");
};

/**
 * ðŸŒ HYBRID AUTO-CORRECTION FEATURE
 * Get hybrid auto-corrections lookup map (cached with request deduplication)
 * Returns:
 * - Global corrections: Herbalife Formula 1 (applies to ALL users)
 * - User-specific corrections: Other foods (applies to specific user only)
 * @param {number} userId - User ID for fetching user-specific corrections
 * @returns {Promise<Map>} Map of ai_detected -> corrected_name
 */
export const getGlobalCorrectionsMap = async (userId = null) => {
  const cacheKey = cacheManager.generateKey('globalCorrections', userId || 'global');
  
  return cacheManager.execute(
    cacheKey,
    async () => {
      console.log("ðŸŒ [HYBRID-AUTO] Fetching corrections from server...");
      if (userId) {
        console.log(`   ðŸ‘¤ Including user-specific corrections for user ${userId}`);
      }

      const url = userId 
        ? `${API_BASE_URL}/api/food-corrections/global?userId=${userId}&t=${Date.now()}`
        : `${API_BASE_URL}/api/food-corrections/global?t=${Date.now()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
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

        const globalCount = data.globalCount || 0;
        const userCount = data.userCount || 0;
        
        console.log(
          `âœ… [HYBRID-AUTO] Loaded ${correctionMap.size} corrections (ðŸŒ ${globalCount} global + ðŸ‘¤ ${userCount} user)`,
        );
      }

      return correctionMap;
    },
    cacheManager.ttls.foodCorrections
  ).catch(error => {
    console.error("âŒ [HYBRID-AUTO] Error:", error);
    return new Map(); // Return empty map on error
  });
};

/**
 * Apply hybrid auto-corrections to AI-detected food names
 * ðŸŽ¯ NEW LOGIC (Hybrid Mode):
 * - Herbalife Formula 1: GLOBAL correction (applies to all users)
 * - Other foods: USER-SPECIFIC correction (only for that user)
 * 
 * Examples:
 * - Balaji corrects "water" â†’ "coconut water": Only Balaji sees it
 * - Balaji corrects "milk" â†’ "Herbalife Formula 1": ALL users see it
 * 
 * @param {Array} foods - Array of food items detected by AI
 * @param {number} currentUserId - Current logged in user ID (optional but recommended)
 * @returns {Promise<Array>} Foods with auto-corrected names
 */
export const applyGlobalAutoCorrections = async (foods, currentUserId = null) => {
  try {
    if (!foods || foods.length === 0) {
      return foods;
    }

    console.log(
      "ðŸ”„ [HYBRID-AUTO] Processing",
      foods.length,
      "items...",
    );
    if (currentUserId) {
      console.log(`   ðŸ‘¤ User ID: ${currentUserId} (will include user-specific corrections)`);
    } else {
      console.warn(`   âš ï¸ WARNING: No userId provided - only global Herbalife corrections will apply!`);
    }

    // Fetch hybrid corrections map (cached) - pass userId for user-specific corrections
    const correctionMap = await getGlobalCorrectionsMap(currentUserId);

    if (correctionMap.size === 0) {
      console.log("âš ï¸ [HYBRID-AUTO] No corrections available");
      return foods.map((food) => ({
        ...food,
        originalAiName: food.originalAiName || food.name,  // Preserve existing originalAiName
        wasAutoCorrected: false,
        correctionSource: null,
      }));
    }

    // ðŸ” DEBUG: Show what's in the correction map
    console.log(`ðŸ“‹ [HYBRID-AUTO] Correction map contains ${correctionMap.size} entries:`);
    correctionMap.forEach((correction, key) => {
      console.log(`   "${key}" â†’ "${correction.correctedName}" (${correction.isGlobal ? 'ðŸŒ Global' : 'ðŸ‘¤ User'})`);
    });

    // Keywords that identify liquid/shake foods eligible for autocorrection
    const liquidKeywords = [
      "shake", "juice", "milk", "lassi", "coffee", "tea", "water", "smoothie",
      "soup", "drink", "beverage", "cola", "soda", "beer", "wine", "cocktail",
      "latte", "cappuccino", "espresso", "formula 1", "herbalife",
    ];

    /**
     * Returns true if a food item is a liquid or shake (eligible for autocorrection).
     * Solid foods are skipped.
     */
    const isFoodLiquidOrShake = (food) => {
      if (food.isLiquid === true) return true;
      if (food.volume_ml !== null && food.volume_ml !== undefined) return true;
      if (food.unit && food.unit.toLowerCase().trim() === 'ml') return true;
      const nameLower = (food.name || "").toLowerCase();
      return liquidKeywords.some((kw) => nameLower.includes(kw));
    };

    // Apply corrections with DIRECT LOOKUP FIRST, then FUZZY MATCH
    const correctedFoods = foods.map((food) => {
      const originalName = food.name;
      const normalizedOriginal = normalizeFoodName(originalName);

      // ï¿½ CRITICAL: Preserve the very first AI detected name
      // If food already has originalAiName, keep it; otherwise use current name
      const trueOriginalAiName = food.originalAiName || originalName;

      // ðŸš« Solid foods are completely excluded from autocorrection
      if (!isFoodLiquidOrShake(food)) {
        console.log(`â­ï¸ [SOLID-FOOD] Skipping autocorrection for "${originalName}" (solid food)`);
        return {
          ...food,
          originalAiName: trueOriginalAiName,
          wasAutoCorrected: false,
          correctionSource: null,
        };
      }

      let correction = null;
      let matchType = null;

      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Exact lookup â€” backend already guarantees:
      //   user's latest correction  >  global (Herbalife) latest correction
      // So we just use whatever the map returns.
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (correctionMap.has(normalizedOriginal)) {
        correction = correctionMap.get(normalizedOriginal);
        matchType = 'exact';
        console.log(
          `âœ… [EXACT-${correction.isGlobal ? 'GLOBAL' : 'USER'}] "${originalName}" â†’ "${correction.correctedName}"`
        );
      }

      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Fuzzy / partial match â€” only if no exact match
      // Longest key wins; backend priority already baked into map values.
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (!correction) {
        console.log(`ðŸ” [FUZZY-MATCH] Trying partial match for "${originalName}" (normalized: "${normalizedOriginal}")`);

        let bestMatch = null;
        let bestMatchLength = 0;

        for (const [correctionKey, correctionValue] of correctionMap.entries()) {
          // Reverse fuzzy: AI-detected token is a substring of the correction key
          if (correctionKey.includes(normalizedOriginal) && normalizedOriginal.length >= 3) {
            if (correctionKey.length > bestMatchLength) {
              bestMatch = { correction: correctionValue, key: correctionKey };
              bestMatchLength = correctionKey.length;
            }
          }
        }

        if (bestMatch) {
          correction = bestMatch.correction;
          matchType = 'fuzzy-contained-in';
          console.log(
            `âœ… [FUZZY-${correction.isGlobal ? 'GLOBAL' : 'USER'}] "${originalName}" matches "${bestMatch.key}" â†’ "${correction.correctedName}"`
          );
        }
      }

      // No correction found
      if (!correction) {
        return {
          ...food,
          originalAiName: trueOriginalAiName,
          wasAutoCorrected: false,
          correctionSource: null,
        };
      }

      // Apply correction if found (exact or fuzzy)
      if (correction) {

        // Determine if this is a global (Herbalife) or user-specific correction
        const correctionType = correction.isGlobal ? 'ðŸŒ Global' : 'ðŸ‘¤ User';

        // Type safety check - only apply if food types match
        const shouldApplyCorrection = !correction.correctedFoodType ||
          !food.unit ||
          correction.correctedFoodType === 'unknown' ||
          getFoodTypeByUnit(food.unit) === correction.correctedFoodType;
        
        if (!shouldApplyCorrection) {
          console.log(`âš ï¸ [TYPE-MISMATCH] Skipping correction for "${originalName}" - food type doesn't match`);
          return {
            ...food,
            originalAiName: trueOriginalAiName,
            wasAutoCorrected: false,
            correctionSource: null,
          };
        }
        
        console.log(
          `âœ… [${correctionType}${matchType ? '-' + matchType.toUpperCase() : ''}] "${originalName}" â†’ "${correction.correctedName}" ` +
            `(${correction.userCount} user${correction.userCount > 1 ? "s" : ""}, match: ${matchType})`
        );

        // ðŸŽ¯ Apply EXACT corrected values from database (name, quantity, nutrition)
        // This ensures consistent user experience - what they corrected is what everyone sees
        
        const correctedFood = {
          ...food,
          name: correction.correctedName,
          originalAiName: trueOriginalAiName,
          wasAutoCorrected: true,
          correctionSource: `${correction.isGlobal ? 'Global' : 'Personal'} (${correction.userCount} user${correction.userCount > 1 ? "s" : ""})`,
          correctionMetadata: {
            aiDetected: trueOriginalAiName,
            userCorrected: correction.correctedName,
            finalDisplay: correction.correctedName,
            userCount: correction.userCount,
            isGlobal: correction.isGlobal
          },
          // Ensure per100g is explicitly preserved
          per100g: food.per100g || food.defaultServing?.per100g
        };

        // Apply corrected weight/volume if available AND recalculate nutrition
        if (correction.correctedQuantity !== undefined && correction.correctedQuantity !== null) {
          const isLiquid = correction.correctedUnit === 'ml';
          correctedFood.quantity = correction.correctedQuantity;
          correctedFood.grams = correction.correctedQuantity;
          correctedFood.weight_g = isLiquid ? null : correction.correctedQuantity;
          correctedFood.volume_ml = isLiquid ? correction.correctedQuantity : null;
          
          // Update serving object
          if (correctedFood.serving) {
            correctedFood.serving.grams = correction.correctedQuantity;
            correctedFood.serving.unit = correction.correctedUnit || (isLiquid ? 'ml' : 'g');
            correctedFood.serving.isLiquid = isLiquid;
          } else {
            correctedFood.serving = {
              grams: correction.correctedQuantity,
              unit: correction.correctedUnit || (isLiquid ? 'ml' : 'g'),
              isLiquid: isLiquid,
              description: `${correction.correctedQuantity}${correction.correctedUnit || (isLiquid ? 'ml' : 'g')}`
            };
          }
          
          console.log(`   âš–ï¸ Weight/Volume: ${food.quantity || food.grams || 'N/A'} â†’ ${correction.correctedQuantity}${correction.correctedUnit || 'g'}`);
        }
        
        if (correction.correctedUnit) {
          correctedFood.unit = correction.correctedUnit;
          correctedFood.isLiquid = correction.correctedUnit === 'ml';
        }
        
        // ðŸŽ¯ Apply EXACT corrected nutrition values from database (not recalculated)
        // Initialize nutrition object to ensure it exists
        if (!correctedFood.nutrition) {
          correctedFood.nutrition = {};
        }
        
        let nutritionApplied = false;
        
        if (correction.correctedCalories !== undefined && correction.correctedCalories !== null) {
          correctedFood.calories = correction.correctedCalories;
          correctedFood.nutrition.calories = correction.correctedCalories;
          nutritionApplied = true;
          console.log(`   ðŸ”¥ Calories: ${food.calories || 'N/A'} â†’ ${correction.correctedCalories} (from DB)`);
        }
        
        if (correction.correctedCarbs !== undefined && correction.correctedCarbs !== null) {
          correctedFood.carbs = correction.correctedCarbs;
          correctedFood.nutrition.carbs = correction.correctedCarbs;
          nutritionApplied = true;
          console.log(`   ðŸŒ¾ Carbs: ${food.carbs || 'N/A'} â†’ ${correction.correctedCarbs}g (from DB)`);
        }
        
        if (correction.correctedProtein !== undefined && correction.correctedProtein !== null) {
          correctedFood.protein = correction.correctedProtein;
          correctedFood.nutrition.protein = correction.correctedProtein;
          nutritionApplied = true;
          console.log(`   ðŸ¥© Protein: ${food.protein || 'N/A'} â†’ ${correction.correctedProtein}g (from DB)`);
        }
        
        if (correction.correctedFat !== undefined && correction.correctedFat !== null) {
          correctedFood.fat = correction.correctedFat;
          correctedFood.nutrition.fat = correction.correctedFat;
          nutritionApplied = true;
          console.log(`   ðŸ§ˆ Fat: ${food.fat || 'N/A'} â†’ ${correction.correctedFat}g (from DB)`);
        }
        
        if (correction.correctedFiber !== undefined && correction.correctedFiber !== null) {
          correctedFood.fiber = correction.correctedFiber;
          correctedFood.nutrition.fiber = correction.correctedFiber;
          nutritionApplied = true;
          console.log(`   ðŸŒ¿ Fiber: ${food.fiber || 'N/A'} â†’ ${correction.correctedFiber}g (from DB)`);
        }
        
        if (nutritionApplied) {
          console.log(`   âœ… Applied EXACT corrected nutrition values from database`);
          console.log(`   ðŸ“Š Final corrected object:`, JSON.stringify({
            name: correctedFood.name,
            calories: correctedFood.calories,
            carbs: correctedFood.carbs,
            protein: correctedFood.protein,
            nutrition: correctedFood.nutrition
          }, null, 2));
        } else {
          console.log(`   âš ï¸ No corrected nutrition values in database - keeping AI detected values`);
        }

        return correctedFood;
      }

      // No correction found - return with explicit flags
      console.log(`âŒ [NO-MATCH] No correction found for "${originalName}" (normalized: "${normalizedOriginal}")`);
      console.log(`   ðŸ” Checked against ${correctionMap.size} corrections in map (exact + fuzzy matching)`);
      console.log(`   ðŸ‘¤ Current userId: ${currentUserId || 'NOT PROVIDED'}`);
      
      return {
        ...food,
        originalAiName: trueOriginalAiName,  // Use preserved original AI name
        wasAutoCorrected: false,
        correctionSource: null,
      };
    });

    // Summary
    const correctedCount = correctedFoods.filter(
      (f) => f.wasAutoCorrected,
    ).length;
    
    const globalCount = correctedFoods.filter(
      (f) => f.wasAutoCorrected && f.correctionMetadata?.isGlobal
    ).length;
    
    const userCount = correctedCount - globalCount;
    
    if (correctedCount > 0) {
      console.log(
        `ðŸŽ¯ [HYBRID-AUTO] âœ“ ${correctedCount}/${foods.length} items auto-corrected (ðŸŒ ${globalCount} global + ðŸ‘¤ ${userCount} personal)`,
      );
    }

    return correctedFoods;
  } catch (error) {
    console.error("âŒ [GLOBAL-AUTO] Error:", error);
    // Return foods with explicit flags showing no auto-correction
    return foods.map((food) => ({
      ...food,
      originalAiName: food.name,
      wasAutoCorrected: false,
      correctionSource: null,
    }));
  }
};
