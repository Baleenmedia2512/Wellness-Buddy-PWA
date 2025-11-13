import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, limit = 50, offset = 0 } =
    req.method === 'POST' ? req.body : req.query;

  if (!userId) {
    return res.status(400).json({
      message: 'Missing required field: userId',
    });
  }

  try {
    // Database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    // ✅ Get weight history for user
    const historyQuery = `
      SELECT 
        Id, 
        UserId, 
        Weight, 
        Bmi,
        BodyFat,
        MuscleMass,
        Bmr,
        WeightImageBase64,
        CreatedAt 
      FROM weight_records_table
      WHERE UserId = ?
      ORDER BY CreatedAt DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await connection.execute(historyQuery, [
      userId,
      parseInt(limit),
      parseInt(offset),
    ]);

    // ✅ Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM weight_records_table
      WHERE UserId = ?
    `;
    const [countRows] = await connection.execute(countQuery, [userId]);
    const totalCount = countRows[0].total;

    // ✅ Calculate statistics
    let stats = {
      totalEntries: totalCount,
      latestWeight: null,
      previousWeight: null,
      weightChange: null,
      averageWeight: null,
      minWeight: null,
      maxWeight: null,
    };

    if (rows.length > 0) {
      stats.latestWeight = {
        value: parseFloat(rows[0].Weight),
        date: rows[0].CreatedAt,
      };

      if (rows.length > 1) {
        stats.previousWeight = {
          value: parseFloat(rows[1].Weight),
          date: rows[1].CreatedAt,
        };
        stats.weightChange =
          parseFloat(rows[0].Weight) - parseFloat(rows[1].Weight);
      }

      const weights = rows.map((r) => parseFloat(r.Weight));
      stats.averageWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
      stats.minWeight = Math.min(...weights);
      stats.maxWeight = Math.max(...weights);
    }

    await connection.end();

    res.status(200).json({
      success: true,
      data: rows,
      stats,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + rows.length < totalCount,
      },
    });
  } catch (error) {
    console.error('❌ Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve weight history',
      error: error.message,
    });
  }
}
