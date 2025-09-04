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

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Try to find user by email first (most reliable)
    let query = 'SELECT UserId, UserName, Email FROM team_table WHERE Email = ? AND Status = "Active"';
    let params = [email];

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

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found in team_table' 
      });
    }

    const user = rows[0];

    res.status(200).json({
      success: true,
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email
    });

  } catch (error) {
    console.error('Failed to lookup user ID:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}