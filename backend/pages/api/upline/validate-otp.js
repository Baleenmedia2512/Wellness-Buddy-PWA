/**
 * Validate OTP
 * POST /api/upline/validate-otp
 *
 * Validates OTP code, checks 24-hour expiry, updates user's UplineCoachId
 * Completes the setup process
 */

import {
  getSupabaseClient,
} from "../../../utils/supabaseClient.js";
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import bcrypt from "bcryptjs";
import logger from '../../../shared/lib/logger.js';
import {
  assignLeadSeat,
  resolveMemberCoachTeamId,
} from '../../../utils/coachTeamSeats.js';
import { OTP_LENGTH, OTP_REGEX } from '../../../shared/lib/otp.constants.js';

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
    // Resolve requester by email (legacy) or userId (phone / pre-email onboarding).
    const { otp, email, userId } = req.body;
    const uid = userId != null && String(userId).trim() !== ''
      ? Number(userId)
      : null;

    if (!email && !(uid && Number.isFinite(uid))) {
      res.status(400).json({
        success: false,
        error: "Email or userId is required",
      });
      return;
    }

    // Get OTP from request body
    if (!otp || otp.length !== OTP_LENGTH || !OTP_REGEX.test(otp)) {
      res.status(400).json({
        success: false,
        error: `OTP must be exactly ${OTP_LENGTH} digits`,
      });
      return;
    }

    // Connect to Supabase
    const supabase = getSupabaseClient();

    // ── Demo account: fixed OTP 0000 accepted, but do real DB ops ──────────
    // No OTP is emailed to the demo account, so we accept the fixed code and
    // then continue through the normal flow (DB records already exist after login).
    const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];
    const DEMO_OTP = '0000';
    const isDemoAccount = !!(email && DEMO_ACCOUNTS.includes(String(email).toLowerCase().trim()));
    // ─────────────────────────────────────────────────────────────────────────

    // Get requester's UserId
    let requesterId = null;
    if (uid && Number.isFinite(uid)) {
      const { data: byId, error: byIdErr } = await supabase
        .from("team_table")
        .select("UserId")
        .eq("UserId", uid)
        .maybeSingle();
      if (byIdErr) throw byIdErr;
      requesterId = byId?.UserId ?? null;
    } else {
      const { data: userRows, error: userError } = await supabase
        .from("team_table")
        .select("UserId")
        .eq("Email", email)
        .limit(1);

      if (userError) throw userError;
      requesterId = userRows?.[0]?.UserId ?? null;
    }

    if (!requesterId) {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }

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
    logger.debug("Verifying OTP:", {
      inputOtp: otp,
      storedHash: request.OtpHash?.substring(0, 20) + "...",
      requesterId: requesterId,
      requestId: request.Id,
    });

    const isValid = (isDemoAccount && otp === DEMO_OTP) || await bcrypt.compare(otp, request.OtpHash);

    logger.debug("OTP validation result:", isValid);

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

    // Get requester's TeamId (optional lead claim)
    const { data: requesterData, error: requesterDataError } = await supabase
      .from("team_table")
      .select("TeamId")
      .eq("UserId", requesterId);

    if (requesterDataError) throw requesterDataError;

    let requesterTeamId = requesterData[0]?.TeamId || null;
    let teamSeat = null;

    logger.debug(`📊 [validate-otp] Requester TeamId: ${requesterTeamId || 'none'}`);

    // STEP 1: Race-safe Sponsor / Co-Sponsor seat if user claimed a TeamId
    if (requesterTeamId) {
      const seatResult = await assignLeadSeat(supabase, requesterTeamId, requesterId);
      if (!seatResult.ok) {
        logger.warn('[validate-otp] Lead seat unavailable; clearing TeamId and continuing as member', {
          requesterId,
          teamId: requesterTeamId,
          error: seatResult.error,
        });
        const { error: clearTeamError } = await supabase
          .from('team_table')
          .update({ TeamId: null })
          .eq('UserId', requesterId);
        if (clearTeamError) throw clearTeamError;
        requesterTeamId = null;
        teamSeat = null;
      } else {
        teamSeat = seatResult.seat;
        logger.debug('✅ Lead seat assigned:', { teamId: requesterTeamId, seat: teamSeat });
      }
    } else {
      logger.debug('ℹ️ User has no TeamId, skipping coach_teams_table creation');
    }

    // STEP 2: Guide details — inherit shared CoachTeamId when member skipped Team Code
    const { data: coachData, error: coachDataError } = await supabase
      .from("team_table")
      .select("TeamId, CoachTeamId")
      .eq("UserId", request.UplineCoachId);

    if (coachDataError) throw coachDataError;

    // Lead claim → own TeamId. Skip → guide CoachTeamId (fallback guide TeamId).
    // TEMPORARY: CoachTeamId stores TeamId string until integer FK migration.
    const coachTeamIdValue = resolveMemberCoachTeamId({
      claimedTeamId: requesterTeamId,
      guide: coachData?.[0] || null,
    });

    // STEP 3: NOW update team_table
    // Store CoachId, CoachTeamId and reactivate user if they were Inactive.
    // LastActiveAt MUST be refreshed on reactivation so idle-return coach
    // notify (ADR-0007) does not fire immediately after OTP approval.
    const reactivatedAt = nowUtc();
    const updateData = {
      CoachId: request.UplineCoachId,
      CoachTeamId: coachTeamIdValue,
      Status: 'Active',
      LastActiveAt: reactivatedAt,
    };

    const { error: statusUpdateError } = await supabase
      .from("team_table")
      .update(updateData)
      .eq("UserId", requesterId);

    if (statusUpdateError) {
      console.error("❌ [validate-otp] Failed to reactivate user:", statusUpdateError);
      throw statusUpdateError;
    }

    // STEP 4: Mark request as approved
    const processedAt = nowUtc();
    await supabase
      .from("approval_requests_table")
      .update({ Status: "approved", ProcessedAt: processedAt })
      .eq("Id", request.Id);

    // Activated members leave BCM permanently — hard-delete all cards for this phone/user.
    try {
      const { purgeBcmCardsForActivatedMember } = await import(
        '../../../features/body-parameters-card/data/card.repo.js'
      );
      await purgeBcmCardsForActivatedMember(requesterId);
    } catch (bcmPurgeErr) {
      logger.warn('[validate-otp] BCM card purge after activation failed', {
        userId: requesterId,
        message: bcmPurgeErr?.message,
      });
    }

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
      teamSeat: teamSeat || null,
      coachTeamId: coachTeamIdValue || null,
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
