import { getPool } from '../../utils/dbPool.js';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Use connection pool
    const pool = getPool();

    // Test queries
    const [tables] = await pool.execute('SHOW TABLES');
    const [teamCount] = await pool.execute('SELECT COUNT(*) as count FROM team_table');
    const [otpCount] = await pool.execute('SELECT COUNT(*) as count FROM otp_tokens_table');
    const [foodCount] = await pool.execute('SELECT COUNT(*) as count FROM food_nutrition_data_table');
    
    // Get sample user
    const [sampleUser] = await pool.execute(
      'SELECT UserId, UserName, Email FROM team_table LIMIT 1'
    );

    res.json({
      success: true,
      message: 'Database connection successful',
      environment: process.env.NODE_ENV || 'development',
      database: process.env.DB_NAME || 'wellness_buddy',
      tables: tables.map(t => Object.values(t)[0]),
      counts: {
        team_table: teamCount[0].count,
        otp_tokens_table: otpCount[0].count,
        food_nutrition_data_table: foodCount[0].count
      },
      sampleUser: sampleUser[0] || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      code: error.code
    });
  }
}
