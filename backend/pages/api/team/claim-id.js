/**
 * Claim Team ID
 * POST /api/team/claim-id
 * 
 * Allows authenticated user to claim an available Team ID
 * Updates team_table.TeamId for the user
 * Also creates entry in coach_teams_table if user is a coach (Role=admin)
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
    const pool = getPool();

    try {
      await connection.beginTransaction();

      // Check if user already has a Team ID
      const [userRows] = await pool.execute(
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

      // If user already has this same TeamId, just proceed (they're continuing setup)
      if (user.TeamId && user.TeamId === teamId) {
        await connection.commit();
        return res.status(200).json({
          success: true,
          message: 'Team ID already assigned to you',
          teamId: teamId,
          alreadyOwned: true,
          nextStep: 'search-coach'
        });
      }

      // If user has a different TeamId, reject
      if (user.TeamId && user.TeamId !== teamId) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'You already have a different Team ID',
          currentTeamId: user.TeamId
        });
      }

      // Check Team ID availability in coach_teams_table (both active and inactive)
      const [allCoachTeams] = await pool.execute(
        'SELECT CoachId, CoCoachId, Status FROM coach_teams_table WHERE TeamId = ?',
        [teamId]
      );

      // Filter only active teams
      const activeCoachTeams = allCoachTeams.filter(team => team.Status === 'active');

      // Check if Team ID is used by someone else in team_table
      const [existingTeamId] = await pool.execute(
        'SELECT UserId FROM team_table WHERE TeamId = ? AND UserId != ?',
        [teamId, currentUserId]
      );

      let isJoiningExistingTeam = false;
      let isReactivatingTeam = false;

      if (existingTeamId.length > 0) {
        // TeamId exists in team_table - check coach_teams_table
        if (activeCoachTeams.length > 0) {
          const team = activeCoachTeams[0];
          
          // Check if both slots are filled
          if (team.CoachId && team.CoCoachId) {
            await connection.rollback();
            return res.status(409).json({
              success: false,
              error: 'This Team ID is already taken (2 coaches)',
              status: 'taken'
            });
          }
          // If only 1 slot filled, allow joining as co-coach
          isJoiningExistingTeam = true;
        } else if (allCoachTeams.length > 0 && allCoachTeams[0].Status === 'inactive') {
          // Team exists but is inactive - allow reactivation
          isReactivatingTeam = true;
        } else {
          // TeamId exists but not in coach_teams_table at all
          await connection.rollback();
          return res.status(409).json({
            success: false,
            error: 'This Team ID is already taken',
            status: 'taken-by-other'
          });
        }
      }

      // Update user's Team ID
      await pool.execute(
        'UPDATE team_table SET TeamId = ? WHERE UserId = ?',
        [teamId, currentUserId]
      );

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: isReactivatingTeam ? 'Team ID claimed (was inactive)' : isJoiningExistingTeam ? 'Team ID claimed (will join as co-coach)' : 'Team ID claimed successfully',
        teamId: teamId,
        joiningExisting: isJoiningExistingTeam,
        reactivated: isReactivatingTeam,
        nextStep: 'search-coach'
      });

    } catch (dbError) {
      await connection.rollback();
      
      console.error('Database error in claim-id:', dbError);
      
      // Handle duplicate key error
      if (dbError.code === 'ER_DUP_ENTRY') {
        // Check which constraint failed
        if (dbError.message.includes('TeamId')) {
          return res.status(409).json({
            success: false,
            error: 'This Team ID was just claimed by another user',
            status: 'taken-by-other'
          });
        }
        return res.status(409).json({
          success: false,
          error: 'Duplicate entry error',
          status: 'error'
        });
      }

      throw dbError;

    } finally {
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
