import { getSupabaseClient } from "../../utils/supabaseClient.js";

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
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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

    // Fetch all corrections to build global patterns
    const { data: allCorrections, error } = await supabase
      .from("food_corrections_table")
      .select('"AiDetected", "UserCorrected", "UserId", "TimesCorrected"');

    if (error) throw error;

    // Build global correction map
    const correctionMap = new Map();

    if (allCorrections && allCorrections.length > 0) {
      allCorrections.forEach((row) => {
        const key = `${row.AiDetected.toLowerCase().trim()}|${row.UserCorrected.toLowerCase().trim()}`;

        if (!correctionMap.has(key)) {
          correctionMap.set(key, {
            aiDetected: row.AiDetected,
            userCorrected: row.UserCorrected,
            users: new Set(),
            totalCorrections: 0,
          });
        }

        const pattern = correctionMap.get(key);
        pattern.users.add(row.UserId);
        pattern.totalCorrections += row.TimesCorrected || 1;
      });
    }

    // Convert all patterns to global patterns (threshold = 1 user)
    const globalPatterns = Array.from(correctionMap.values())
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
