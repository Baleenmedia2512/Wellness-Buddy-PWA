import mysql from 'mysql2/promise';

/**
 * API Endpoint: Get Weight History
 * GET /api/get-weight-history?userId=123&limit=30
 * 
 * Retrieves weight history for a user with optional pagination
 */
export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { userId, limit = 30, offset = 0, startDate, endDate } = req.query;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    console.log('📊 Fetching weight history:', {
      userId,
      limit,
      offset,
      startDate,
      endDate
    });

    // Connect to database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Build query with optional date range
    let query = `
      SELECT 
        ID,
        UserID,
        WeightValue,
        WeightUnit,
        ImageBase64,
        OCRConfidence,
        OCRRawText,
        DeviceInfo,
        Notes,
        CreatedAt,
        UpdatedAt
      FROM weight_entries_table
      WHERE UserID = ? AND IsDeleted = 0
    `;

    const params = [userId];

    if (startDate) {
      query += ' AND CreatedAt >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND CreatedAt <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY CreatedAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [entries] = await connection.execute(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM weight_entries_table 
      WHERE UserID = ? AND IsDeleted = 0
    `;
    const countParams = [userId];

    if (startDate) {
      countQuery += ' AND CreatedAt >= ?';
      countParams.push(startDate);
    }

    if (endDate) {
      countQuery += ' AND CreatedAt <= ?';
      countParams.push(endDate);
    }

    const [countResult] = await connection.execute(countQuery, countParams);
    const totalEntries = countResult[0].total;

    // Calculate statistics
    let stats = null;
    if (entries.length > 0) {
      const weights = entries.map(e => e.WeightValue);
      const currentWeight = entries[0].WeightValue;
      const oldestWeight = entries[entries.length - 1].WeightValue;
      const weightChange = currentWeight - oldestWeight;
      
      stats = {
        currentWeight: currentWeight,
        currentUnit: entries[0].WeightUnit,
        oldestWeight: oldestWeight,
        weightChange: weightChange,
        changeDirection: weightChange > 0 ? 'gain' : weightChange < 0 ? 'loss' : 'stable',
        averageWeight: (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2),
        minWeight: Math.min(...weights),
        maxWeight: Math.max(...weights),
        totalEntries: totalEntries
      };
    }

    await connection.end();

    console.log(`✅ Retrieved ${entries.length} weight entries`);

    res.status(200).json({
      success: true,
      message: 'Weight history retrieved successfully',
      data: entries,
      stats: stats,
      pagination: {
        total: totalEntries,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + entries.length < totalEntries
      }
    });

  } catch (error) {
    console.error('❌ Error fetching weight history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve weight history',
      error: error.message
    });
  }
}
