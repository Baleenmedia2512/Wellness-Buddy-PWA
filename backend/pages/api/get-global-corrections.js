import { getSupabaseClient } from "../../utils/supabaseClient.js";

/**
 * Normalize food name for comparison
 * Handles variations like "Formula 1 - Chocolate" vs "Formula 1 Chocolate"
 * @param {string} name - Food name to normalize
 * @returns {string} Normalized food name
 */
function normalizeFoodName(name) {
  if (!name) return "";
  
  return name
    .toLowerCase()
    .trim()
    // Remove special characters but keep spaces
    .replace(/[-–—_()[\]{}]/g, " ")
    // Remove extra spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if a food name is ANY Herbalife product (should be global correction)
 * Any correction where the corrected name contains "herbalife" is treated as global
 * so all users see the same correction for that AI detection.
 * @param {string} foodName - Food name to check
 * @returns {boolean} True if it's any Herbalife product
 */
function isHerbalife(foodName) {
  if (!foodName) return false;
  // Normalize: lowercase and collapse all whitespace so "herbal life" and "herbalife" both match
  const normalized = foodName.toLowerCase().replace(/\s+/g, '');
  return normalized.includes('herbalife');
}

/**
 * API: Get Hybrid Auto-Corrections (Global + User-Specific)
 * Returns corrections that should be applied automatically
 * 
 * NEW LOGIC (Hybrid Mode):
 * 1. ANY Herbalife product correction → GLOBAL (apply to all users)
 * 2. Other food corrections → USER-SPECIFIC (only for that user)
 * 
 * Example flows:
 * - Balaji: "water" → "coconut water"
 *   Result: Only Balaji sees auto-correction for water
 * 
 * - Balaji: "milk" → "Herbalife Afresh Energy Drink Mix"
 *   Result: ALL users see auto-correction (global) — any Herbalife product is global
 * 
 * - Kiruba scans water → sees "water" (not auto-corrected)
 * - Kiruba scans milk → sees "Herbalife Afresh Energy Drink Mix" (global)
 * 
 * Query param: userId (optional) - if provided, returns user-specific corrections too
 */
export default async function handler(req, res) {
  // Set CORS headers and disable caching
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    
    // Extract userId from query params (optional)
    const requestingUserId = req.query.userId || null;

    console.log("🌍 [HYBRID-AUTO] Fetching hybrid correction patterns...");
    if (requestingUserId) {
      console.log(`   👤 User ID: ${requestingUserId} (will include user-specific corrections)`);
    } else {
      console.log(`   👤 No userId provided (global Herbalife corrections only)`);
    }

    // Fetch all corrections with LastCorrected timestamp for most recent override
    // Include corrected nutrition and quantity fields (AI values are in meals table)
    const { data: allCorrections, error } = await supabase
      .from("food_corrections_table")
      .select(`
        "AiDetected", "UserCorrected", "UserId", "TimesCorrected", "LastCorrected",
        "CorrectedQuantity", "CorrectedUnit", "CorrectedFoodType", 
        "CorrectedCalories", "CorrectedCarbs", "CorrectedProtein", "CorrectedFat", "CorrectedFiber"
      `)
      .order('"LastCorrected"', { ascending: false }); // Most recent first

    if (error) throw error;

    // Build map for each normalized AI detection -> list of all corrections
    const aiDetectionMap = new Map();

    if (allCorrections && allCorrections.length > 0) {
      allCorrections.forEach((row) => {
        const normalizedAi = normalizeFoodName(row.AiDetected);
        
        if (!aiDetectionMap.has(normalizedAi)) {
          aiDetectionMap.set(normalizedAi, []);
        }
        
        aiDetectionMap.get(normalizedAi).push({
          aiDetected: row.AiDetected,
          userCorrected: row.UserCorrected,
          userId: row.UserId,
          timesCorrected: row.TimesCorrected || 1,
          lastCorrected: row.LastCorrected,
          // Corrected nutrition values
          correctedQuantity: row.CorrectedQuantity,
          correctedUnit: row.CorrectedUnit,
          correctedFoodType: row.CorrectedFoodType,
          correctedCalories: row.CorrectedCalories,
          correctedCarbs: row.CorrectedCarbs,
          correctedProtein: row.CorrectedProtein,
          correctedFat: row.CorrectedFat,
          correctedFiber: row.CorrectedFiber,
        });
      });
    }

    // For each AI detection, find the MOST RECENT correction
    // Split into: GLOBAL (Herbalife F1) and USER-SPECIFIC (other foods)
    const globalCorrectionMap = new Map();  // Any Herbalife product (global)
    const userCorrectionMap = new Map();    // User's personal corrections
    
    aiDetectionMap.forEach((corrections, normalizedAi) => {
      // Sort all corrections by timestamp (most recent first)
      const sortedCorrections = corrections.sort((a, b) => 
        new Date(b.lastCorrected) - new Date(a.lastCorrected)
      );
      
      // GLOBAL: Any correction where the corrected name contains "Herbalife" → applies to ALL users
      // The most recent Herbalife correction for this AI word wins.
      const hasHerbalife = sortedCorrections.some(c => isHerbalife(c.userCorrected));
      
      if (hasHerbalife) {
        // Find the most recent Herbalife correction (sortedCorrections is already newest-first)
        const herbalifeCorrection = sortedCorrections.find(c => isHerbalife(c.userCorrected));
        
        if (herbalifeCorrection) {
          const uniqueUsers = new Set(
            corrections
              .filter(c => normalizeFoodName(c.userCorrected) === normalizeFoodName(herbalifeCorrection.userCorrected))
              .map(c => c.userId)
          );
          
          globalCorrectionMap.set(normalizedAi, {
            aiDetected: herbalifeCorrection.aiDetected,
            userCorrected: herbalifeCorrection.userCorrected,
            users: uniqueUsers,
            totalCorrections: herbalifeCorrection.timesCorrected,
            lastCorrected: herbalifeCorrection.lastCorrected,
            lastCorrectedByUserId: herbalifeCorrection.userId,
            correctedQuantity: herbalifeCorrection.correctedQuantity,
            correctedUnit: herbalifeCorrection.correctedUnit,
            correctedFoodType: herbalifeCorrection.correctedFoodType,
            correctedCalories: herbalifeCorrection.correctedCalories,
            correctedCarbs: herbalifeCorrection.correctedCarbs,
            correctedProtein: herbalifeCorrection.correctedProtein,
            correctedFat: herbalifeCorrection.correctedFat,
            correctedFiber: herbalifeCorrection.correctedFiber,
          });
          
          console.log(`   🌍 GLOBAL: "${normalizedAi}" → "${herbalifeCorrection.userCorrected}" (Herbalife product)`);
        }
      } else if (requestingUserId) {
        // USER-SPECIFIC: Non-Herbalife corrections only apply to the user who made them
        const userCorrection = sortedCorrections.find(c => String(c.userId) === String(requestingUserId));
        
        if (userCorrection) {
          const uniqueUsers = new Set(
            corrections
              .filter(c => normalizeFoodName(c.userCorrected) === normalizeFoodName(userCorrection.userCorrected))
              .map(c => c.userId)
          );
          
          userCorrectionMap.set(normalizedAi, {
            aiDetected: userCorrection.aiDetected,
            userCorrected: userCorrection.userCorrected,
            users: uniqueUsers,
            totalCorrections: userCorrection.timesCorrected,
            lastCorrected: userCorrection.lastCorrected,
            lastCorrectedByUserId: userCorrection.userId,
            correctedQuantity: userCorrection.correctedQuantity,
            correctedUnit: userCorrection.correctedUnit,
            correctedFoodType: userCorrection.correctedFoodType,
            correctedCalories: userCorrection.correctedCalories,
            correctedCarbs: userCorrection.correctedCarbs,
            correctedProtein: userCorrection.correctedProtein,
            correctedFat: userCorrection.correctedFat,
            correctedFiber: userCorrection.correctedFiber,
          });
          
          console.log(`   👤 USER-SPECIFIC: "${normalizedAi}" → "${userCorrection.userCorrected}" (User ${requestingUserId})`);
        }
      }
    });

    console.log("\n📋 [HYBRID] Correction summary:");
    console.log(`   🌍 Global (Herbalife F1): ${globalCorrectionMap.size} corrections`);
    console.log(`   👤 User-specific: ${userCorrectionMap.size} corrections`);

    // Build final correction maps (merge global + user-specific)
    const finalCorrectionMap = new Map();
    
    // Add global corrections (Herbalife F1)
    globalCorrectionMap.forEach((pattern, normalizedAi) => {
      finalCorrectionMap.set(normalizedAi, { ...pattern, isGlobal: true });
      console.log(`   ✅ GLOBAL: "${pattern.aiDetected}" → "${pattern.userCorrected}"`);
    });
    
    // Add user-specific corrections (non-Herbalife, user's own)
    userCorrectionMap.forEach((pattern, normalizedAi) => {
      // User-specific overrides global if same AI detection (edge case)
      finalCorrectionMap.set(normalizedAi, { ...pattern, isGlobal: false });
      console.log(`   ✅ USER: "${pattern.aiDetected}" → "${pattern.userCorrected}"`);
    });

    // Convert to array format
    const allPatterns = Array.from(finalCorrectionMap.values())
      .map((p) => ({
        ai_detected: p.aiDetected,
        user_corrected: p.userCorrected,
        user_count: p.users.size,
        total_corrections: p.totalCorrections,
        last_corrected_by_user_id: p.lastCorrectedByUserId,
        last_corrected: p.lastCorrected,
        is_global: p.isGlobal,
        confidence: 1.0,
        corrected_quantity: p.correctedQuantity,
        corrected_unit: p.correctedUnit,
        corrected_food_type: p.correctedFoodType,
        corrected_calories: p.correctedCalories,
        corrected_carbs: p.correctedCarbs,
        corrected_protein: p.correctedProtein,
        corrected_fat: p.correctedFat,
        corrected_fiber: p.correctedFiber,
      }));

    console.log(
      `✅ [HYBRID-AUTO] Returning ${allPatterns.length} total corrections (${globalCorrectionMap.size} global + ${userCorrectionMap.size} user)`,
    );

    // Create lookup map for O(1) access
    const correctionLookup = {};
    allPatterns.forEach((pattern) => {
      const key = pattern.ai_detected.toLowerCase().trim();
      correctionLookup[key] = {
        correctedName: pattern.user_corrected,
        userCount: pattern.user_count,
        totalCorrections: pattern.total_corrections,
        lastCorrectedByUserId: pattern.last_corrected_by_user_id,
        lastCorrected: pattern.last_corrected,
        isGlobal: pattern.is_global,
        confidence: pattern.confidence,
        correctedQuantity: pattern.corrected_quantity,
        correctedUnit: pattern.corrected_unit,
        correctedFoodType: pattern.corrected_food_type,
        correctedCalories: pattern.corrected_calories,
        correctedCarbs: pattern.corrected_carbs,
        correctedProtein: pattern.corrected_protein,
        correctedFat: pattern.corrected_fat,
        correctedFiber: pattern.corrected_fiber,
      };
    });

    // Debug: Log the final lookup map
    console.log("\n📋 [FINAL-LOOKUP] Hybrid correction lookup map:");
    console.table(
      Object.entries(correctionLookup).map(([ai, correction]) => ({
        'AI Detected': ai,
        'Will Show': correction.correctedName,
        'Type': correction.isGlobal ? '🌍 Global' : '👤 User',
        'Last Corrected': correction.lastCorrected,
      }))
    );
    console.log(`\n✅ Returning ${Object.keys(correctionLookup).length} corrections to frontend (hybrid mode!)\n`);

    res.status(200).json({
      success: true,
      patterns: allPatterns,
      lookup: correctionLookup,
      count: allPatterns.length,
      globalCount: globalCorrectionMap.size,
      userCount: userCorrectionMap.size,
      threshold: 1,
    });
    return;
  } catch (error) {
    console.error("❌ [GLOBAL-AUTO] Error:", error);
    res.status(500).json({
      error: "Failed to fetch global corrections",
      details: error.message,
    });
    return;
  }
}
