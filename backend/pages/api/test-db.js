import mysql from 'mysql2/promise';

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
    // Database connection for local developments
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'wellness_buddy'
    });

    // Test queries
    const [tables] = await connection.execute('SHOW TABLES');
    const [teamCount] = await connection.execute('SELECT COUNT(*) as count FROM team_table');
    const [otpCount] = await connection.execute('SELECT COUNT(*) as count FROM otp_tokens_table');
    const [foodCount] = await connection.execute('SELECT COUNT(*) as count FROM food_nutrition_data_table');
    
    // Get sample user
    const [sampleUser] = await connection.execute(
      'SELECT UserId, UserName, Email FROM team_table LIMIT 1'
    );

    await connection.end();

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
