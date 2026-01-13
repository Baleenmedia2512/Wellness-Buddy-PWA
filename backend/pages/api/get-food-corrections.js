import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    // Validate input
    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: userId'
      });
    }

    // Database connection
    const pool = getPool();

    // Fetch user's corrections ordered by frequency
    const [corrections] = await pool.execute(
      `SELECT 
        Id as id,
        AiDetected as ai_detected,
        UserCorrected as user_corrected,
        TimesCorrected as times_corrected,
        CreatedAt as created_at,
        LastCorrected as last_corrected
       FROM food_corrections_table 
       WHERE UserId = ? 
       ORDER BY TimesCorrected DESC, LastCorrected DESC`,
      [userId]
    );
return res.status(200).json({
      success: true,
      data: corrections,
      count: corrections.length
    });
  } catch (error) {
    console.error('Error fetching food corrections:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch corrections',
      details: error.message 
    });
  }
}
