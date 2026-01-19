import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { id, userId } = req.body; // userId optional but recommended for safety

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Analysis ID is required'
    });
    return;
  }

  
  try {
    const supabase = getSupabaseClient();

    // OPTIONAL safety: ensure this row belongs to the user (if you store UserID)
    if (userId) {
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('food_nutrition_data_table')
        .select('"ID"')
        .eq('"ID"', id)
        .eq('"UserID"', userId)
        .limit(1);

      if (ownerError) throw ownerError;

      if (!ownerCheck || ownerCheck.length === 0) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
        return;
      }
    }

    // Restore: flip IsDeleted back to 0
    const { data, error } = await supabase
      .from('food_nutrition_data_table')
      .update({ "IsDeleted": 0 })
      .eq('"ID"', id)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Analysis not found or already active'
      });
      return;
    }

    // Clear nutrition cache only (education is separate domain)
    if (userId) {
      cache.delete(cacheKeys.nutritionMeals(userId));
      console.log('🗑️ [undo-deleted-analysis] Nutrition cache cleared for user:', userId);
    }

    res.status(200).json({
      success: true,
      message: 'Analysis restored successfully',
      restoredId: id
    });
    return;
  } catch (error) {
    console.error('❌ Database undo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore analysis',
      error: error.message
    });
    return;
  }
}
