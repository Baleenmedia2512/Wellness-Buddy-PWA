import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
   // Handle CORS
  if (req.method === 'OPTIONS') {
    // Handle CORS - set headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { id, userId, analysisData, totalCalories, totalProtein, totalCarbs, totalFat, totalFiber } = req.body;

    if (!id || !userId) {
      return res.status(400).json({ success: false, message: 'Missing meal ID or userId' });
    }

    if (!analysisData || !analysisData.foods || !Array.isArray(analysisData.foods)) {
      return res.status(400).json({ success: false, message: 'Invalid analysis data format' });
    }

    // Database connection
    const pool = getPool();

    // Update the meal WITH ownership validation (SECURITY + PERFORMANCE FIX)
    const query = `
      UPDATE \`food_nutrition_data_table\`
      SET \`AnalysisData\` = ?,
          \`TotalCalories\` = ?,
          \`TotalProtein\` = ?,
          \`TotalCarbs\` = ?,
          \`TotalFat\` = ?,
          \`TotalFiber\` = ?
      WHERE \`ID\` = ? AND \`UserID\` = ?
    `;

    const [result] = await pool.execute(query, [
      JSON.stringify(analysisData),
      totalCalories || 0,
      totalProtein || 0,
      totalCarbs || 0,
      totalFat || 0,
      totalFiber || 0,
      id,
      userId
    ]);
    
if (result.affectedRows === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized or meal not found' });
    }

    // Clear nutrition cache only (no extra query - PERFORMANCE FIX)
    cache.delete(cacheKeys.nutritionMeals(userId));
    console.log('🗑️ [update-nutrition-analysis] Nutrition cache cleared for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Meal updated successfully',
      data: {
        id,
        analysisData,
        nutrition: {
          calories: totalCalories || 0,
          protein: totalProtein || 0,
          carbs: totalCarbs || 0,
          fat: totalFat || 0,
          fiber: totalFiber || 0
        }
      }
    });
  } catch (error) {
    console.error('❌ Error updating nutrition analysis:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}
