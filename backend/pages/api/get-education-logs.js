import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only accept GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get userId from query params
  const { userId } = req.query;

  // Validation
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId is required'
    });
  }

  let connection;
  try {
    // Database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Fetch education logs (exclude soft-deleted)
    const [logs] = await connection.execute(
      `SELECT Id, Platform, Topic, 
       DATE_FORMAT(CreatedAt, '%Y-%m-%dT%H:%i:%s') as CreatedAt,
       Confidence, ImageBase64
       FROM education_logs_table
       WHERE UserId = ? AND (IsDeleted IS NULL OR IsDeleted = 0)
       ORDER BY CreatedAt DESC
       LIMIT 100`,
      [userId]
    );

    await connection.end();

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs: logs
    });

  } catch (error) {
    if (connection) {
      try { await connection.end(); } catch {}
    }
    console.error('❌ Fetch education logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch education logs',
      error: error.message
    });
  }
}
