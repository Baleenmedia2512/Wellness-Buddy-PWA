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

  const { userId, includeImage = 'true' } =
    req.method === 'POST' ? req.body : req.query;

  if (!userId) {
    return res.status(400).json({
      message: 'Missing required field: userId',
    });
  }

  try {
    // Database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST ,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    // ✅ Get ALL weight history for user (no pagination - load everything)
    // Optionally exclude WeightImageBase64 for faster queries (duplicate check doesn't need images)
    const shouldIncludeImage = includeImage === 'true' || includeImage === true;
    const historyQuery = shouldIncludeImage 
      ? `
        SELECT 
          ID,
          UserId, 
          Weight, 
          Bmi,
          BodyFat,
          MuscleMass,
          Bmr,
          WeightImageBase64,
          CreatedAt 
        FROM weight_records_table
        WHERE UserId = ? AND (IsDeleted IS NULL OR IsDeleted = 0)
        ORDER BY CreatedAt DESC
      `
      : `
        SELECT 
          ID,
          UserId, 
          Weight, 
          Bmi,
          BodyFat,
          MuscleMass,
          Bmr,
          CreatedAt 
        FROM weight_records_table
        WHERE UserId = ? AND (IsDeleted IS NULL OR IsDeleted = 0)
        ORDER BY CreatedAt DESC
      `;

    const [rows] = await connection.execute(historyQuery, [userId]);

    // ✅ Calculate min/max/avg from the loaded data
    const weights = rows.map(r => parseFloat(r.Weight)).filter(w => !isNaN(w));
    const globalMinWeight = weights.length > 0 ? Math.min(...weights) : null;
    const globalMaxWeight = weights.length > 0 ? Math.max(...weights) : null;
    const globalAvgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
    const totalCount = rows.length;

    // ✅ Calculate statistics
    let stats = {
      totalEntries: totalCount,
      latestWeight: null,
      previousWeight: null,
      weightChange: null,
      averageWeight: globalAvgWeight,
      minWeight: globalMinWeight,
      maxWeight: globalMaxWeight,
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
    }

    await connection.end();

    res.status(200).json({
      success: true,
      data: rows,
      stats,
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
