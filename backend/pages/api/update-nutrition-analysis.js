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
    const { id, analysisData, totalCalories, totalProtein, totalCarbs, totalFat, totalFiber } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Missing meal ID' });
    }

    if (!analysisData || !analysisData.foods || !Array.isArray(analysisData.foods)) {
      return res.status(400).json({ success: false, message: 'Invalid analysis data format' });
    }

    // Database connection
    const pool = getPool();

    // Update the meal in the database
    const query = `
      UPDATE food_nutrition_data_table
      SET AnalysisData = ?,
          TotalCalories = ?,
          TotalProtein = ?,
          TotalCarbs = ?,
          TotalFat = ?,
          TotalFiber = ?
      WHERE ID = ?
    `;

    const [result] = await pool.execute(query, [
      JSON.stringify(analysisData),
      totalCalories || 0,
      totalProtein || 0,
      totalCarbs || 0,
      totalFat || 0,
      totalFiber || 0,
      id
    ]);
    
if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }

    // Get userId from the record and clear cache
    const [record] = await pool.execute(
      'SELECT UserID FROM food_nutrition_data_table WHERE ID = ?',
      [id]
    );
    if (record.length > 0 && record[0].UserID) {
      cache.delete(cacheKeys.educationSummary(record[0].UserID));
      console.log('🗑️ [update-nutrition-analysis] Cache cleared for user:', record[0].UserID);
    }

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
