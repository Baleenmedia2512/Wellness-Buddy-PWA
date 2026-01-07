import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, limit = 50, offset = 0 } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'UserId is required' }); 
  }

  try {
    const pool = getPool();
    
    // Get pagination params
    const limitInt = parseInt(limit) || 50;
    const offsetInt = parseInt(offset) || 0;
    
    // Note: Removed caching for paginated responses since cache hit rate is low
    // Users rarely request the same page twice, making caching ineffective
    
    // Use proper SQL pagination (CRITICAL FIX: was fetching all rows and slicing)
    const [rows] = await pool.execute(
      `SELECT *
       FROM food_nutrition_data_table 
       WHERE UserID = ? AND IsDeleted = 0
       ORDER BY CreatedAt DESC
       LIMIT ? OFFSET ?`,
      [userId, limitInt, offsetInt]
    );

    // Get total count for pagination
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM food_nutrition_data_table WHERE UserID = ? AND IsDeleted = 0',
      [userId]
    );
    
    const response = {
      success: true,
      data: rows,
      pagination: {
        total: countResult[0].total,
        limit: limitInt,
        offset: offsetInt,
        hasMore: (offsetInt + limitInt) < countResult[0].total
      }
    };
    
    res.status(200).json(response);

  } catch (error) {
    console.error('Failed to fetch background analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
