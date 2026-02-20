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
 * API: Get Global Auto-Corrections
 * Returns corrections that should be applied automatically across all users
 * Logic: PURE TIMESTAMP-BASED - Latest correction time always wins
 * 
 * ⏰ NO PRIORITY, NO GROUPING, JUST LATEST TIME!
 * 
 * Example flow:
 * - User A at 10:00 AM: "milk" → "tea"
 * - User B at 2:00 PM: "milk" → "coffee" 
 * - Result: All users see "coffee" (most recent)
 * - User C at 5:00 PM: "milk" → "juice"
 * - Result: All users now see "juice" (latest wins!)
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

    console.log("🌍 [GLOBAL-AUTO] Fetching global correction patterns...");

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

    // For each AI detection, find the MOST RECENT correction (PURE TIMESTAMP-BASED)
    // ⏰ LOGIC: Latest correction time wins - no grouping, no priority, just time!
    const correctionMap = new Map();
    
    aiDetectionMap.forEach((corrections, normalizedAi) => {
      // Sort all corrections by timestamp (most recent first)
      const sortedCorrections = corrections.sort((a, b) => 
        new Date(b.lastCorrected) - new Date(a.lastCorrected)
      );
      
      // Take the absolute latest correction (first in sorted array)
      const latestCorrection = sortedCorrections[0];
      
      if (latestCorrection) {
        // Count unique users who made this correction (for logging only)
        const uniqueUsers = new Set(
          corrections
            .filter(c => normalizeFoodName(c.userCorrected) === normalizeFoodName(latestCorrection.userCorrected))
            .map(c => c.userId)
        );
        
        // Store with normalizedAi as key
        correctionMap.set(normalizedAi, {
          aiDetected: latestCorrection.aiDetected,
          userCorrected: latestCorrection.userCorrected,
          users: uniqueUsers,
          totalCorrections: latestCorrection.timesCorrected,
          lastCorrected: latestCorrection.lastCorrected,
          lastCorrectedByUserId: latestCorrection.userId,
          // Corrected nutrition values
          correctedQuantity: latestCorrection.correctedQuantity,
          correctedUnit: latestCorrection.correctedUnit,
          correctedFoodType: latestCorrection.correctedFoodType,
          correctedCalories: latestCorrection.correctedCalories,
          correctedCarbs: latestCorrection.correctedCarbs,
          correctedProtein: latestCorrection.correctedProtein,
          correctedFat: latestCorrection.correctedFat,
          correctedFiber: latestCorrection.correctedFiber,
        });
      }
    });

    console.log("\n📋 [CORRECTIONS] Latest timestamp-based corrections:");
    correctionMap.forEach((correction, aiName) => {
      console.log(`   "${aiName}" → "${correction.userCorrected}" (by User ${correction.lastCorrectedByUserId} at ${correction.lastCorrected})`);
    });

    // Use direct corrections (already sorted by timestamp)
    console.log("\n🎯 [TIMESTAMP-BASED] Using latest correction time for each AI detection:");
    const finalCorrectionMap = new Map();
    correctionMap.forEach((pattern, normalizedAi) => {
      console.log(`\n📍 Latest: "${pattern.aiDetected}" → "${pattern.userCorrected}" (${pattern.lastCorrected})`);
      
      // Add direct correction
      finalCorrectionMap.set(normalizedAi, pattern);
      console.log(`   ✅ Added to correction map`);
    });

    // Convert to global patterns (NO sorting by count - timestamp already determined order)
    const globalPatterns = Array.from(finalCorrectionMap.values())
      .map((p) => ({
        ai_detected: p.aiDetected,
        user_corrected: p.userCorrected,
        user_count: p.users.size,
        total_corrections: p.totalCorrections,
        last_corrected_by_user_id: p.lastCorrectedByUserId,
        last_corrected: p.lastCorrected,
        confidence: 1.0, // Full confidence - latest correction always wins
        // Corrected nutrition values
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
      `✅ [GLOBAL-AUTO] Found ${globalPatterns.length} global patterns (timestamp-based)`,
    );

    // Create lookup map for O(1) access - use LATEST TIMESTAMP correction
    const correctionLookup = {};
    globalPatterns.forEach((pattern) => {
      const key = pattern.ai_detected.toLowerCase().trim();
      // Store directly - already sorted by timestamp, one per AI detection
      correctionLookup[key] = {
        correctedName: pattern.user_corrected,
        userCount: pattern.user_count,
        totalCorrections: pattern.total_corrections,
        lastCorrectedByUserId: pattern.last_corrected_by_user_id,
        lastCorrected: pattern.last_corrected,
        confidence: pattern.confidence,
        // Corrected nutrition values
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
    console.log("\n📋 [FINAL-LOOKUP] Correction lookup map (timestamp-based):");
    console.table(
      Object.entries(correctionLookup).map(([ai, correction]) => ({
        'AI Detected': ai,
        'Will Show': correction.correctedName,
        'Last Corrected': correction.lastCorrected,
        'By User': correction.lastCorrectedByUserId
      }))
    );
    console.log(`\n✅ Returning ${Object.keys(correctionLookup).length} corrections to frontend (latest time wins!)\n`);

    res.status(200).json({
      success: true,
      patterns: globalPatterns,
      lookup: correctionLookup,
      count: globalPatterns.length,
      threshold: 1, // 1 correction minimum (pure timestamp-based)
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
