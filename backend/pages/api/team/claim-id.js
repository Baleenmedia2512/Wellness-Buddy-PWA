/**
 * Claim Team ID
 * POST /api/team/claim-id
 *
 * Allows user to claim an available Team ID (Sponsor / Co-Sponsor seat).
 * Updates team_table.TeamId.
 *
 * During onboarding (no CoachId yet): coach_teams seat is finalized at OTP.
 * After setup (already has CoachId): assigns lead seat immediately and sets CoachTeamId.
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { assignLeadSeat } from '../../../utils/coachTeamSeats.js';

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
    // Get email / userId and Team ID from request body
    const { email, userId, teamId } = req.body;
    const uid = userId != null && String(userId).trim() !== ''
      ? Number(userId)
      : null;

    if (!email && !(uid && Number.isFinite(uid))) {
      res.status(400).json({
        success: false,
        error: 'Email or userId is required'
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

    // Check if user exists and get their current TeamId / activation state
    let userQuery = supabase
      .from('team_table')
      .select('UserId, TeamId, Role, CoachId, Status');
    if (uid && Number.isFinite(uid)) {
      userQuery = userQuery.eq('UserId', uid);
    } else {
      userQuery = userQuery.eq('Email', email);
    }
    const { data: userRows, error: userError } = await userQuery;

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
    const alreadyActivated = !!user.CoachId;

    // If user already has this same TeamId, just proceed (they're continuing setup)
    if (user.TeamId && user.TeamId === teamId) {
      // Post-setup: ensure lead seat exists if they somehow have TeamId without a seat
      if (alreadyActivated) {
        const seatResult = await assignLeadSeat(supabase, teamId, currentUserId);
        if (!seatResult.ok) {
          res.status(409).json({
            success: false,
            error: seatResult.error || 'Team is full',
            status: 'taken',
          });
          return;
        }
        await supabase
          .from('team_table')
          .update({ CoachTeamId: teamId })
          .eq('UserId', currentUserId);
        res.status(200).json({
          success: true,
          message: 'Team ID already assigned to you',
          teamId,
          alreadyOwned: true,
          seat: seatResult.seat === 'already' ? undefined : seatResult.seat,
          finalized: true,
        });
        return;
      }

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
      // TeamId exists on other users — check coach_teams_table / pending claims
      if (activeCoachTeams.length > 0) {
        const team = activeCoachTeams[0];
        
        // Check if both slots are filled
        if (team.CoachId && team.CoCoachId) {
          res.status(409).json({
            success: false,
            error: 'This Team ID is already taken (Sponsor and Co-Sponsor)',
            status: 'taken'
          });
          return;
        }
        // If only 1 slot filled, allow joining as Co-Sponsor
        isJoiningExistingTeam = true;
      } else if (allCoachTeams && allCoachTeams.length > 0 && allCoachTeams[0].Status === 'inactive') {
        // Team exists but is inactive - allow reactivation
        isReactivatingTeam = true;
      } else if (existingTeamId.length === 1) {
        // First lead claimed TeamId but OTP not done yet (no coach_teams row) — Co-Sponsor OK
        isJoiningExistingTeam = true;
      } else {
        // Two+ other users already claimed this code
        res.status(409).json({
          success: false,
          error: 'This Team ID is full (Sponsor and Co-Sponsor already assigned)',
          status: 'taken'
        });
        return;
      }
    }

    // Post-setup claim: assign Sponsor/Co-Sponsor seat immediately (race-safe)
    let finalizedSeat = isJoiningExistingTeam ? 'co-sponsor' : 'sponsor';
    if (alreadyActivated) {
      const seatResult = await assignLeadSeat(supabase, teamId, currentUserId);
      if (!seatResult.ok) {
        res.status(409).json({
          success: false,
          error: seatResult.error || 'Team is full',
          status: 'taken',
        });
        return;
      }
      finalizedSeat = seatResult.seat === 'already'
        ? (isJoiningExistingTeam ? 'co-sponsor' : 'sponsor')
        : seatResult.seat;
    }

    // Update user's Team ID (+ CoachTeamId when already activated)
    const updatePayload = { TeamId: teamId };
    if (alreadyActivated) {
      updatePayload.CoachTeamId = teamId;
    }

    const { error: updateError } = await supabase
      .from('team_table')
      .update(updatePayload)
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
      message: alreadyActivated
        ? (finalizedSeat === 'co-sponsor'
          ? 'Joined as Co-Sponsor'
          : 'Team Code claimed — you are the Sponsor')
        : isReactivatingTeam
          ? 'Team ID claimed (was inactive)'
          : isJoiningExistingTeam
            ? 'Team ID claimed (will join as Co-Sponsor)'
            : 'Team ID claimed successfully',
      teamId: teamId,
      joiningExisting: isJoiningExistingTeam,
      reactivated: isReactivatingTeam,
      seat: finalizedSeat,
      finalized: alreadyActivated,
      nextStep: alreadyActivated ? null : 'search-coach'
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
