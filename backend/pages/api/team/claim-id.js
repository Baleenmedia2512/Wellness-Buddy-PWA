/**
 * Claim Team ID
 * POST /api/team/claim-id
 * 
 * Allows authenticated user to claim an available Team ID
 * Updates team_table.TeamId for the user
 * 
 * Note: coach_teams_table entry is created later during OTP validation
 * when the user is approved by their coach (see validate-otp.js)
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }

  try {
    // Get email and Team ID from request body
    const { email, teamId } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    // Validate Team ID format (10 alphanumeric characters)
    if (!teamId || teamId.length !== 10) {
      res.status(400).json({
        success: false,
        error: 'Team ID must be exactly 10 characters'
      });
      return;
    }

    const teamIdPattern = /^[A-Z0-9]{10}$/;
    if (!teamIdPattern.test(teamId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid Team ID format. Use only uppercase letters and numbers'
      });
      return;
    }

    // Connect to Supabase
    const supabase = getSupabaseClient();

    // Check if user exists and get their current TeamId and Role
    const { data: userRows, error: userError } = await supabase
      .from('team_table')
      .select('UserId, TeamId, Role')
      .eq('Email', email);

    if (userError) throw userError;

    if (!userRows || userRows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const user = userRows[0];
    const currentUserId = user.UserId;

    // If user already has this same TeamId, just proceed (they're continuing setup)
    if (user.TeamId && user.TeamId === teamId) {
      res.status(200).json({
        success: true,
        message: 'Team ID already assigned to you',
        teamId: teamId,
        alreadyOwned: true,
        nextStep: 'search-coach'
      });
      return;
    }

    // If user has a different TeamId, reject
    if (user.TeamId && user.TeamId !== teamId) {
      res.status(400).json({
        success: false,
        error: 'You already have a different Team ID',
        currentTeamId: user.TeamId
      });
      return;
    }

    // Check Team ID availability in coach_teams_table (both active and inactive)
    const { data: allCoachTeams, error: coachTeamsError } = await supabase
      .from('coach_teams_table')
      .select('CoachId, CoCoachId, Status')
      .eq('TeamId', teamId);

    if (coachTeamsError) throw coachTeamsError;

    // Filter only active teams
    const activeCoachTeams = allCoachTeams ? allCoachTeams.filter(team => team.Status === 'active') : [];

    // Check if Team ID is used by someone else in team_table
    const { data: existingTeamId, error: existingError } = await supabase
      .from('team_table')
      .select('UserId')
      .eq('TeamId', teamId)
      .neq('UserId', currentUserId);

    if (existingError) throw existingError;

    let isJoiningExistingTeam = false;
    let isReactivatingTeam = false;

    if (existingTeamId && existingTeamId.length > 0) {
      // TeamId exists in team_table - check coach_teams_table
      if (activeCoachTeams.length > 0) {
        const team = activeCoachTeams[0];
        
        // Check if both slots are filled
        if (team.CoachId && team.CoCoachId) {
          res.status(409).json({
            success: false,
            error: 'This Team ID is already taken (2 coaches)',
            status: 'taken'
          });
          return;
        }
        // If only 1 slot filled, allow joining as co-coach
        isJoiningExistingTeam = true;
      } else if (allCoachTeams && allCoachTeams.length > 0 && allCoachTeams[0].Status === 'inactive') {
        // Team exists but is inactive - allow reactivation
        isReactivatingTeam = true;
      } else {
        // TeamId exists but not in coach_teams_table at all
        res.status(409).json({
          success: false,
          error: 'This Team ID is already taken',
          status: 'taken-by-other'
        });
        return;
      }
    }

    // Update user's Team ID using Supabase
    const { error: updateError } = await supabase
      .from('team_table')
      .update({ TeamId: teamId })
      .eq('UserId', currentUserId);

    if (updateError) {
      console.error('Error updating TeamId:', updateError);
      
      // Handle potential race condition where TeamId was just claimed
      if (updateError.code === '23505') { // Unique constraint violation in PostgreSQL
        res.status(409).json({
          success: false,
          error: 'This Team ID was just claimed by another user',
          status: 'taken-by-other'
        });
        return;
      }
      
      throw updateError;
    }

    res.status(200).json({
      success: true,
      message: isReactivatingTeam ? 'Team ID claimed (was inactive)' : isJoiningExistingTeam ? 'Team ID claimed (will join as co-coach)' : 'Team ID claimed successfully',
      teamId: teamId,
      joiningExisting: isJoiningExistingTeam,
      reactivated: isReactivatingTeam,
      nextStep: 'search-coach'
    });
    return;

  } catch (error) {
    console.error('Error claiming Team ID:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to claim Team ID',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    return;
  }
}
