import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wellness_buddy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let connection;

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

    // Create database connection
    connection = await mysql.createConnection(dbConfig);

    // Insert token usage record
    const insertQuery = `
      INSERT INTO ai_token_usage_table 
      (UserId, Email, OperationType, ModelName, InputTokens, OutputTokens, TotalTokens, InputTokenCost, OutputTokenCost, TotalTokenCost, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await connection.execute(insertQuery, [
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

    await connection.end();

    return res.status(200).json({
      success: true,
      message: 'Token usage saved successfully',
      id: result.insertId
    });

  } catch (error) {
    console.error('❌ Error saving token usage:', error);
    
    if (connection) {
      try {
        await connection.end();
      } catch (endError) {
        console.error('Error closing connection:', endError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to save token usage',
      error: error.message
    });
  }
}
