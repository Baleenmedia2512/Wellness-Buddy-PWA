import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (uses REST API via HTTPS - not blocked)
const getSupabaseClient = () => {
  return createClient(
    process.env.SUPABASE_URL || 'https://lnvvaeudhtazvxtmifeg.supabase.co',
    process.env.SUPABASE_ANON_KEY
  );
};

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, date, startDate, endDate, detailed = 'false' } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'UserId is required' });
  }

  try {
    const supabase = getSupabaseClient();

    // If detailed nutrition data requested for dashboard
    if (detailed === 'true' && date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Fetch nutrition data using Supabase
      const { data: nutritionData, error } = await supabase
        .from('food_nutrition_data_table')
        .select('ID, ImagePath, ImageBase64, AnalysisData, ConfidenceScore, TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber, ProcessedBy, DeviceInfo, CreatedAt')
        .eq('UserID', userId)
        .eq('IsDeleted', 0)
        .gte('CreatedAt', startOfDay.toISOString())
        .lte('CreatedAt', endOfDay.toISOString())
        .order('CreatedAt', { ascending: false });

      if (error) throw error;

      // Add meal_hour and meal_category on the server side
      const enrichedData = (nutritionData || []).map(record => {
        const createdAt = new Date(record.CreatedAt);
        const meal_hour = createdAt.getHours();
        let meal_category = 'late-night';
        
        if (meal_hour >= 5 && meal_hour < 10) meal_category = 'breakfast';
        else if (meal_hour >= 10 && meal_hour < 12) meal_category = 'morning-snack';
        else if (meal_hour >= 12 && meal_hour < 16) meal_category = 'lunch';
        else if (meal_hour >= 16 && meal_hour < 18) meal_category = 'evening-snack';
        else if (meal_hour >= 18 && meal_hour < 23) meal_category = 'dinner';
        
        return { ...record, meal_hour, meal_category };
      });

      // Filter out records with empty foods array in AnalysisData
      const filteredNutritionData = enrichedData.filter(record => {
        try {
          const data = JSON.parse(record.AnalysisData);
          return Array.isArray(data.foods) && data.foods.length > 0;
        } catch {
          return true; // keep if cannot parse (to avoid hiding valid but malformed data)
        }
      });

      const dailyTotals = filteredNutritionData.reduce((totals, record) => ({
        totalCalories: totals.totalCalories + (record.TotalCalories || 0),
        totalProtein: totals.totalProtein + (record.TotalProtein || 0),
        totalCarbs: totals.totalCarbs + (record.TotalCarbs || 0),
        totalFat: totals.totalFat + (record.TotalFat || 0),
        totalFiber: totals.totalFiber + (record.TotalFiber || 0),
        mealCount: totals.mealCount + 1
      }), {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
        mealCount: 0
      });
return res.status(200).json({
        success: true,
        data: filteredNutritionData,
        dailyTotals: {
          ...dailyTotals,
          totalCalories: Math.round(dailyTotals.totalCalories * 100) / 100,
          totalProtein: Math.round(dailyTotals.totalProtein * 100) / 100,
          totalCarbs: Math.round(dailyTotals.totalCarbs * 100) / 100,
          totalFat: Math.round(dailyTotals.totalFat * 100) / 100,
          totalFiber: Math.round(dailyTotals.totalFiber * 100) / 100
        },
        queryInfo: { userId, date, recordCount: filteredNutritionData.length }
      });
    }

    // Get user statistics using Supabase
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Total count
    const { count: totalCount, error: totalError } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact', head: true })
      .eq('UserID', userId)
      .eq('IsDeleted', 0);

    if (totalError) throw totalError;

    // Today count
    const { count: todayCount, error: todayError } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact', head: true })
      .eq('UserID', userId)
      .eq('IsDeleted', 0)
      .gte('CreatedAt', today.toISOString());

    if (todayError) throw todayError;

    // Week count
    const { count: weekCount, error: weekError } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact', head: true })
      .eq('UserID', userId)
      .eq('IsDeleted', 0)
      .gte('CreatedAt', weekAgo.toISOString());

    if (weekError) throw weekError;

    // Background count
    const { count: backgroundCount, error: backgroundError } = await supabase
      .from('food_nutrition_data_table')
      .select('*', { count: 'exact', head: true })
      .eq('UserID', userId)
      .eq('ProcessedBy', 'background_service')
      .eq('IsDeleted', 0);

    if (backgroundError) throw backgroundError;

    // Get weekly nutrition data
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('food_nutrition_data_table')
      .select('TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber')
      .eq('UserID', userId)
      .eq('IsDeleted', 0)
      .gte('CreatedAt', weekAgo.toISOString());

    if (weeklyError) throw weeklyError;

    const weeklyNutrition = (weeklyData || []).reduce((totals, record) => ({
      totalCalories: totals.totalCalories + (record.TotalCalories || 0),
      totalProtein: totals.totalProtein + (record.TotalProtein || 0),
      totalCarbs: totals.totalCarbs + (record.TotalCarbs || 0),
      totalFat: totals.totalFat + (record.TotalFat || 0),
      totalFiber: totals.totalFiber + (record.TotalFiber || 0)
    }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0 });

    // Get daily nutrition (manually group by date)
    const dailyMap = {};
    (weeklyData || []).forEach(record => {
      const date = new Date(record.CreatedAt).toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
      }
      dailyMap[date].calories += record.TotalCalories || 0;
      dailyMap[date].protein += record.TotalProtein || 0;
      dailyMap[date].carbs += record.TotalCarbs || 0;
      dailyMap[date].fat += record.TotalFat || 0;
      dailyMap[date].meals += 1;
    });
    const dailyNutrition = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

    // Get recent analyses
    const { data: recentAnalyses, error: recentError } = await supabase
      .from('food_nutrition_data_table')
      .select('ID, ImagePath, ImageBase64, TotalCalories, TotalProtein, TotalCarbs, TotalFat, ProcessedBy, CreatedAt')
      .eq('UserID', userId)
      .eq('IsDeleted', 0)
      .order('CreatedAt', { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    res.status(200).json({
      success: true,
      userId: userId,
      statistics: {
        total: totalCount || 0,
        today: todayCount || 0,
        thisWeek: weekCount || 0,
        backgroundProcessed: backgroundCount || 0,
        manualProcessed: (totalCount || 0) - (backgroundCount || 0)
      },
      weeklyNutrition: weeklyNutrition,
      dailyNutrition: dailyNutrition,
      recentAnalyses: recentAnalyses || []
    });

  } catch (error) {
    console.error('Failed to get user statistics:', error);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    // Enhanced error messages for different error types
    let errorMessage = 'Failed to fetch user nutrition statistics';
    
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Database connection timeout. Please try again.';
    } else if (error.message?.includes('Connection terminated')) {
      errorMessage = 'Database connection was terminated. Retrying...';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Database connection refused. Please check if database is accessible.';
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
