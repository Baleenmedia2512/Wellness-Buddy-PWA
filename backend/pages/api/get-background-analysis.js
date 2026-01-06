import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
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

    // Get background analysis results for the user
    const limitInt = parseInt(limit) || 50;
    const offsetInt = parseInt(offset) || 0;
    
    // First, try a simple query without LIMIT/OFFSET to test
    const [rows] = await pool.execute(
      `SELECT *
       FROM food_nutrition_data_table 
       WHERE UserID = ? AND IsDeleted = 0
       ORDER BY CreatedAt DESC`,
      [userId]
    );
    
    // Manually apply limit and offset to the results
    const paginatedRows = rows.slice(offsetInt, offsetInt + limitInt);

    // Get total count for pagination
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM food_nutrition_data_table WHERE UserID = ? AND IsDeleted = 0',
      [userId]
    );
res.status(200).json({
      success: true,
      data: paginatedRows,
      pagination: {
        total: countResult[0].total,
        limit: limitInt,
        offset: offsetInt,
        hasMore: (offsetInt + limitInt) < countResult[0].total
      }
    });

  } catch (error) {
    console.error('Failed to fetch background analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
