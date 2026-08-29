/**
 * Send Upline Coach Approval Request
 * POST /api/upline/request
 *
 * Creates approval request, generates OTP, sends email to coach
 * Stores request in approval_requests_table with 24-hour expiry
 */

import {
  getSupabaseClient,
} from "../../../utils/supabaseClient.js";
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import { resolveActiveCoach } from "../../../utils/hierarchyHelpers.js";
import bcrypt from "bcryptjs";
import logger from '../../../shared/lib/logger.js';
import { sendTransactionalMail } from '../../../shared/lib/smtp-mail.js';
import { buildSponsorOtpEmail } from '../../../features/auth/domain/otp-email.rules.js';
import { generateOtp } from '../../../shared/lib/otp.constants.js';

/** Resolve requester row by userId, email (case-insensitive), or phone. */
async function findRequester(supabase, { userId, email, phone }) {
  const cols = "UserId, UserName, Email, TeamId, CoachId, Status, PhoneNumber";

  if (userId) {
    const { data, error } = await supabase
      .from("team_table")
      .select(cols)
      .eq("UserId", userId)
      .limit(1);
    if (error) throw error;
    if (data?.[0]) return data[0];
  }

  if (email) {
    const { data, error } = await supabase
      .from("team_table")
      .select(cols)
      .ilike("Email", email.trim())
      .limit(1);
    if (error) throw error;
    if (data?.[0]) return data[0];
  }

  if (phone) {
    const normalized = String(phone).trim();
    const { data, error } = await supabase
      .from("team_table")
      .select(cols)
      .eq("PhoneNumber", normalized)
      .limit(1);
    if (error) throw error;
    if (data?.[0]) return data[0];

    const digits = normalized.replace(/\D/g, "");
    if (digits.length >= 10) {
      const { data: bySuffix, error: suffixErr } = await supabase
        .from("team_table")
        .select(cols)
        .ilike("PhoneNumber", `%${digits.slice(-10)}`)
        .limit(1);
      if (suffixErr) throw suffixErr;
      if (bySuffix?.[0]) return bySuffix[0];
    }
  }

  return null;
}

/** Resolve coach id for inactive reactivation when client did not supply one. */
async function resolveCoachForReactivation(supabase, requester, explicitCoachId) {
  if (explicitCoachId) return explicitCoachId;
  if (!requester.CoachId) return null;

  const { coachId } = await resolveActiveCoach(requester.UserId, supabase);
  return coachId || requester.CoachId;
}

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    await sendTransactionalMail({ to, subject, text, html });
    return { success: true };
  } catch (error) {
    logger.warn("[upline/request] email sending failed", { message: error.message });
    return { success: false, error: error.message };
  }
};

