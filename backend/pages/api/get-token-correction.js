import mysql from 'mysql2/promise';

/**
 * API: Get Token Correction
 * Gets the latest token correction from token_correction_table
 * Also returns the latest usage timestamp to compare
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    console.log('📖 [get-token-correction] Database connected');

    // Get the latest correction record (most recent by CreatedAt)
    const [correctionRows] = await connection.execute(
      `SELECT 
        InputTokenCost as inputCost,
        OutputTokenCost as outputCost,
        TotalTokenCost as totalCost,
        CreatedAt as correctionTimestamp
      FROM token_correction_table 
      ORDER BY CreatedAt DESC 
      LIMIT 1`
    );

    // Get the latest usage timestamp from ai_token_usage_table
    const [usageRows] = await connection.execute(
      `SELECT CreatedAt as latestUsageTimestamp 
       FROM ai_token_usage_table 
       ORDER BY CreatedAt DESC 
       LIMIT 1`
    );

    const latestUsageTimestamp = usageRows.length > 0 ? usageRows[0].latestUsageTimestamp : null;

    if (correctionRows.length === 0) {
      console.log('📖 [get-token-correction] No correction record found');
      return res.status(200).json({
        success: true,
        data: null,
        latestUsageTimestamp,
        message: 'No correction record found'
      });
    }

    const correction = correctionRows[0];
    console.log('📖 [get-token-correction] Found correction:', correction);
    console.log('📖 [get-token-correction] Latest usage timestamp:', latestUsageTimestamp);

    return res.status(200).json({
      success: true,
      data: correction,
      latestUsageTimestamp
    });

  } catch (error) {
    console.error('❌ [get-token-correction] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database error',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
