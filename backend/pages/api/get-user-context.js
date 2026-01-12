import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const getSupabaseClient = () => {
  if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY is not set in environment variables');
  }
  return createClient(
    process.env.SUPABASE_URL || 'https://lnvvaeudhtazvxtmifeg.supabase.co',
    process.env.SUPABASE_ANON_KEY
  );
};

/**
 * Get User Context API
 * Fetches personalized context for AI: user corrections, global patterns, diet preference, recent meals
 * Optimized single-call API for app startup
 */
export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    // Validate input
    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: userId'
      });
    }

    const startTime = Date.now();

    // Initialize Supabase client
    const supabase = getSupabaseClient();

    // Execute all queries in parallel for performance
    const [
      userCorrectionsResult,
      globalPatternsResult,
      userProfileResult,
      recentMealsResult
    ] = await Promise.all([
      // 1. User's personal corrections (TOP 10 by frequency)
      supabase
        .from('food_corrections_table')
        .select('"AiDetected", "UserCorrected", "TimesCorrected"')
        .eq('"UserId"', userId)
        .order('"TimesCorrected"', { ascending: false })
        .order('"LastCorrected"', { ascending: false })
        .limit(10),

      // 2. Global correction patterns (TOP 5 by total users)
      // Note: Supabase doesn't support complex aggregations easily, so we'll fetch and process
      supabase
        .from('food_corrections_table')
        .select('"AiDetected", "UserCorrected", "UserId", "TimesCorrected"'),

      // 3. User profile (diet preference)
      supabase
        .from('team_table')
        .select('"DietType"')
        .eq('"UserId"', userId)
        .maybeSingle(),

      // 4. Recent meals (last 3 meals for context)
      supabase
        .from('food_nutrition_data_table')
        .select('"AnalysisData", "CreatedAt"')
        .eq('"UserId"', userId)
        .or('"IsDeleted".is.null,"IsDeleted".eq.0')
        .order('"CreatedAt"', { ascending: false })
        .limit(3)
    ]);

    // Process global patterns (aggregate in JavaScript)
    const globalPatternsMap = new Map();
    if (globalPatternsResult.data) {
      globalPatternsResult.data.forEach(row => {
        const key = `${row.AiDetected}|${row.UserCorrected}`;
        if (!globalPatternsMap.has(key)) {
          globalPatternsMap.set(key, {
            ai_detected: row.AiDetected,
            user_corrected: row.UserCorrected,
            users: new Set(),
            total_corrections: 0
          });
        }
        const pattern = globalPatternsMap.get(key);
        pattern.users.add(row.UserId);
        pattern.total_corrections += row.TimesCorrected || 1;
      });
    }

    // Convert to array and filter by user count >= 3
    const globalPatterns = Array.from(globalPatternsMap.values())
      .filter(p => p.users.size >= 3)
      .map(p => ({
        ai_detected: p.ai_detected,
        user_corrected: p.user_corrected,
        user_count: p.users.size,
        total_corrections: p.total_corrections
      }))
      .sort((a, b) => {
        if (b.user_count !== a.user_count) return b.user_count - a.user_count;
        return b.total_corrections - a.total_corrections;
      })
      .slice(0, 5);

    // Parse recent meals to extract food names
    const recentMeals = (recentMealsResult.data || []).map(meal => {
      try {
        const analysisData = typeof meal.AnalysisData === 'string' 
          ? JSON.parse(meal.AnalysisData) 
          : meal.AnalysisData;
        
        // Extract food names from detailedItems
        const foodNames = (analysisData.detailedItems || [])
          .map(item => item.name)
          .filter(name => name);
        
        return {
          foods: foodNames,
          created_at: meal.CreatedAt
        };
      } catch (e) {
        return { foods: [], created_at: meal.CreatedAt };
      }
    }).filter(meal => meal.foods.length > 0);

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
        queryTimeMs: Date.now() - startTime
      }
    };

    console.log(`✅ [get-user-context] Context loaded for userId ${userId} in ${context.metadata.queryTimeMs}ms`);

    return res.status(200).json({
      success: true,
      data: context
    });
  } catch (error) {
    console.error('❌ [get-user-context] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user context',
      details: error.message 
    });
  }
}
