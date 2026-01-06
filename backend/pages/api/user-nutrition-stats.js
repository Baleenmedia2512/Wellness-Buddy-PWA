import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
    const pool = getPool();

    // If detailed nutrition data requested for dashboard
    if (detailed === 'true' && date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const [nutritionData] = await pool.execute(`
        SELECT 
          ID, ImagePath, ImageBase64, AnalysisData, ConfidenceScore,
          TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber,
          ProcessedBy, DeviceInfo,
          DATE_FORMAT(CreatedAt, '%Y-%m-%d %H:%i:%s') as CreatedAt,
          HOUR(CreatedAt) as meal_hour,
          CASE 
            WHEN HOUR(CreatedAt) >= 5 AND HOUR(CreatedAt) < 10 THEN 'breakfast'
            WHEN HOUR(CreatedAt) >= 10 AND HOUR(CreatedAt) < 12 THEN 'morning-snack'
            WHEN HOUR(CreatedAt) >= 12 AND HOUR(CreatedAt) < 16 THEN 'lunch'
            WHEN HOUR(CreatedAt) >= 16 AND HOUR(CreatedAt) < 18 THEN 'evening-snack'
            WHEN HOUR(CreatedAt) >= 18 AND HOUR(CreatedAt) < 23 THEN 'dinner'
            ELSE 'late-night'
          END as meal_category
        FROM food_nutrition_data_table 
        WHERE UserID = ? AND DATE(CreatedAt) >= ? AND DATE(CreatedAt) <= ? AND IsDeleted = 0
        ORDER BY CreatedAt DESC
      `, [userId, startOfDay.toISOString(), endOfDay.toISOString()]);

      // Calculate daily totals
      // Filter out records with empty foods array in AnalysisData
      const filteredNutritionData = nutritionData.filter(record => {
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

    // Get user statistics
    const [totalCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM food_nutrition_data_table WHERE UserID = ? AND IsDeleted = 0',
      [userId]
    );

    const [todayCount] = await pool.execute(
      'SELECT COUNT(*) as today FROM food_nutrition_data_table WHERE UserID = ? AND DATE(CreatedAt) = CURDATE() AND IsDeleted = 0',
      [userId]
    );

    const [weekCount] = await pool.execute(
      'SELECT COUNT(*) as week FROM food_nutrition_data_table WHERE UserID = ? AND CreatedAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND IsDeleted = 0',
      [userId]
    );

    const [backgroundCount] = await pool.execute(
      'SELECT COUNT(*) as background FROM food_nutrition_data_table WHERE UserID = ? AND ProcessedBy = "background_service" AND IsDeleted = 0',
      [userId]
    );

    // Get nutrition totals for the week
    const [weeklyNutrition] = await pool.execute(
      `SELECT 
        SUM(TotalCalories) as totalCalories,
        SUM(TotalProtein) as totalProtein,
        SUM(TotalCarbs) as totalCarbs,
        SUM(TotalFat) as totalFat,
        SUM(TotalFiber) as totalFiber
       FROM food_nutrition_data_table 
       WHERE UserID = ? AND CreatedAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND IsDeleted = 0`,
      [userId]
    );

    // Get daily nutrition for the last 7 days
    const [dailyNutrition] = await pool.execute(
      `SELECT 
        DATE(CreatedAt) as date,
        SUM(TotalCalories) as calories,
        SUM(TotalProtein) as protein,
        SUM(TotalCarbs) as carbs,
        SUM(TotalFat) as fat,
        COUNT(*) as meals
       FROM food_nutrition_data_table 
       WHERE UserID = ? AND CreatedAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND IsDeleted = 0
       GROUP BY DATE(CreatedAt)
       ORDER BY date DESC`,
      [userId]
    );

    // Get recent analyses
    const [recentAnalyses] = await pool.execute(
      `SELECT 
        ID, ImagePath, ImageBase64, TotalCalories, TotalProtein, TotalCarbs, TotalFat,
        ProcessedBy, CreatedAt
       FROM food_nutrition_data_table 
       WHERE UserID = ? AND IsDeleted = 0
       ORDER BY CreatedAt DESC 
       LIMIT 10`,
      [userId]
    );
res.status(200).json({
      success: true,
      userId: userId,
      statistics: {
        total: totalCount[0].total,
        today: todayCount[0].today,
        thisWeek: weekCount[0].week,
        backgroundProcessed: backgroundCount[0].background,
        manualProcessed: totalCount[0].total - backgroundCount[0].background
      },
      weeklyNutrition: {
        totalCalories: weeklyNutrition[0].totalCalories || 0,
        totalProtein: weeklyNutrition[0].totalProtein || 0,
        totalCarbs: weeklyNutrition[0].totalCarbs || 0,
        totalFat: weeklyNutrition[0].totalFat || 0,
        totalFiber: weeklyNutrition[0].totalFiber || 0
      },
      dailyNutrition: dailyNutrition,
      recentAnalyses: recentAnalyses
    });

  } catch (error) {
    console.error('Failed to get user statistics:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
