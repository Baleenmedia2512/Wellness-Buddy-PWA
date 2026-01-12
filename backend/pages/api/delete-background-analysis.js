import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, userId } = req.body;

  if (!id || !userId) {
    return res.status(400).json({ 
      success: false,
      message: 'Analysis ID and userId are required' 
    });
  }

  try {
    // Database connection
    const pool = getPool();

    // Delete the analysis record WITH ownership validation (SECURITY FIX)
    const [result] = await pool.execute(
      'UPDATE `food_nutrition_data_table` SET `IsDeleted` = 1 WHERE `ID` = ? AND `UserID` = ?',
      [id, userId]
    );
    
if (result.affectedRows === 0) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized or analysis not found'
      });
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
