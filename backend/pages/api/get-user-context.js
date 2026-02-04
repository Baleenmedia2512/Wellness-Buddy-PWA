import { getSupabaseClient } from "../../utils/supabaseClient.js";

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

      // 2. Global correction patterns (TOP 5 by total users)
      // Note: Supabase doesn't support complex aggregations easily, so we'll fetch and process
      supabase
        .from("food_corrections_table")
        .select('"AiDetected", "UserCorrected", "UserId", "TimesCorrected"'),

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

    // Process global patterns (aggregate in JavaScript)
    const globalPatternsMap = new Map();
    if (globalPatternsResult.data) {
      globalPatternsResult.data.forEach((row) => {
        const key = `${row.AiDetected}|${row.UserCorrected}`;
        if (!globalPatternsMap.has(key)) {
          globalPatternsMap.set(key, {
            ai_detected: row.AiDetected,
            user_corrected: row.UserCorrected,
            users: new Set(),
            total_corrections: 0,
          });
        }
        const pattern = globalPatternsMap.get(key);
        pattern.users.add(row.UserId);
        pattern.total_corrections += row.TimesCorrected || 1;
      });
    }

    // Build correction chain map for following corrections
    // Example: Juice → Milk, Milk → Tea = Juice should show Tea
    const correctionChainMap = new Map();
    globalPatternsMap.forEach((pattern) => {
      if (!correctionChainMap.has(pattern.ai_detected)) {
        correctionChainMap.set(pattern.ai_detected, []);
      }
      correctionChainMap.get(pattern.ai_detected).push({
        target: pattern.user_corrected,
        total_corrections: pattern.total_corrections,
        user_count: pattern.users.size,
      });
    });

    // Sort each correction group by priority (most corrections first)
    correctionChainMap.forEach((corrections, key) => {
      corrections.sort((a, b) => {
        if (b.total_corrections !== a.total_corrections)
          return b.total_corrections - a.total_corrections;
        return b.user_count - a.user_count;
      });
    });

    // Function to follow correction chain
    const followCorrectionChain = (foodName, visited = new Set()) => {
      // Prevent infinite loops
      if (visited.has(foodName)) return foodName;
      visited.add(foodName);

      const corrections = correctionChainMap.get(foodName);
      if (!corrections || corrections.length === 0) return foodName;

      // Get the most popular correction
      const bestCorrection = corrections[0].target;

      // Recursively follow the chain
      return followCorrectionChain(bestCorrection, visited);
    };

    // Build final global patterns with chaining applied
    const finalGlobalPatterns = new Map();
    globalPatternsMap.forEach((pattern) => {
      const originalAiDetected = pattern.ai_detected;
      const finalCorrection = followCorrectionChain(originalAiDetected);

      // Only add if the chain actually leads to a different result
      if (finalCorrection !== originalAiDetected) {
        const key = `${originalAiDetected}|${finalCorrection}`;
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

    // Convert to array and filter by user count >= 1 (ANY correction becomes global)
    // This allows correction chaining: juice → milk → tea = juice shows tea
    const globalPatterns = Array.from(finalGlobalPatterns.values())
      .filter((p) => p.user_count >= 1) // Single user corrections affect all users
      .sort((a, b) => {
        // Sort by total corrections first (most frequent), then by user count
        if (b.total_corrections !== a.total_corrections)
          return b.total_corrections - a.total_corrections;
        return b.user_count - a.user_count;
      })
      .slice(0, 20); // Top 20 patterns

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
