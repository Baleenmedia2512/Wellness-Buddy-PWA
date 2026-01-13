/**
 * Check Team ID Availability
 * GET /api/team/check-availability/:teamId
 * 
 * Returns 3 possible states:
 * - available: Team ID is free to claim
 * - taken-by-you: Current user already owns this Team ID
 * - taken-by-other: Another user owns this Team ID
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
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma');

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
    const pool = getPool();

    // Get current user's UserId
    const [currentUserRows] = await pool.execute(
      'SELECT UserId FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    if (currentUserRows.length === 0) {
return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentUserId = currentUserRows[0].UserId;

    const userId = currentUserRows[0].UserId;

    try {
      // Check if Team ID exists in coach_teams_table (only active)
      const [teamRows] = await pool.execute(
        'SELECT TeamId, CoachId, CoCoachId FROM coach_teams_table WHERE TeamId = ? AND Status = "active"',
        [teamId]
      );

      // Also check if TeamId exists in team_table but inactive
      const [teamTableCheck] = await pool.execute(
        'SELECT UserId FROM team_table WHERE TeamId = ?',
        [teamId]
      );

      if (teamRows.length === 0) {
        // Check if it's truly new or just inactive
        if (teamTableCheck.length === 0) {
          // Completely new Team ID
          return res.status(200).json({
            success: true,
            status: 'new',
            teamId: teamId,
            coachCount: 0,
            message: 'This is a new Team ID - you will be the first coach'
          });
        } else {
          // Exists in team_table but inactive in coach_teams_table
          return res.status(200).json({
            success: true,
            status: 'new',
            teamId: teamId,
            coachCount: 0,
            message: 'This Team ID is available - you can reactivate it'
          });
        }
      }

      const team = teamRows[0];

      // Check if current user owns this Team ID
      if (team.CoachId === currentUserId || team.CoCoachId === currentUserId) {
        return res.status(200).json({
          success: true,
          status: 'taken-by-you',
          teamId: teamId,
          message: 'You already own this Team ID'
        });
      }

      // Check if team has space (only CoachId, no CoCoachId)
      if (team.CoachId && !team.CoCoachId) {
        // Get coach details
        const [coachRows] = await pool.execute(
          'SELECT UserName, Email FROM team_table WHERE UserId = ?',
          [team.CoachId]
        );

        const coach = coachRows[0];

        return res.status(200).json({
          success: true,
          status: 'available',
          teamId: teamId,
          coachCount: 1,
          existingCoach: {
            name: coach.UserName,
            email: coach.Email
          },
          message: 'This Team ID has 1 coach - you can join as co-coach'
        });
      }

      // Both CoachId and CoCoachId are filled - FULL
      return res.status(200).json({
        success: true,
        status: 'taken',
        teamId: teamId,
        coachCount: 2,
        message: 'This Team ID is full (2 coaches already)'
      });

    } finally {
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
