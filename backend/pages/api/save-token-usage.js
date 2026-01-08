import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { 
      userId, 
      email, 
      operationType, 
      modelName,
      inputTokens,
      outputTokens,
      totalTokens,
      inputTokenCost,
      outputTokenCost,
      totalTokenCost
    } = req.body;

    // Validate required fields
    if (!userId || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId and email are required' 
      });
    }

    if (!operationType || !modelName) {
      return res.status(400).json({ 
        success: false, 
        message: 'operationType and modelName are required' 
      });
    }

    if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token counts (inputTokens, outputTokens, totalTokens) are required' 
      });
    }

    // Use connection pool
    const pool = getPool();

    // Insert token usage record
    const insertQuery = `
      INSERT INTO ai_token_usage_table 
      (UserId, Email, OperationType, ModelName, InputTokens, OutputTokens, TotalTokens, InputTokenCost, OutputTokenCost, TotalTokenCost, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      userId,
      email,
      operationType,
      modelName,
      inputTokens || 0,
      outputTokens || 0,
      totalTokens || 0,
      inputTokenCost || 0,
      outputTokenCost || 0,
      totalTokenCost || 0
    ]);

    return res.status(200).json({
      success: true,
      message: 'Token usage saved successfully',
      id: result.insertId
    });

  } catch (error) {
    console.error('❌ Error saving token usage:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to save token usage',
      error: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : error.message
    });
  }
}
