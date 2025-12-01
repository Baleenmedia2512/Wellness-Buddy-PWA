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

  const { email } = req.query;

  console.log('👤 [get-user-profile] Request received:', { email });

  if (!email) {
    console.log('❌ [get-user-profile] Missing required field: email');
    return res.status(400).json({
      success: false,
      message: 'Missing required query parameter: email',
    });
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    console.log('📊 [get-user-profile] Database connection established');

    // Fetch user profile from team_table
    const [userRows] = await connection.execute(
      `SELECT UserId, UserName, Email, Height, Age, Gender 
       FROM team_table 
       WHERE Email = ? 
       LIMIT 1`,
      [email]
    );

    if (userRows.length === 0) {
      console.log('❌ [get-user-profile] User not found:', email);
      await connection.end();
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userRows[0];
    console.log('✅ [get-user-profile] User found:', { userId: user.UserId, userName: user.UserName });

    // Fetch latest weight and BMR from weight_records_table
    const [weightRows] = await connection.execute(
      `SELECT Weight, Bmr, CreatedAt 
       FROM weight_records_table 
       WHERE UserId = ? AND (IsDeleted IS NULL OR IsDeleted = 0)
       ORDER BY CreatedAt DESC 
       LIMIT 1`,
      [user.UserId]
    );

    await connection.end();

    // Helper function to format date as local time string (without UTC conversion)
    // MySQL stores local time, but mysql2 returns Date objects which get serialized as UTC
    const formatDateAsLocal = (date) => {
      if (!date) return null;
      if (date instanceof Date) {
        return date.getFullYear() + '-' +
          String(date.getMonth() + 1).padStart(2, '0') + '-' +
          String(date.getDate()).padStart(2, '0') + 'T' +
          String(date.getHours()).padStart(2, '0') + ':' +
          String(date.getMinutes()).padStart(2, '0') + ':' +
          String(date.getSeconds()).padStart(2, '0');
      }
      return date;
    };

    // Build response
    const profileData = {
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      height: user.Height ? parseFloat(user.Height) : null,
      age: user.Age,
      gender: user.Gender,
      latestWeight: null,
      latestBmr: null,
      weightRecordDate: null,
    };

    if (weightRows.length > 0) {
      profileData.latestWeight = weightRows[0].Weight ? parseFloat(weightRows[0].Weight) : null;
      profileData.latestBmr = weightRows[0].Bmr ? parseFloat(weightRows[0].Bmr) : null;
      profileData.weightRecordDate = formatDateAsLocal(weightRows[0].CreatedAt);
    }
    
    console.log('📦 [get-user-profile] Compiled profile data:', profileData);

    console.log('✅ [get-user-profile] Profile data retrieved successfully');

    res.status(200).json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    console.error('❌ [get-user-profile] Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
      error: error.message,
    });
  }
}
