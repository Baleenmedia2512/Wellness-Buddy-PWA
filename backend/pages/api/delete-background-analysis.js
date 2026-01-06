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

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ 
      success: false,
      message: 'Analysis ID is required' 
    });
  }

  try {
    // Database connection
    const pool = getPool();

    // Delete the analysis record
    const [result] = await pool.execute(
      'UPDATE food_nutrition_data_table SET IsDeleted = 1 WHERE ID = ?',
      [id]
    );
    
if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found'
      });
    }

    // Clear cache - try to find userId from the record
    const [record] = await pool.execute(
      'SELECT UserID FROM food_nutrition_data_table WHERE ID = ?',
      [id]
    );
    if (record.length > 0 && record[0].UserID) {
      cache.delete(cacheKeys.educationSummary(record[0].UserID));
      console.log('🗑️ [delete-background-analysis] Cache cleared for user:', record[0].UserID);
    }

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
