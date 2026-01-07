import { getPool } from '../../utils/dbPool.js';

/**
 * API: Get Token Correction
 * Gets the latest token correction from token_correction_table
 * Also returns the latest usage timestamp to compare
 */
export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    // Use connection pool
    const pool = getPool();

    console.log('📖 [get-token-correction] Using connection pool');

    // Get the latest correction record (most recent by CreatedAt)
    const [correctionRows] = await pool.execute(
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
    const [usageRows] = await pool.execute(
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
      error: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : error.message
    });
  }
}
