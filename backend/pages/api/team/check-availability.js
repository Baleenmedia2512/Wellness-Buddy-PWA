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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma, X-App-Version, X-App-Version-Code, X-App-Platform');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma, X-App-Version, X-App-Version-Code, X-App-Platform');

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

    // Identify requester by email OR userId (phone-first users often have no email yet).
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    const userIdRaw = req.query.userId;
    const userIdNum = userIdRaw != null && String(userIdRaw).trim() !== ''
      ? parseInt(userIdRaw, 10)
      : NaN;

    if (!email && (!Number.isFinite(userIdNum) || userIdNum <= 0)) {
      res.status(400).json({
        success: false,
        error: 'Email or userId is required'
      });
      return;
    }

    // Connect to Supabase
    const supabase = getSupabaseClient();

    // Get current user's UserId and existing TeamId
    let userQuery = supabase
      .from('team_table')
      .select('UserId, TeamId')
      .limit(1);
    userQuery = email
      ? userQuery.eq('Email', email)
      : userQuery.eq('UserId', userIdNum);

    const { data: currentUserRows, error: userError } = await userQuery;

    if (userError) throw userError;

    if (!currentUserRows || currentUserRows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const currentUserId = currentUserRows[0].UserId;

    if (currentUserRows[0].TeamId === teamId) {
      res.status(200).json({
        success: true,
        status: 'taken-by-you',
        teamId: teamId,
        message: 'You already own this Team ID'
      });
      return;
    }

    // Check if Team ID exists in coach_teams_table (only active)
    const { data: teamRows, error: teamError } = await supabase
      .from('coach_teams_table')
      .select('TeamId, CoachId, CoCoachId')
      .eq('TeamId', teamId)
      .eq('Status', 'active');

    if (teamError) throw teamError;

    // Other users who already claimed this TeamId (pending OTP or active leads)
    const { data: teamTableCheck, error: teamTableError } = await supabase
      .from('team_table')
      .select('UserId')
      .eq('TeamId', teamId)
      .neq('UserId', currentUserId);

    if (teamTableError) throw teamTableError;

    const otherClaimants = teamTableCheck || [];

    if (!teamRows || teamRows.length === 0) {
      // No active coach_teams row — infer seats from pending TeamId claims
      if (otherClaimants.length === 0) {
        res.status(200).json({
          success: true,
          status: 'new',
          teamId: teamId,
          coachCount: 0,
          seat: 'sponsor',
          message: 'This is a new Team ID - you will be the Sponsor'
        });
        return;
      }

      if (otherClaimants.length === 1) {
        const { data: coachRows, error: coachError } = await supabase
          .from('team_table')
          .select('UserName, Email')
          .eq('UserId', otherClaimants[0].UserId)
          .limit(1);

        if (coachError) throw coachError;

        const coach = coachRows?.[0];
        res.status(200).json({
          success: true,
          status: 'available',
          teamId: teamId,
          coachCount: 1,
          seat: 'co-sponsor',
          existingCoach: coach
            ? { name: coach.UserName, email: coach.Email }
            : null,
          message: 'This Team ID has 1 lead - you can join as Co-Sponsor'
        });
        return;
      }

      res.status(200).json({
        success: true,
        status: 'taken',
        teamId: teamId,
        coachCount: 2,
        message: 'This Team ID is full (Sponsor and Co-Sponsor already assigned)'
      });
      return;
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
        message: 'This Team ID has 1 lead - you can join as Co-Sponsor',
        seat: 'co-sponsor',
      });
      return;
    }

    // Both CoachId and CoCoachId are filled - FULL
    res.status(200).json({
      success: true,
      status: 'taken',
      teamId: teamId,
      coachCount: 2,
      message: 'This Team ID is full (Sponsor and Co-Sponsor already assigned)'
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
