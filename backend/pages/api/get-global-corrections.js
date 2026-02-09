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
 * Threshold: 1+ users (ANY correction becomes global)
 * 
 * This enables correction chaining:
 * - User A: "juice" → "water" (affects all users)
 * - User B: "water" → "sprite" (overrides, affects all users)
 * - Result: All users now see "sprite" when AI detects "juice"
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
    const { data: allCorrections, error } = await supabase
      .from("food_corrections_table")
      .select('"AiDetected", "UserCorrected", "UserId", "TimesCorrected", "LastCorrected"')
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
        });
      });
    }

    // For each AI detection, find the MOST RECENT correction (override system)
    const correctionMap = new Map();
    
    aiDetectionMap.forEach((corrections, normalizedAi) => {
      // Group by normalized corrected name to count users
      const correctionGroups = new Map();
      
      corrections.forEach((corr) => {
        const normalizedCorrected = normalizeFoodName(corr.userCorrected);
        
        if (!correctionGroups.has(normalizedCorrected)) {
          correctionGroups.set(normalizedCorrected, {
            aiDetected: corr.aiDetected,
            userCorrected: corr.userCorrected,
            users: new Set(),
            totalCorrections: 0,
            lastCorrected: corr.lastCorrected,
          });
        }
        
        const group = correctionGroups.get(normalizedCorrected);
        group.users.add(corr.userId);
        group.totalCorrections += corr.timesCorrected;
        
        // Keep most recent timestamp
        if (new Date(corr.lastCorrected) > new Date(group.lastCorrected)) {
          group.lastCorrected = corr.lastCorrected;
          group.userCorrected = corr.userCorrected; // Use most recent version of name
        }
      });
      
      // Get the most recent correction (priority: most recent timestamp)
      const mostRecentCorrection = Array.from(correctionGroups.values())
        .sort((a, b) => new Date(b.lastCorrected) - new Date(a.lastCorrected))[0];
      
      if (mostRecentCorrection) {
        // Store with normalizedAi as key (DIRECT correction only)
        correctionMap.set(normalizedAi, mostRecentCorrection);
      }
    });

    console.log("\n📋 [CORRECTIONS] Direct corrections from database:");
    correctionMap.forEach((correction, aiName) => {
      console.log(`   "${aiName}" → "${correction.userCorrected}" (${correction.users.size} user(s))`);
    });

    // Use direct corrections only (NO chain following)
    console.log("\n🎯 [DIRECT-CORRECTIONS] Using DIRECT corrections only (NO chain following):");
    const finalCorrectionMap = new Map();
    correctionMap.forEach((pattern, normalizedAi) => {
      console.log(`\n📍 Direct correction: "${pattern.aiDetected}" → "${pattern.userCorrected}"`);
      
      // Add direct correction - now includes same-name corrections
      // This allows database entries like "black tea" → "Herbal Tea" to work
      finalCorrectionMap.set(normalizedAi, pattern);
      console.log(`   ✅ Added to correction map`);
    });

    // Convert to global patterns with chain following applied
    const globalPatterns = Array.from(finalCorrectionMap.values())
      .map((p) => ({
        ai_detected: p.aiDetected,
        user_corrected: p.userCorrected,
        user_count: p.users.size,
        total_corrections: p.totalCorrections,
        confidence: Math.min(p.users.size / 5, 1.0), // 0.2 to 1.0 confidence
      }))
      .sort((a, b) => {
        // Sort by user count first, then by total corrections
        if (b.user_count !== a.user_count) {
          return b.user_count - a.user_count;
        }
        return b.total_corrections - a.total_corrections;
      });

    console.log(
      `✅ [GLOBAL-AUTO] Found ${globalPatterns.length} global patterns`,
    );

    // Create lookup map for O(1) access - use MOST POPULAR correction
    const correctionLookup = {};
    globalPatterns.forEach((pattern) => {
      const key = pattern.ai_detected.toLowerCase().trim();
      // If multiple corrections exist, use most popular (higher user count)
      if (
        !correctionLookup[key] ||
        correctionLookup[key].user_count < pattern.user_count
      ) {
        correctionLookup[key] = {
          correctedName: pattern.user_corrected,
          userCount: pattern.user_count,
          totalCorrections: pattern.total_corrections,
          confidence: pattern.confidence,
        };
      }
    });

    // Debug: Log the final lookup map
    console.log("\n📋 [FINAL-LOOKUP] Correction lookup map being sent to frontend:");
    console.table(
      Object.entries(correctionLookup).map(([ai, correction]) => ({
        'AI Detected': ai,
        'Will Show': correction.correctedName,
        'Users': correction.userCount,
        'Corrections': correction.totalCorrections
      }))
    );
    console.log(`\n✅ Returning ${Object.keys(correctionLookup).length} corrections to frontend\n`);

    res.status(200).json({
      success: true,
      patterns: globalPatterns,
      lookup: correctionLookup,
      count: globalPatterns.length,
      threshold: 1, // 1 user minimum
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
