/**
 * Cancel Upline Coach Approval Request
 * POST /api/upline/cancel-request
 * 
 * Cancels pending approval request, clears TeamId, updates status to 'cancelled'
 */

import { getPool } from '../../../utils/dbPool.js';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'baleed5_wellness'
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    });
  }

  

  try {
    const pool = getPool();
    await connection.beginTransaction();

    // Get user ID
    const [userRows] = await pool.execute(
      'SELECT UserId, TeamId FROM team_table WHERE Email = ?',
      [email]
    );

    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const userId = userRows[0].UserId;

    // Update approval request status to 'cancelled'
    await pool.execute(
      `UPDATE approval_requests_table 
       SET Status = 'cancelled', ProcessedAt = NOW()
       WHERE RequesterId = ? AND Status = 'pending'`,
      [userId]
    );

    // Clear TeamId and UplineCoachId from team_table
    await pool.execute(
      'UPDATE team_table SET TeamId = NULL, UplineCoachId = NULL WHERE UserId = ?',
      [userId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Request cancelled successfully',
      redirectTo: '/setup'
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('Cancel request error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel request' 
    });
  } finally {
    if (connection) {
}
  }
}
