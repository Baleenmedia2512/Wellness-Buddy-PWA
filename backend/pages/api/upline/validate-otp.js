/**
 * Validate OTP
 * POST /api/upline/validate-otp
 * 
 * Validates OTP code, checks 24-hour expiry, updates user's UplineCoachId
 * Completes the setup process
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import bcrypt from 'bcryptjs';

const MAX_OTP_ATTEMPTS = 5;

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
    // Get email and otp from body
    const { otp, email } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    // Get OTP from request body
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      res.status(400).json({
        success: false,
        error: 'OTP must be exactly 6 digits'
      });
      return;
    }

    // Connect to Supabase
    const supabase = getSupabaseClient();

    // Get requester's UserId
    const { data: userRows, error: userError } = await supabase
      .from('team_table')
      .select('UserId')
      .eq('Email', email)
      .limit(1);

    if (userError) throw userError;

    if (!userRows || userRows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const requesterId = userRows[0].UserId;

    // Get pending request
    const { data: requestRows, error: requestError } = await supabase
      .from('approval_requests_table')
      .select('Id, RequesterId, UplineCoachId, OtpHash, OtpExpiresAt, OtpAttempts, Status')
      .eq('RequesterId', requesterId)
      .eq('Status', 'pending')
      .order('RequestedAt', { ascending: false })
      .limit(1);

    if (requestError) throw requestError;

    if (!requestRows || requestRows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No pending request found'
      });
      return;
    }

    const request = requestRows[0];

    // Check if OTP has expired (24 hours)
    const now = new Date();
    const expiresAt = new Date(request.OtpExpiresAt);

    if (now > expiresAt) {
      // Mark as expired
      await supabase
        .from('approval_requests_table')
        .update({ Status: 'expired' })
        .eq('Id', request.Id);

      res.status(400).json({
        success: false,
        error: 'This code has expired (24 hours). Please send a new request.',
        expired: true
      });
      return;
    }

    // Check max attempts
    if (request.OtpAttempts >= MAX_OTP_ATTEMPTS) {
      // Delete request after max attempts
      await supabase
        .from('approval_requests_table')
        .delete()
        .eq('Id', request.Id);

      res.status(400).json({
        success: false,
        error: 'Maximum attempts exceeded. Please send a new request.',
        maxAttemptsExceeded: true
      });
      return;
    }

    // Verify OTP
    console.log('Verifying OTP:', { 
      inputOtp: otp, 
      storedHash: request.OtpHash?.substring(0, 20) + '...',
      requesterId: requesterId,
      requestId: request.Id
    });
    
    const isValid = await bcrypt.compare(otp, request.OtpHash);
    
    console.log('OTP validation result:', isValid);

    if (!isValid) {
      // Increment attempts
      const newAttempts = request.OtpAttempts + 1;
      
      await supabase
        .from('approval_requests_table')
        .update({ OtpAttempts: newAttempts })
        .eq('Id', request.Id);

      res.status(400).json({
        success: false,
        error: 'Incorrect verification code',
        attemptsLeft: MAX_OTP_ATTEMPTS - newAttempts
      });
      return;
    }

    // OTP is valid! Complete setup

    // Get requester's TeamId first
    const { data: requesterData, error: requesterDataError } = await supabase
      .from('team_table')
      .select('TeamId')
      .eq('UserId', requesterId);

    if (requesterDataError) throw requesterDataError;

    const requesterTeamId = requesterData[0]?.TeamId;

    if (!requesterTeamId) {
      res.status(400).json({
        success: false,
        error: 'Requester does not have a TeamId assigned'
      });
      return;
    }

    // STEP 1: Update coach_teams_table FIRST (before team_table)
    // Check if TeamId exists in coach_teams_table (including inactive)
    const { data: existingTeam, error: existingTeamError } = await supabase
      .from('coach_teams_table')
      .select('TeamId, CoachId, CoCoachId, Status')
      .eq('TeamId', requesterTeamId);

    if (existingTeamError) throw existingTeamError;

    if (existingTeam && existingTeam.length > 0) {
      const team = existingTeam[0];
      
      if (team.Status === 'active') {
        // Team is active, add requester as CoCoachId if slot available
        if (!team.CoCoachId) {
          const updateTime = new Date().toISOString();
          await supabase
            .from('coach_teams_table')
            .update({ CoCoachId: requesterId, UpdatedAt: updateTime })
            .eq('TeamId', requesterTeamId)
            .eq('Status', 'active');
        }
      } else {
        // Team is inactive, reactivate with requester as primary coach
        const updateTime = new Date().toISOString();
        await supabase
          .from('coach_teams_table')
          .update({ CoachId: requesterId, CoCoachId: null, Status: 'active', UpdatedAt: updateTime })
          .eq('TeamId', requesterTeamId);
      }
    } else {
      // Create new entry with requester as primary coach
      await supabase
        .from('coach_teams_table')
        .insert([{ TeamId: requesterTeamId, CoachId: requesterId, Status: 'active' }]);
    }

    // STEP 2: Get coach details for CoachName and CoCoachName
    const { data: coachData, error: coachDataError } = await supabase
      .from('team_table')
      .select('TeamId, UserName')
      .eq('UserId', request.UplineCoachId);

    if (coachDataError) throw coachDataError;

    const coachTeamId = coachData[0]?.TeamId;
    const coachName = coachData[0]?.UserName;
    let coCoachName = null;

    if (coachTeamId) {
      // Find the co-coach from coach_teams_table
      const { data: coachTeam, error: coachTeamError } = await supabase
        .from('coach_teams_table')
        .select('CoachId, CoCoachId')
        .eq('TeamId', coachTeamId)
        .eq('Status', 'active');

      if (coachTeamError) throw coachTeamError;

      if (coachTeam && coachTeam.length > 0) {
        // Determine which is the co-coach (the one that's not our coach)
        const coCoachId = coachTeam[0].CoachId === request.UplineCoachId 
          ? coachTeam[0].CoCoachId 
          : coachTeam[0].CoachId;

        if (coCoachId) {
          const { data: coCoachData, error: coCoachError } = await supabase
            .from('team_table')
            .select('UserName')
            .eq('UserId', coCoachId);

          if (coCoachError) throw coCoachError;
          coCoachName = coCoachData[0]?.UserName || null;
        }
      }
    }

    // STEP 3: NOW update team_table (after coach_teams_table succeeds)
    await supabase
      .from('team_table')
      .update({ 
        UplineCoachId: request.UplineCoachId, 
        CoachName: coachName, 
        CoCoachName: coCoachName 
      })
      .eq('UserId', requesterId);

    // STEP 4: Mark request as approved
    const processedAt = new Date().toISOString();
    await supabase
      .from('approval_requests_table')
      .update({ Status: 'approved', ProcessedAt: processedAt })
      .eq('Id', request.Id);

    // Get requester and coach details for response
    const { data: userDetails, error: userDetailsError } = await supabase
      .from('team_table')
      .select('UserName, TeamId')
      .eq('UserId', requesterId);

    if (userDetailsError) throw userDetailsError;

    const { data: coachDetails, error: coachDetailsError } = await supabase
      .from('team_table')
      .select('UserName, Email')
      .eq('UserId', request.UplineCoachId);

    if (coachDetailsError) throw coachDetailsError;

    res.status(200).json({
      success: true,
      message: 'Setup complete! You are now part of your coach\'s team.',
      coach: {
        name: coachDetails[0]?.UserName,
        email: coachDetails[0]?.Email
      },
      redirectTo: '/dashboard'
    });
    return;

  } catch (error) {
    console.error('Error validating OTP:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to validate OTP',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    return;
  }
}
