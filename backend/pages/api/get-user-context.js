import { getPool } from '../../utils/dbPool.js';

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

    // Database connection
    const pool = getPool();

    // Execute all queries in parallel for performance
    const [
      userCorrectionsResult,
      globalPatternsResult,
      userProfileResult,
      recentMealsResult
    ] = await Promise.all([
      // 1. User's personal corrections (TOP 10 by frequency)
      pool.execute(
        `SELECT 
          AiDetected as ai_detected,
          UserCorrected as user_corrected,
          TimesCorrected as times_corrected
         FROM food_corrections_table 
         WHERE UserId = ? 
         ORDER BY TimesCorrected DESC, LastCorrected DESC
         LIMIT 10`,
        [userId]
      ),

      // 2. Global correction patterns (TOP 5 by total users)
      pool.execute(
        `SELECT 
          AiDetected as ai_detected,
          UserCorrected as user_corrected,
          COUNT(DISTINCT UserId) as user_count,
          SUM(TimesCorrected) as total_corrections
         FROM food_corrections_table 
         GROUP BY AiDetected, UserCorrected
         HAVING user_count >= 3
         ORDER BY user_count DESC, total_corrections DESC
         LIMIT 5`
      ),

      // 3. User profile (diet preference)
      pool.execute(
        `SELECT DietType as diet_type
         FROM team_table 
         WHERE UserId = ? 
         LIMIT 1`,
        [userId]
      ),

      // 4. Recent meals (last 3 meals for context)
      pool.execute(
        `SELECT 
          AnalysisData as analysis_data,
          CreatedAt as created_at
         FROM food_nutrition_data_table 
         WHERE UserId = ? AND (IsDeleted IS NULL OR IsDeleted = 0)
         ORDER BY CreatedAt DESC
         LIMIT 3`,
        [userId]
      )
    ]);
// Parse recent meals to extract food names
    const recentMeals = recentMealsResult[0].map(meal => {
      try {
        const analysisData = typeof meal.analysis_data === 'string' 
          ? JSON.parse(meal.analysis_data) 
          : meal.analysis_data;
        
        // Extract food names from detailedItems
        const foodNames = (analysisData.detailedItems || [])
          .map(item => item.name)
          .filter(name => name);
        
        return {
          foods: foodNames,
          created_at: meal.created_at
        };
      } catch (e) {
        return { foods: [], created_at: meal.created_at };
      }
    }).filter(meal => meal.foods.length > 0);

    // Build response
    const context = {
      userId: parseInt(userId),
      personalCorrections: userCorrectionsResult[0] || [],
      globalPatterns: globalPatternsResult[0] || [],
      dietPreference: userProfileResult[0][0]?.diet_type || null,
      recentMeals: recentMeals,
      metadata: {
        totalPersonalCorrections: userCorrectionsResult[0].length,
        totalGlobalPatterns: globalPatternsResult[0].length,
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
