import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Allow both GET and POST requests
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Extract email from query params (GET) or body (POST)
  const email = req.method === 'GET' ? req.query.email : req.body?.email;

  console.log('🔍 [lookup-user-id] Request received:', { email, method: req.method });

  if (!email) {
    console.log('❌ [lookup-user-id] Email is required');
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,

    });

    console.log('📊 [lookup-user-id] Database connection established');

    // Try to find user by email first (most reliable)
    let query = 'SELECT UserId, UserName, Email, Status FROM team_table WHERE Email = ?';
    let params = [email];
    
    console.log('🔎 [lookup-user-id] Executing query:', query, 'with params:', params);

    // If no email provided, we could extend this to support other lookup methods
    if (!email) {
      // For now, we'll return an error since we need email to match with team_table
      await connection.end();
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required to lookup database UserId' 
      });
    }

    const [rows] = await connection.execute(query, params);
    await connection.end();

    console.log('📋 [lookup-user-id] Query results:', { rowCount: rows.length, rows });

    if (rows.length === 0) {
      console.log('❌ [lookup-user-id] User not found in database');
      return res.status(404).json({ 
        success: false, 
        message: 'User not found',
        userNotFound: true
      });
    }

    const user = rows[0];
    const isActive = user.Status === 'Active';

    console.log('✅ [lookup-user-id] User found:', {
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      status: user.Status,
      isActive: isActive
    });

    if (!isActive) {
      console.log('⚠️ [lookup-user-id] User is INACTIVE - Status:', user.Status);
    } else {
      console.log('✅ [lookup-user-id] User is ACTIVE');
    }

    const response = {
      success: true,
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      status: user.Status,
      isActive: isActive
    };

    console.log('📤 [lookup-user-id] Sending response:', response);

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ [lookup-user-id] Error occurred:', error);
    console.error('❌ [lookup-user-id] Error details:', {
      message: error.message,
      stack: error.stack,
      email: email
    });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}