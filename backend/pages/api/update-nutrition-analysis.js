import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
   // Handle CORS
  if (req.method === 'OPTIONS') {
    // Handle CORS - set headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');
    res.status(200).end();
    return;
  }

  if (req.method !== 'PUT') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { id, userId, analysisData, totalCalories, totalProtein, totalCarbs, totalFat, totalFiber } = req.body;

    if (!id || !userId) {
      res.status(400).json({ success: false, message: 'Missing meal ID or userId' });
      return;
    }

    if (!analysisData || !analysisData.foods || !Array.isArray(analysisData.foods)) {
      res.status(400).json({ success: false, message: 'Invalid analysis data format' });
      return;
    }

    // Database connection
    const supabase = getSupabaseClient();

    // Update the meal WITH ownership validation (SECURITY + PERFORMANCE FIX)
    const { data, error } = await supabase
      .from('food_nutrition_data_table')
      .update({
        "AnalysisData": JSON.stringify(analysisData),
        "TotalCalories": totalCalories || 0,
        "TotalProtein": totalProtein || 0,
        "TotalCarbs": totalCarbs || 0,
        "TotalFat": totalFat || 0,
        "TotalFiber": totalFiber || 0
      })
      .eq('"ID"', id)
      .eq('"UserID"', userId)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      res.status(403).json({ success: false, message: 'Unauthorized or meal not found' });
      return;
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
