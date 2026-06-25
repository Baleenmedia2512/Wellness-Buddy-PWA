/**
 * Check Team ID Availability
 * GET /api/team/check-availability/:teamId
 * 
 * Returns 3 possible states:
 * - available: Team ID is free to claim
 * - taken-by-you: Current user already owns this Team ID
 * - taken-by-other: Another user owns this Team ID
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';

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
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma');

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }

  try {
    // Get Team ID from query parameter
    const { teamId } = req.query;

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

    // Get email from query parameter
    const { email } = req.query;
    
    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    // Connect to Supabase
    const supabase = getSupabaseClient();

    // Get current user's UserId
    const { data: currentUserRows, error: userError } = await supabase
      .from('team_table')
      .select('UserId')
      .eq('Email', email)
      .limit(1);

    if (userError) throw userError;

    if (!currentUserRows || currentUserRows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const currentUserId = currentUserRows[0].UserId;

    // Check if Team ID exists in coach_teams_table (only active)
    const { data: teamRows, error: teamError } = await supabase
      .from('coach_teams_table')
      .select('TeamId, CoachId, CoCoachId')
      .eq('TeamId', teamId)
      .eq('Status', 'active');

    if (teamError) throw teamError;

    // Also check if TeamId exists in team_table but inactive
    const { data: teamTableCheck, error: teamTableError } = await supabase
      .from('team_table')
      .select('UserId')
      .eq('TeamId', teamId);

    if (teamTableError) throw teamTableError;

    if (!teamRows || teamRows.length === 0) {
      // Check if it's truly new or just inactive
      if (!teamTableCheck || teamTableCheck.length === 0) {
        // Completely new Team ID
        res.status(200).json({
          success: true,
          status: 'new',
          teamId: teamId,
          coachCount: 0,
          message: 'This is a new Team ID - you will be the first coach'
        });
        return;
      } else {
        // Exists in team_table but inactive in coach_teams_table
        res.status(200).json({
          success: true,
          status: 'new',
          teamId: teamId,
          coachCount: 0,
          message: 'This Team ID is available - you can reactivate it'
        });
        return;
      }
    }

    const team = teamRows[0];

    // Check if current user owns this Team ID
    if (team.CoachId === currentUserId || team.CoCoachId === currentUserId) {
      res.status(200).json({
        success: true,
        status: 'taken-by-you',
        teamId: teamId,
        message: 'You already own this Team ID'
      });
      return;
    }

    // Check if team has space (only CoachId, no CoCoachId)
    if (team.CoachId && !team.CoCoachId) {
      // Get coach details
      const { data: coachRows, error: coachError } = await supabase
        .from('team_table')
        .select('UserName, Email')
        .eq('UserId', team.CoachId);

      if (coachError) throw coachError;

      const coach = coachRows[0];

      res.status(200).json({
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
      return;
    }

    // Both CoachId and CoCoachId are filled - FULL
    res.status(200).json({
      success: true,
      status: 'taken',
      teamId: teamId,
      coachCount: 2,
      message: 'This Team ID is full (2 coaches already)'
    });
    return;

  } catch (error) {
    console.error('Error checking Team ID availability:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to check Team ID availability',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    return;
  }
}
