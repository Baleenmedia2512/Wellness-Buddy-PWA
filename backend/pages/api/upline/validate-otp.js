/**
 * Validate OTP
 * POST /api/upline/validate-otp
 *
 * Validates OTP code, checks 24-hour expiry, updates user's UplineCoachId
 * Completes the setup process
 */

import {
  getSupabaseClient,
  getISTTimestamp,
} from "../../../utils/supabaseClient.js";
import bcrypt from "bcryptjs";

const MAX_OTP_ATTEMPTS = 5;

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, authorization",
    );
    res.status(200).end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, authorization");

  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
    return;
  }

  try {
    // Get email and otp from body
    const { otp, email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: "Email is required",
      });
      return;
    }

    // Get OTP from request body
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      res.status(400).json({
        success: false,
        error: "OTP must be exactly 6 digits",
      });
      return;
    }

    // Connect to Supabase
    const supabase = getSupabaseClient();

    // ── Demo account bypass for App Store review ──────────────────────
    // Fixed OTP 123456 always works for the demo account.
    const DEMO_ACCOUNTS = ['reviewer@gmail.com'];
    const DEMO_OTP = '123456';
    if (DEMO_ACCOUNTS.includes(email.toLowerCase().trim()) && otp === DEMO_OTP) {
      return res.status(200).json({
        success: true,
        message: 'Setup complete! Welcome to Wellness Valley.',
        redirectTo: '/dashboard',
      });
    }
    // ─────────────────────────────────────────────────────────────────

    // Get requester's UserId
    const { data: userRows, error: userError } = await supabase
      .from("team_table")
      .select("UserId")
      .eq("Email", email)
      .limit(1);

    if (userError) throw userError;

    if (!userRows || userRows.length === 0) {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }

    const requesterId = userRows[0].UserId;

    // Get pending request
    const { data: requestRows, error: requestError } = await supabase
      .from("approval_requests_table")
      .select(
        "Id, RequesterId, UplineCoachId, OtpHash, OtpExpiresAt, OtpAttempts, Status",
      )
      .eq("RequesterId", requesterId)
      .eq("Status", "pending")
      .order("RequestedAt", { ascending: false })
      .limit(1);

    if (requestError) throw requestError;

    if (!requestRows || requestRows.length === 0) {
      res.status(404).json({
        success: false,
        error: "No pending request found",
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
        .from("approval_requests_table")
        .update({ Status: "expired" })
        .eq("Id", request.Id);

      res.status(400).json({
        success: false,
        error: "This code has expired (24 hours). Please send a new request.",
        expired: true,
      });
      return;
    }

    // Check max attempts
    if (request.OtpAttempts >= MAX_OTP_ATTEMPTS) {
      // Delete request after max attempts
      await supabase
        .from("approval_requests_table")
        .delete()
        .eq("Id", request.Id);

      res.status(400).json({
        success: false,
        error: "Maximum attempts exceeded. Please send a new request.",
        maxAttemptsExceeded: true,
      });
      return;
    }

    // Verify OTP
    console.log("Verifying OTP:", {
      inputOtp: otp,
      storedHash: request.OtpHash?.substring(0, 20) + "...",
      requesterId: requesterId,
      requestId: request.Id,
    });

    const isValid = await bcrypt.compare(otp, request.OtpHash);

    console.log("OTP validation result:", isValid);

    if (!isValid) {
      // Increment attempts
      const newAttempts = request.OtpAttempts + 1;

      await supabase
        .from("approval_requests_table")
        .update({ OtpAttempts: newAttempts })
        .eq("Id", request.Id);

      res.status(400).json({
        success: false,
        error: "Incorrect verification code",
        attemptsLeft: MAX_OTP_ATTEMPTS - newAttempts,
      });
      return;
    }

    // OTP is valid! Complete setup

    // Get requester's TeamId (now optional)
    const { data: requesterData, error: requesterDataError } = await supabase
      .from("team_table")
      .select("TeamId")
      .eq("UserId", requesterId);

    if (requesterDataError) throw requesterDataError;

    const requesterTeamId = requesterData[0]?.TeamId;

    console.log(`📊 [validate-otp] Requester TeamId: ${requesterTeamId || 'none'}`);

    // STEP 1: Update coach_teams_table ONLY if user has a TeamId
    // This is now optional - users can complete account activation without Team ID
    if (requesterTeamId) {
      console.log(`🔍 [validate-otp] Checking coach_teams_table for TeamId: ${requesterTeamId}`);
      // Check if TeamId exists in coach_teams_table (including inactive)
      const { data: existingTeam, error: existingTeamError } = await supabase
        .from("coach_teams_table")
        .select("TeamId, CoachId, CoCoachId, Status")
        .eq("TeamId", requesterTeamId);

      if (existingTeamError) throw existingTeamError;

      if (existingTeam && existingTeam.length > 0) {
        const team = existingTeam[0];

        if (team.Status === "active") {
          // Team is active, add requester as CoCoachId if slot available
          if (!team.CoCoachId) {
            const updateTime = getISTTimestamp();
            const { error: coCoachUpdateError } = await supabase
              .from("coach_teams_table")
              .update({ CoCoachId: requesterId, UpdatedAt: updateTime })
              .eq("TeamId", requesterTeamId)
              .eq("Status", "active");
            
            if (coCoachUpdateError) {
              console.error("❌ Error adding co-coach to team:", coCoachUpdateError);
              throw coCoachUpdateError;
            }
            console.log("✅ Added as co-coach to team:", requesterTeamId);
          }
        } else {
          // Team is inactive, reactivate with requester as primary coach
          const updateTime = getISTTimestamp();
          const { error: reactivateError } = await supabase
            .from("coach_teams_table")
            .update({
              CoachId: requesterId,
              CoCoachId: null,
              Status: "active",
              UpdatedAt: updateTime,
            })
            .eq("TeamId", requesterTeamId);
          
          if (reactivateError) {
            console.error("❌ Error reactivating team:", reactivateError);
            throw reactivateError;
          }
          console.log("✅ Reactivated team:", requesterTeamId);
        }
      } else {
        // Create new entry with requester as primary coach
        const { error: insertError } = await supabase
          .from("coach_teams_table")
          .insert([
            { 
              TeamId: requesterTeamId, 
              CoachId: requesterId, 
              CoCoachId: null, // Explicitly set to NULL (no co-coach yet)
              Status: "active" 
            },
          ]);
        
        if (insertError) {
          console.error("❌ Error creating coach_teams_table entry:", insertError);
          throw insertError;
        }
        console.log("✅ Created coach_teams_table entry for team:", requesterTeamId);
      }
    } else {
      console.log("ℹ️ User has no TeamId, skipping coach_teams_table creation");
    }

    // STEP 2: Get coach's team details
    const { data: coachData, error: coachDataError } = await supabase
      .from("team_table")
      .select("TeamId")
      .eq("UserId", request.UplineCoachId);

    if (coachDataError) throw coachDataError;

    const coachTeamId = coachData[0]?.TeamId; // Coach's business team code (e.g., "ABC123")
    
    // TEMPORARY: Store TeamId string until database migration is complete
    // TODO: After migrating CoachTeamId column to integer, store coach_teams_table.id instead
    let coachTeamIdValue = coachTeamId; // For now, store the TeamId string

    // STEP 3: NOW update team_table
    // Store only CoachId and CoachTeamId
    const updateData = {
      CoachId: request.UplineCoachId, // User's chosen referrer/coach
      CoachTeamId: coachTeamIdValue, // TEMPORARY: Storing TeamId string until schema migration
    };
    
    // NOTE: CoCoachId is NOT stored here - it's derived dynamically from coach_teams_table
    // by looking up coach_teams_table WHERE TeamId = CoachTeamId (after migration: WHERE id = CoachTeamId)

    await supabase
      .from("team_table")
      .update(updateData)
      .eq("UserId", requesterId);

    // STEP 4: Mark request as approved
    const processedAt = getISTTimestamp();
    await supabase
      .from("approval_requests_table")
      .update({ Status: "approved", ProcessedAt: processedAt })
      .eq("Id", request.Id);

    // Get requester and coach details for response
    const { data: userDetails, error: userDetailsError } = await supabase
      .from("team_table")
      .select("UserName, TeamId")
      .eq("UserId", requesterId);

    if (userDetailsError) throw userDetailsError;

    const { data: coachDetails, error: coachDetailsError } = await supabase
      .from("team_table")
      .select("UserName, Email")
      .eq("UserId", request.UplineCoachId);

    if (coachDetailsError) throw coachDetailsError;

    res.status(200).json({
      success: true,
      message: "Setup complete! You are now part of your coach's team.",
      coach: {
        name: coachDetails[0]?.UserName,
        email: coachDetails[0]?.Email,
      },
      redirectTo: "/dashboard",
    });
    return;
  } catch (error) {
    console.error("Error validating OTP:", error);

    res.status(500).json({
      success: false,
      error: "Failed to validate OTP",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
    return;
  }
}
