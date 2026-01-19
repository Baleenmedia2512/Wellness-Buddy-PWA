import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { id, userId } = req.body;

  if (!id || !userId) {
    res.status(400).json({ 
      success: false,
      message: 'Analysis ID and userId are required' 
    });
    return;
  }

  try {
    // Database connection
    const supabase = getSupabaseClient();

    // Delete the analysis record WITH ownership validation (SECURITY FIX)
    const currentTime = getISTTimestamp();
    const { data, error } = await supabase
      .from('food_nutrition_data_table')
      .update({ "IsDeleted": 1, "UpdatedAt": currentTime })
      .eq('"ID"', id)
      .eq('"UserID"', userId)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized or analysis not found'
      });
      return;
    }

    // Clear nutrition cache only (no extra query needed - PERFORMANCE FIX)
    cache.delete(cacheKeys.nutritionMeals(userId));
    console.log('🗑️ [delete-background-analysis] Nutrition cache cleared for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Analysis deleted successfully',
      deletedId: id
    });

  } catch (error) {
    console.error('❌ Database delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete analysis',
      error: error.message
    });
  }
}
