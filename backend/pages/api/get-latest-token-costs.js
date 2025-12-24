import mysql from 'mysql2/promise';

/**
 * API: Get Latest Token Costs
 * Fetches the most recent input and output token costs from ai_token_usage_table
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

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email is required' 
    });
  }

  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    });

    console.log('📊 [get-latest-token-costs] Database connected');
    console.log('📊 [get-latest-token-costs] Fetching latest token costs for:', email);

    // Get the most recent token usage record
    const [rows] = await connection.execute(
      `SELECT 
        InputTokenCost,
        OutputTokenCost,
        TotalTokenCost,
        CreatedAt
      FROM ai_token_usage_table 
      WHERE Email = ?
      ORDER BY CreatedAt DESC 
      LIMIT 1`,
      [email]
    );

    console.log('📊 [get-latest-token-costs] Query result:', rows);

    if (rows.length === 0) {
      console.log('⚠️ [get-latest-token-costs] No token usage records found');
      return res.status(404).json({
        success: false,
        message: 'No token usage records found'
      });
    }

    const latestRecord = rows[0];

    console.log('✅ [get-latest-token-costs] Latest costs fetched:', {
      inputCost: latestRecord.InputTokenCost,
      outputCost: latestRecord.OutputTokenCost,
      totalCost: latestRecord.TotalTokenCost,
      createdAt: latestRecord.CreatedAt
    });

    return res.status(200).json({
      success: true,
      data: {
        inputTokenCost: latestRecord.InputTokenCost,
        outputTokenCost: latestRecord.OutputTokenCost,
        totalTokenCost: latestRecord.TotalTokenCost,
        createdAt: latestRecord.CreatedAt
      }
    });

  } catch (error) {
    console.error('❌ [get-latest-token-costs] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch latest token costs',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
