/**
 * Check Team ID Availability
 * GET /api/team/check-availability/:teamId
 * 
 * Returns 3 possible states:
 * - available: Team ID is free to claim
 * - taken-by-you: Current user already owns this Team ID
 * - taken-by-other: Another user owns this Team ID
 */

import mysql from 'mysql2/promise';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'baleed5_wellness'
};

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Get Team ID from query parameter
    const { teamId } = req.query;

    // Validate Team ID format (10 alphanumeric characters)
    if (!teamId || teamId.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'Team ID must be exactly 10 characters'
      });
    }

    const teamIdPattern = /^[A-Z0-9]{10}$/;
    if (!teamIdPattern.test(teamId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Team ID format. Use only uppercase letters and numbers'
      });
    }

    // Get email from query parameter
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Connect to database
    const connection = await mysql.createConnection(dbConfig);

    // Get current user's UserId
    const [currentUserRows] = await connection.execute(
      'SELECT UserId FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    if (currentUserRows.length === 0) {
      await connection.end();
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentUserId = currentUserRows[0].UserId;

    const userId = currentUserRows[0].UserId;

    try {
      // Check if Team ID exists in database
      const [rows] = await connection.execute(
        'SELECT UserId FROM team_table WHERE TeamId = ?',
        [teamId]
      );

      if (rows.length === 0) {
        // Team ID is available
        return res.status(200).json({
          success: true,
          status: 'available',
          teamId: teamId,
          message: 'This Team ID is available to claim'
        });
      }

      const owner = rows[0];

      if (owner.UserId === currentUserId) {
        // Current user already owns this Team ID
        return res.status(200).json({
          success: true,
          status: 'taken-by-you',
          teamId: teamId,
          message: 'You already have this Team ID'
        });
      }

      // Another user owns this Team ID
      return res.status(200).json({
        success: true,
        status: 'taken-by-other',
        teamId: teamId,
        message: 'This Team ID is already taken'
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Error checking Team ID availability:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check Team ID availability',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
