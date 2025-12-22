/**
 * Claim Team ID
 * POST /api/team/claim-id
 * 
 * Allows authenticated user to claim an available Team ID
 * Updates team_table.TeamId for the user
 * Also creates entry in coach_teams_table if user is a coach (Role=admin)
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Get email and Team ID from request body
    const { email, teamId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

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

    // Connect to database
    const connection = await mysql.createConnection(dbConfig);

    try {
      await connection.beginTransaction();

      // Check if user already has a Team ID
      const [userRows] = await connection.execute(
        'SELECT UserId, TeamId, Role FROM team_table WHERE Email = ?',
        [email]
      );

      if (userRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = userRows[0];
      const currentUserId = user.UserId;

      if (user.TeamId) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'You already have a Team ID',
          currentTeamId: user.TeamId
        });
      }

      // Check if Team ID is already taken
      const [existingTeamId] = await connection.execute(
        'SELECT UserId FROM team_table WHERE TeamId = ?',
        [teamId]
      );

      if (existingTeamId.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          error: 'This Team ID is already taken',
          status: 'taken-by-other'
        });
      }

      // Update user's Team ID
      await connection.execute(
        'UPDATE team_table SET TeamId = ? WHERE UserId = ?',
        [teamId, currentUserId]
      );

      // If user is a coach (Role=admin), create entry in coach_teams_table
      const isCoach = user.Role === 'admin';
      
      if (isCoach) {
        await connection.execute(
          'INSERT INTO coach_teams_table (TeamId, CoachId, CreatedAt) VALUES (?, ?, NOW())',
          [teamId, currentUserId]
        );
      }

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Team ID claimed successfully',
        teamId: teamId,
        isCoach: isCoach,
        nextStep: 'search-coach' // User should now search for their upline coach
      });

    } catch (dbError) {
      await connection.rollback();
      
      // Handle duplicate key error (shouldn't happen due to check above, but just in case)
      if (dbError.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: 'This Team ID was just claimed by another user',
          status: 'taken-by-other'
        });
      }

      throw dbError;

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Error claiming Team ID:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to claim Team ID',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
