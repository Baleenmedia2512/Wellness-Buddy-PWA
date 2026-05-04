/**
 * Get User Setup Status
 * GET /api/user/status
 *
 * Returns user's setup completion status and appropriate redirect path
 * Used by route guards to determine where user should be
 *
 * Possible States (checked in order):
 * 1. Has upline coach → /dashboard (setup complete, Team ID optional)
 * 2. Has pending OTP request → /setup/validate-otp (works with or without Team ID)
 * 3. No TeamId, no pending request → /setup/upline (Team ID is optional)
 * 4. Has TeamId, no request → /setup/upline
 * 5. Has expired request → /setup/upline (delete old request)
 */

import { getSupabaseClient } from "../../../utils/supabaseClient.js";

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  // Handle CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, authorization, cache-control, pragma",
    );
    res.status(200).end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, authorization, cache-control, pragma",
  );

  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
    return;
  }

  try {
    // Get email from query parameter
    const { email: rawEmail } = req.query;
    const email = rawEmail ? rawEmail.toLowerCase().trim() : rawEmail;

    if (!email) {
      res.status(400).json({
        success: false,
        error: "Email is required",
      });
      return;
    }

    // ── Demo account bypass for App Store review ────────────────────────
    // test@example.com doesn't exist in DB — return mock status so app doesn't 404.
    // setupComplete: false → shows SetupWizard (coach selection) as intended.
    const DEMO_ACCOUNTS = ['test@example.com'];
    if (DEMO_ACCOUNTS.includes(email)) {
      return res.status(200).json({
        success: true,
        setupComplete: false,
        hasTeamId: false,
        hasUpline: false,
        setupSkipped: false,
        teamId: null,
        uplineCoachId: null,
        role: 'member',
        pendingRequest: null,
        redirectTo: '/setup/upline',
        message: 'Demo account - please select a coach',
      });
    }
    // ───────────────────────────────────────────────────────────────────

    const supabase = getSupabaseClient();

    // Get user's details from team_table using Supabase
    const { data: user, error: userError } = await supabase
      .from("team_table")
      .select('"UserId", "TeamId", "CoachId", "Role", "SetupSkipped"')
      .ilike('Email', email)
      .maybeSingle();

    if (userError) {
      console.error("❌ [status] Query error:", userError);
      throw new Error(userError.message);
    }

    if (!user) {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }
    const userId = user.UserId;
    const userRole = user.Role;
    const hasTeamId = !!user.TeamId;
    const hasUpline = !!user.CoachId;
    const setupSkipped = user.SetupSkipped === true;

    // CHECK IF USER SKIPPED SETUP
    if (setupSkipped) {
      console.log("⏭️ [status] User skipped setup, allowing access");
      res.status(200).json({
        success: true,
        setupComplete: true, // Treat as complete to avoid showing wizard
        hasTeamId: hasTeamId,
        hasUpline: hasUpline,
        setupSkipped: true,
        teamId: user.TeamId,
        uplineCoachId: user.UplineCoachId,
        role: userRole,
        pendingRequest: null,
        redirectTo: "/dashboard",
        message: hasUpline
          ? "Setup skipped - Coach relationship saved"
          : "Setup skipped - You can use the app",
      });
      return;
    }

    // ADMIN/DEVELOPER users bypass coach auth flow
    if (userRole === "admin" || userRole === "developer") {
      res.status(200).json({
        success: true,
        setupComplete: true,
        hasTeamId: hasTeamId,
        hasUpline: hasUpline,
        teamId: user.TeamId,
        uplineCoachId: user.UplineCoachId,
        role: userRole,
        pendingRequest: null,
        redirectTo: "/dashboard",
        message: "Admin/Developer - setup not required",
      });
      return;
    }

    // STATE 5: Setup complete ✅
    // User has upline coach = setup is complete (Team ID is optional)
    if (hasUpline) {
      res.status(200).json({
        success: true,
        setupComplete: true,
        hasTeamId: hasTeamId,
        hasUpline: true,
        teamId: user.TeamId || null,
        uplineCoachId: user.UplineCoachId,
        pendingRequest: null,
        redirectTo: "/dashboard",
        message: hasTeamId
          ? "Setup complete"
          : "Setup complete (without Team ID)",
      });
      return;
    }

    // Check for pending approval request FIRST (regardless of Team ID)
    // This ensures users who skip Team ID but have pending OTP are redirected correctly
    const { data: requestRows, error: requestError } = await supabase
      .from("approval_requests_table")
      .select('"Id", "UplineCoachId", "Status", "OtpExpiresAt", "RequestedAt"')
      .eq('"RequesterId"', userId)
      .eq('"Status"', "pending")
      .order('"RequestedAt"', { ascending: false })
      .limit(1);

    if (requestError) {
      console.error("❌ [status] Request query error:", requestError);
    }

    if (requestRows && requestRows.length > 0) {
      const request = requestRows[0];
      const now = new Date();
      const expiresAt = new Date(request.OtpExpiresAt);

      // STATE 4: Expired request - delete it
      if (now > expiresAt) {
        await supabase
          .from("approval_requests_table")
          .delete()
          .eq('"Id"', request.Id);

        // After deleting expired request, continue to appropriate redirect below
      } else {
        // STATE 3: Active pending request (works with or without Team ID)
        res.status(200).json({
          success: true,
          setupComplete: false,
          hasTeamId: hasTeamId,
          hasUpline: false,
          pendingRequest: {
            id: request.Id,
            coachId: request.UplineCoachId,
            status: request.Status,
            expiresAt: request.OtpExpiresAt,
            requestedAt: request.RequestedAt,
          },
          redirectTo: "/setup/validate-otp",
          message: "Waiting for OTP validation",
        });
        return;
      }
    }

    // STATE 1: No Team ID, no pending request - allow proceeding to upline selection
    if (!hasTeamId) {
      res.status(200).json({
        success: true,
        setupComplete: false,
        hasTeamId: false,
        hasUpline: false,
        pendingRequest: null,
        redirectTo: "/setup/upline",
        message: "Team ID is optional - You can select your coach directly",
        allowSkipTeamId: true,
      });
      return;
    }

    // STATE 2: Has Team ID, no request
    res.status(200).json({
      success: true,
      setupComplete: false,
      hasTeamId: true,
      hasUpline: false,
      teamId: user.TeamId,
      pendingRequest: null,
      redirectTo: "/setup/upline",
      message: "Please select your upline coach",
    });
    return;
  } catch (error) {
    console.error("Error checking user status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check user status",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
    return;
  }
}
