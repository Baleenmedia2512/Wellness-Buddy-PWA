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
import nodemailer from "nodemailer";
import logger from '../../../shared/lib/logger.js';

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

// Production email service using nodemailer (same as send-otp.js)
const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: '"Wellness Valley" <easy2work.india@gmail.com>',
      to: to,
      subject: subject,
      html: html,
    });

    logger.debug("✅ OTP email sent successfully to:", to);
    return { success: true };
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    // Don't throw - allow request creation to succeed even if email fails
    return { success: false, error: error.message };
  }
};

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    // ── Demo account: auto-assign Yasheer J as coach with fixed OTP 000000 ──
    // No email is sent; the tester enters 000000 to complete setup.
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

      // Hash fixed OTP 000000
      const demoOtpHash = await bcrypt.hash('000000', 10);
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

      logger.debug('✅ [upline/request] Demo request created with Yasheer J. OTP: 000000');
      return res.status(200).json({
        success: true,
        message: 'Request sent! Enter OTP 000000 to complete setup.',
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

    // Generate 6-digit OTP
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

    // Send OTP email to coach with professional template
    const emailSubject = `🤝 Team Approval Request - Wellness Valley`;
    const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Approval Request</title>
          <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
            .header p { color: #d1fae5; margin: 8px 0 0 0; font-size: 16px; }
            .content { padding: 50px 40px; }
            .greeting { color: #374151; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; }
            .message { color: #4b5563; font-size: 16px; line-height: 1.6; margin: 20px 0; }
            .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0; }
            .info-label { color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
            .info-value { color: #047857; font-size: 16px; font-weight: 500; }
            .otp-container { background: #f0fdf4; border: 2px dashed #bbf7d0; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; }
            .otp-label { color: #6b7280; font-size: 14px; font-weight: 500; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
            .otp-code { font-size: 42px; font-weight: 700; color: #047857; letter-spacing: 8px; margin: 10px 0; font-family: 'Courier New', monospace; }
            .warning { background: #fef7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 30px 0; }
            .warning-icon { color: #ea580c; font-size: 20px; margin-bottom: 8px; }
            .warning-text { color: #9a3412; font-size: 14px; font-weight: 500; }
            .security-note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 30px 0; }
            .security-icon { color: #2563eb; font-size: 20px; margin-bottom: 8px; }
            .security-text { color: #1e40af; font-size: 14px; font-weight: 500; line-height: 1.5; }
            .footer { background: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
            .footer p { color: #6b7280; font-size: 14px; margin: 0; line-height: 1.5; }
            @media (max-width: 600px) {
              .content { padding: 30px 20px; }
              .header { padding: 30px 20px; }
              .otp-code { font-size: 32px; letter-spacing: 5px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌿 Wellness Valley</h1>
              <p>Team Collaboration Request</p>
            </div>
            
            <div class="content">
              <div class="greeting">Hello ${coach.CoachName || coach.UserName}! 👋</div>
              
              <p class="message">
                You have a new team member request. <strong>${requester.UserName}</strong> would like to join your coaching team.
              </p>
              
              <div class="info-box">
                <div class="info-label">Requester Details</div>
                <div class="info-value">👤 ${requester.UserName}</div>
                <div class="info-value">📧 ${requester.Email || requester.PhoneNumber || 'Email not set yet'}</div>
                ${requester.TeamId ? `<div class="info-value">🔖 Team ID: ${requester.TeamId}</div>` : ""}
              </div>
              
              <div class="otp-container">
                <div class="otp-label">Approval Code</div>
                <div class="otp-code">${otp}</div>
                <p style="color: #6b7280; font-size: 14px; margin: 15px 0 0 0;">
                  Share this code with ${requester.UserName} to approve their request
                </p>
              </div>
              
              <div class="warning">
                <div class="warning-icon">⏰</div>
                <div class="warning-text">This approval code will expire in 24 hours.</div>
              </div>
              
              <div class="security-note">
                <div class="security-icon">🔒</div>
                <div class="security-text">
                  <strong>Security Note:</strong> Only share this code with ${requester.UserName} directly. 
                  If you didn't expect this request or don't recognize this person, please ignore this email.
                </div>
              </div>
              
              <p class="message">
                Once you share the code, ${requester.UserName} can enter it to complete the team setup.
              </p>
            </div>
            
            <div class="footer">
              <p>
                <strong>Wellness Valley Team</strong><br>
                This is an automated message. Please do not reply to this email.<br>
                Need help? Contact us at easy2work.india@gmail.com
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

    try {
      await sendEmail({
        to: coach.Email,
        subject: emailSubject,
        html: emailBody,
      });
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      // Continue even if email fails - user can resend
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