// Generate 4-digit OTP
function generateOTP() {
  return generateOtp();
}

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
    const { coachId: bodyCoachId, email, phone, userId } = req.body;

    if (!email && !phone && !userId) {
      res.status(400).json({
        success: false,
        error: "Email, phone, or userId is required",
      });
      return;
    }

    const supabase = getSupabaseClient();

    // ── Demo account: auto-assign Yasheer J as coach with fixed OTP 0000 ──
    // No email is sent; the tester enters 0000 to complete setup.
    const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];
    const emailNorm = typeof email === 'string' ? email.toLowerCase().trim() : '';
    if (emailNorm && DEMO_ACCOUNTS.includes(emailNorm)) {
      logger.debug('ℹ️ [upline/request] Demo account — auto-assigning Yasheer J as coach');

      // Look up Yasheer J from DB dynamically (no hardcoded ID)
      const { data: yasheerRows, error: yasheerErr } = await supabase
        .from('team_table')
        .select('UserId, UserName, Email')
        .ilike('UserName', 'Yasheer J')
        .limit(1);

      if (yasheerErr || !yasheerRows || yasheerRows.length === 0) {
        console.error('❌ [upline/request] Could not find Yasheer J in DB:', yasheerErr);
        return res.status(500).json({ success: false, error: 'Default coach not found. Please contact support.' });
      }

      const demoCoach = yasheerRows[0];

      // Get demo requester's UserId
      const { data: demoRequesterRows, error: demoRequesterErr } = await supabase
        .from('team_table')
        .select('UserId, UserName, CoachId')
        .ilike('Email', email)
        .limit(1);

      if (demoRequesterErr || !demoRequesterRows || demoRequesterRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Demo user not found in DB. Please login again.' });
      }

      const demoRequester = demoRequesterRows[0];

      if (demoRequester.CoachId) {
        return res.status(400).json({ success: false, error: 'You already have a coach', redirectTo: '/dashboard' });
      }

      // Cancel any existing pending requests
      await supabase
        .from('approval_requests_table')
        .update({ Status: 'cancelled', ProcessedAt: nowUtc() })
        .eq('RequesterId', demoRequester.UserId)
        .eq('Status', 'pending');

      // Hash fixed OTP 0000
      const demoOtpHash = await bcrypt.hash('0000', 10);
      const requestedAt = new Date();
      const otpExpiresAt = new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000);

      const { data: demoInsert, error: demoInsertErr } = await supabase
        .from('approval_requests_table')
        .insert([{
          RequesterId: demoRequester.UserId,
          UplineCoachId: demoCoach.UserId,
          Status: 'pending',
          OtpHash: demoOtpHash,
          OtpExpiresAt: otpExpiresAt.toISOString(),
          OtpSentAt: requestedAt.toISOString(),
          OtpAttempts: 0,
          RequestedAt: requestedAt.toISOString(),
        }])
        .select('Id');

      if (demoInsertErr) throw demoInsertErr;

      logger.debug('✅ [upline/request] Demo request created with Yasheer J. OTP: 0000');
      return res.status(200).json({
        success: true,
        message: 'Request sent! Enter OTP 0000 to complete setup.',
        requestId: demoInsert[0].Id,
        coachName: demoCoach.UserName,
        nextStep: 'validate-otp',
        redirectTo: '/setup/validate-otp',
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const requester = await findRequester(supabase, { userId, email, phone });

    if (!requester) {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }

    const requesterId = requester.UserId;
    const coachId = await resolveCoachForReactivation(
      supabase,
      requester,
      bodyCoachId,
    );

    if (!coachId) {
      res.status(400).json({
        success: false,
        error: "NO_COACH_ASSIGNED",
        message:
          "No coach is assigned to your account. Please ask your wellness center to link you to a coach.",
      });
      return;
    }

    // Prevent self-approval
    if (String(coachId) === String(requesterId)) {
      res.status(400).json({
        success: false,
        error: "You cannot select yourself as your coach",
      });
      return;
    }

    // Team ID is now optional - user can proceed without claiming it first
    // This allows flexible onboarding flow

    // Check if user already has a coach — allow inactive users to re-request
    // so they can reactivate via coach OTP flow
    if (requester.CoachId && requester.Status !== 'Inactive') {
      res.status(400).json({
        success: false,
        error: "You already have a coach",
        redirectTo: "/dashboard",
      });
      return;
    }

    const now = nowUtc();
    const { data: existingPendingRows, error: existingPendingErr } = await supabase
      .from("approval_requests_table")
      .select("Id, UplineCoachId, OtpExpiresAt, Status")
      .eq("RequesterId", requesterId)
      .eq("Status", "pending")
      .order("RequestedAt", { ascending: false })
      .limit(1);
    if (existingPendingErr) throw existingPendingErr;

    const existingPending = existingPendingRows?.[0];
    const existingStillValid = !!(
      existingPending
      && String(existingPending.UplineCoachId) === String(coachId)
      && existingPending.OtpExpiresAt
      && new Date(now) < new Date(existingPending.OtpExpiresAt)
    );

    if (existingStillValid) {
      const { data: existingCoachRows } = await supabase
        .from("team_table")
        .select("UserName")
        .eq("UserId", coachId)
        .limit(1);
      return res.status(200).json({
        success: true,
        reused: true,
        requestId: existingPending.Id,
        coachName: existingCoachRows?.[0]?.UserName || null,
        nextStep: "validate-otp",
        redirectTo: "/setup/validate-otp",
        message: "A verification code is already pending with your coach.",
      });
    }

    // Cancel any existing pending requests for this user
    await supabase
      .from("approval_requests_table")
      .update({ Status: "cancelled", ProcessedAt: now })
      .eq("RequesterId", requesterId)
      .eq("Status", "pending");

    // Get coach details
    const { data: coachRows, error: coachError } = await supabase
      .from("team_table")
      .select("UserId, UserName, Email, CoachName, Role")
      .eq("UserId", coachId);

    if (coachError) throw coachError;

    if (!coachRows || coachRows.length === 0) {
      res.status(404).json({
        success: false,
        error: "Coach not found",
      });
      return;
    }

    const coach = coachRows[0];

    // Generate 4-digit OTP
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    // ─────────────────────────────────────────────────────────────────

    // Calculate 24-hour expiry
    const requestedAt = new Date();
    const otpExpiresAt = new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000);
    const currentTime = nowUtc();

    // Create approval request with 24-hour expiry
    const { data: insertResult, error: insertError } = await supabase
      .from("approval_requests_table")
      .insert([
        {
          RequesterId: requesterId,
          UplineCoachId: coachId,
          Status: "pending",
          OtpHash: otpHash,
          OtpExpiresAt: otpExpiresAt.toISOString(),
          OtpSentAt: requestedAt.toISOString(),
          OtpAttempts: 0,
          RequestedAt: requestedAt.toISOString(),
        },
      ])
      .select("Id");

    if (insertError) throw insertError;

    const requestId = insertResult[0].Id;

    if (!coach.Email) {
      res.status(502).json({
        success: false,
        error: "Your sponsor has no email on file, so we cannot send the OTP. Choose another sponsor.",
      });
      return;
    }

    const mail = buildSponsorOtpEmail({
      otp,
      memberName: requester.UserName,
      expiresHours: 24,
    });
    const emailResult = await sendEmail({
      to: coach.Email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    if (!emailResult.success) {
      logger.warn("[upline/request] sponsor OTP email failed", {
        message: emailResult.error,
      });
      res.status(502).json({
        success: false,
        error: "Could not email the OTP to your sponsor. Please try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Request sent successfully. OTP has been emailed to your coach.",
      requestId: requestId,
      coachName: coach.CoachName || coach.UserName,
      coachEmail: coach.Email,
      expiresIn: "24 hours",
      nextStep: "validate-otp",
      redirectTo: "/setup/validate-otp",
    });
    return;
  } catch (error) {
    console.error("Error creating approval request:", error);

    res.status(500).json({
      success: false,
      error: "Failed to send request",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
    return;
  }
}
