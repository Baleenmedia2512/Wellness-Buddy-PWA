import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, userId } = req.body; // userId optional but recommended for safety

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Analysis ID is required'
    });
  }

  
  try {
    const pool = getPool();

    // OPTIONAL safety: ensure this row belongs to the user (if you store UserID)
    if (userId) {
      const [ownerCheck] = await pool.execute(
        'SELECT `ID` FROM `food_nutrition_data_table` WHERE `ID` = ? AND `UserID` = ? LIMIT 1',
        [id, userId]
      );
      if (!ownerCheck.length) {
return res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
      }
    }

    // Restore: flip IsDeleted back to 0
    const [result] = await pool.execute(
      'UPDATE `food_nutrition_data_table` SET `IsDeleted` = 0 WHERE `ID` = ?',
      [id]
    );
    
if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found or already active'
      });
    }

    // Clear nutrition cache only (education is separate domain)
    if (userId) {
      cache.delete(cacheKeys.nutritionMeals(userId));
      console.log('🗑️ [undo-deleted-analysis] Nutrition cache cleared for user:', userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Analysis restored successfully',
      restoredId: id
    });
  } catch (error) {
    console.error('❌ Database undo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to restore analysis',
      error: error.message
    });
  }
}
