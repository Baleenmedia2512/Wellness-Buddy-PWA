import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
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

    // 🔍 DEBUG: Log the foods data being saved
    console.log('\n📊 ============ DATABASE UPDATE ============');
    console.log('📋 TABLE: food_nutrition_data_table');
    console.log('🔄 ACTION: UPDATE (Meal Data)');
    console.log('🆔 Meal ID:', id);
    console.log('\n📝 Foods being saved:', JSON.stringify(analysisData.foods.map(f => ({
      name: f.name,
      weight_g: f.weight_g,
      volume_ml: f.volume_ml,
      grams: f.grams,
      unit: f.unit,
      isLiquid: f.isLiquid,
      portion: f.portion
    })), null, 2));
    console.log('\n💾 Executing UPDATE query...');

    // Database connection
    const supabase = getSupabaseClient();

    // Update the meal WITH ownership validation (SECURITY + PERFORMANCE FIX)
    const currentTime = getISTTimestamp();
    const { data, error } = await supabase
      .from('food_nutrition_data_table')
      .update({
        "AnalysisData": JSON.stringify(analysisData),
        "TotalCalories": totalCalories || 0,
        "TotalProtein": totalProtein || 0,
        "TotalCarbs": totalCarbs || 0,
        "TotalFat": totalFat || 0,
        "TotalFiber": totalFiber || 0,
        "UpdatedAt": currentTime
      })
      .eq('"ID"', id)
      .eq('"UserID"', userId)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      res.status(403).json({ success: false, message: 'Unauthorized or meal not found' });
      return;
    }

    // ✅ DEBUG: Confirm what was saved to database
    console.log('✅ UPDATE SUCCESS!');
    console.log('📊 TABLE: food_nutrition_data_table');
    console.log('   → Meal ID:', id);
    console.log('   → Foods saved:', data[0].AnalysisData ? JSON.parse(data[0].AnalysisData).foods.length : 0);
    console.log('   → Total Calories:', totalCalories);
    console.log('\n📝 Saved foods detail:');
    console.log(JSON.stringify(JSON.parse(data[0].AnalysisData).foods.map(f => ({
      name: f.name,
      weight_g: f.weight_g,
      volume_ml: f.volume_ml,
      unit: f.unit,
      isLiquid: f.isLiquid
    })), null, 2));
    console.log('==========================================\n');

    // Clear nutrition cache only (no extra query - PERFORMANCE FIX)
    cache.delete(cacheKeys.nutritionMeals(userId));
    console.log('🗑️ [update-nutrition-analysis] Nutrition cache cleared for user:', userId);

    // Update LastActiveAt in team_table to track user activity
    try {
      const { error: activityUpdateError } = await supabase
        .from('team_table')
        .update({ LastActiveAt: getISTTimestamp() })
        .eq('UserId', userId);
      
      if (activityUpdateError) {
        console.warn('⚠️ [update-nutrition-analysis] Failed to update LastActiveAt:', activityUpdateError);
      } else {
        console.log('✅ [update-nutrition-analysis] Updated LastActiveAt for user:', userId);
      }
    } catch (err) {
      console.warn('⚠️ [update-nutrition-analysis] Error updating LastActiveAt:', err);
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
