import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

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
    // Check cache first (2 minute TTL for user lookup)
    const cacheKey = `user:lookup:${email}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('✅ [lookup-user-id] Cache HIT for:', email);
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    // Use connection pool to avoid ETIMEDOUT errors
    const pool = getPool();
    console.log('📊 [lookup-user-id] Using connection pool');

    // Try to find user by email first (most reliable)
    let query = 'SELECT UserId, UserName, Email, Status, Role FROM team_table WHERE Email = ?';
    let params = [email];
    
    console.log('🔎 [lookup-user-id] Executing query:', query, 'with params:', params);

    const [rows] = await pool.execute(query, params);
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
      isActive: isActive,
      role: user.Role || 'user'
    };

    console.log('📤 [lookup-user-id] Sending response:', response);

    // Cache for 2 minutes
    cache.set(cacheKey, response, 120000);
    res.setHeader('X-Cache', 'MISS');
    
    res.status(200).json(response);

  } catch (error) {
    console.error('❌ [lookup-user-id] Error occurred:', error);
    console.error('❌ [lookup-user-id] Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      stack: error.stack,
      email: email
    });
    res.status(500).json({ 
      success: false, 
      error: error.code === 'ETIMEDOUT' ? 'Database connection timeout. Please try again.' : error.message 
    });
  }
}