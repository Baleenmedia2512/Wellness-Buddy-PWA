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
 * Get User Context API
 * Fetches personalized context for AI: user corrections, global patterns, diet preference, recent meals
 * Optimized single-call API for app startup
 */
export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, cache-control, pragma",
  );

  // Handle preflight request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { userId } = req.query;

    // Validate input
    if (!userId) {
      res.status(400).json({
        error: "Missing required parameter: userId",
      });
      return;
    }

    const startTime = Date.now();

    // Initialize Supabase client
    const supabase = getSupabaseClient();

    // Execute all queries in parallel for performance
    const [
      userCorrectionsResult,
      globalPatternsResult,
      userProfileResult,
      recentMealsResult,
    ] = await Promise.all([
      // 1. User's personal corrections (TOP 10 by frequency)
      supabase
        .from("food_corrections_table")
        .select('"AiDetected", "UserCorrected", "TimesCorrected"')
        .eq('"UserId"', userId)
        .order('"TimesCorrected"', { ascending: false })
        .order('"LastCorrected"', { ascending: false })
        .limit(10),

      // 2. Global correction patterns (fetch all with timestamps for most recent)
      supabase
        .from("food_corrections_table")
        .select('"AiDetected", "UserCorrected", "UserId", "TimesCorrected", "LastCorrected"')
        .order('"LastCorrected"', { ascending: false }), // Most recent first

      // 3. User profile (diet preference)
      supabase
        .from("team_table")
        .select('"DietType"')
        .eq('"UserId"', userId)
        .maybeSingle(),

      // 4. Recent meals (last 3 meals for context)
      supabase
        .from("food_nutrition_data_table")
        .select('"AnalysisData", "CreatedAt"')
        .eq('"UserId"', userId)
        .or('"IsDeleted".is.null,"IsDeleted".eq.0')
        .order('"CreatedAt"', { ascending: false })
        .limit(3),
    ]);

    // Process global patterns with MOST RECENT correction priority
    // Build map for each normalized AI detection -> list of all corrections
    const aiDetectionMap = new Map();
    
    if (globalPatternsResult.data) {
      globalPatternsResult.data.forEach((row) => {
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

    // For each AI detection, find the MOST RECENT correction
    const globalPatternsMap = new Map();
    
    aiDetectionMap.forEach((corrections, normalizedAi) => {
      // Group by normalized corrected name to count users
      const correctionGroups = new Map();
      
      corrections.forEach((corr) => {
        const normalizedCorrected = normalizeFoodName(corr.userCorrected);
        
        if (!correctionGroups.has(normalizedCorrected)) {
          correctionGroups.set(normalizedCorrected, {
            ai_detected: corr.aiDetected,
            user_corrected: corr.userCorrected,
            normalized_ai: normalizedAi,
            users: new Set(),
            total_corrections: 0,
            lastCorrected: corr.lastCorrected,
          });
        }
        
        const group = correctionGroups.get(normalizedCorrected);
        group.users.add(corr.userId);
        group.total_corrections += corr.timesCorrected;
        
        // Keep most recent timestamp
        if (new Date(corr.lastCorrected) > new Date(group.lastCorrected)) {
          group.lastCorrected = corr.lastCorrected;
          group.user_corrected = corr.userCorrected; // Use most recent version
        }
      });
      
      // Get the most recent correction (priority: most recent timestamp)
      const mostRecentCorrection = Array.from(correctionGroups.values())
        .sort((a, b) => new Date(b.lastCorrected) - new Date(a.lastCorrected))[0];
      
      if (mostRecentCorrection) {
        const key = `${normalizedAi}|${normalizeFoodName(mostRecentCorrection.user_corrected)}`;
        globalPatternsMap.set(key, mostRecentCorrection);
      }
    });

    // Build correction chain map for following corrections
    // Example: "Formula 1 Chocolate" → "Boost" → "Horlicks"
    // When AI detects "Formula 1 Chocolate", it follows chain to show "Horlicks"
    const correctionChainMap = new Map();
    globalPatternsMap.forEach((pattern) => {
      const normalizedAi = pattern.normalized_ai;
      if (!correctionChainMap.has(normalizedAi)) {
        correctionChainMap.set(normalizedAi, []);
      }
      correctionChainMap.get(normalizedAi).push({
        target: pattern.user_corrected,
        normalized_target: normalizeFoodName(pattern.user_corrected),
        total_corrections: pattern.total_corrections,
        user_count: pattern.users.size,
        lastCorrected: pattern.lastCorrected,
      });
    });

    // Sort each correction group by most recent first
    correctionChainMap.forEach((corrections, key) => {
      corrections.sort((a, b) => {
        // Sort by most recent timestamp
        return new Date(b.lastCorrected) - new Date(a.lastCorrected);
      });
    });

    // Function to follow correction chain using normalized names
    const followCorrectionChain = (foodName, visited = new Set()) => {
      const normalizedName = normalizeFoodName(foodName);
      
      console.log(`🔗 [CHAIN] Following: "${foodName}" (normalized: "${normalizedName}")`);
      
      // Prevent infinite loops
      if (visited.has(normalizedName)) {
        console.log(`⚠️ [CHAIN] Loop detected, stopping at: "${foodName}"`);
        return foodName;
      }
      visited.add(normalizedName);

      const corrections = correctionChainMap.get(normalizedName);
      if (!corrections || corrections.length === 0) {
        console.log(`✅ [CHAIN] End of chain: "${foodName}"`);
        return foodName;
      }

      // Get the most recent correction (first in sorted array)
      const mostRecentCorrection = corrections[0].target;
      console.log(`➡️ [CHAIN] Next link: "${foodName}" → "${mostRecentCorrection}"`);

      // Recursively follow the chain
      return followCorrectionChain(mostRecentCorrection, visited);
    };

    // Build final global patterns with chaining applied
    const finalGlobalPatterns = new Map();
    globalPatternsMap.forEach((pattern) => {
      const originalAiDetected = pattern.ai_detected;
      const normalizedAiDetected = pattern.normalized_ai;
      const finalCorrection = followCorrectionChain(originalAiDetected);

      // Only add if the chain actually leads to a different result
      if (normalizeFoodName(finalCorrection) !== normalizedAiDetected) {
        const key = `${normalizedAiDetected}|${normalizeFoodName(finalCorrection)}`;
        if (!finalGlobalPatterns.has(key)) {
          finalGlobalPatterns.set(key, {
            ai_detected: originalAiDetected,
            user_corrected: finalCorrection,
            user_count: pattern.users.size,
            total_corrections: pattern.total_corrections,
          });
        } else {
          // Merge counts if duplicate (shouldn't happen, but safety check)
          const existing = finalGlobalPatterns.get(key);
          existing.total_corrections += pattern.total_corrections;
        }
      }
    });

    // Convert to array with full chain following enabled
    const globalPatterns = Array.from(finalGlobalPatterns.values())
      .filter((p) => p.user_count >= 1) // Single user corrections affect all users
      .sort((a, b) => {
        // Sort by total corrections first (most frequent), then by user count
        if (b.total_corrections !== a.total_corrections)
          return b.total_corrections - a.total_corrections;
        return b.user_count - a.user_count;
      })
      .slice(0, 100); // Top 100 patterns for full chain coverage

    // Parse recent meals to extract food names
    const recentMeals = (recentMealsResult.data || [])
      .map((meal) => {
        try {
          const analysisData =
            typeof meal.AnalysisData === "string"
              ? JSON.parse(meal.AnalysisData)
              : meal.AnalysisData;

          // Extract food names from detailedItems
          const foodNames = (analysisData.detailedItems || [])
            .map((item) => item.name)
            .filter((name) => name);

          return {
            foods: foodNames,
            created_at: meal.CreatedAt,
          };
        } catch (e) {
          return { foods: [], created_at: meal.CreatedAt };
        }
      })
      .filter((meal) => meal.foods.length > 0);

    // Build response
    const context = {
      userId: parseInt(userId),
      personalCorrections: userCorrectionsResult.data || [],
      globalPatterns: globalPatterns,
      dietPreference: userProfileResult.data?.DietType || null,
      recentMeals: recentMeals,
      metadata: {
        totalPersonalCorrections: (userCorrectionsResult.data || []).length,
        totalGlobalPatterns: globalPatterns.length,
        totalRecentMeals: recentMeals.length,
        queryTimeMs: Date.now() - startTime,
      },
    };

    console.log(
      `✅ [get-user-context] Context loaded for userId ${userId} in ${context.metadata.queryTimeMs}ms`,
    );

    res.status(200).json({
      success: true,
      data: context,
    });
    return;
  } catch (error) {
    console.error("❌ [get-user-context] Error:", error);
    res.status(500).json({
      error: "Failed to fetch user context",
      details: error.message,
    });
    return;
  }
}
