/**
 * Get User Setup Status
 * GET /api/user/status
 *
 * Returns user's setup completion status and appropriate redirect path
 * Used by route guards to determine where user should be
 *
 * 5 Possible States:
 * 1. No TeamId → /setup/team
 * 2. Has TeamId, no request → /setup/upline
 * 3. Has TeamId, pending non-expired request → /setup/validate-otp
 * 4. Has TeamId, expired request → /setup/upline (delete old request)
 * 5. Has TeamId + UplineCoachId → /dashboard (setup complete)
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
    const { email } = req.query;

    if (!email) {
      res.status(400).json({
        success: false,
        error: "Email is required",
      });
      return;
    }

    const supabase = getSupabaseClient();

    // Get user's details from team_table using Supabase
    const { data: user, error: userError } = await supabase
      .from("team_table")
      .select('"UserId", "TeamId", "UplineCoachId", "Role", "SetupSkipped"')
      .eq('"Email"', email)
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
    const hasUpline = !!user.UplineCoachId;
    const setupSkipped = user.SetupSkipped || false;

    // Check if user skipped setup - treat as complete
    if (setupSkipped) {
      res.status(200).json({
        success: true,
        setupComplete: true,
        setupSkipped: true,
        hasTeamId: hasTeamId,
        hasUpline: hasUpline,
        teamId: user.TeamId || null,
        uplineCoachId: user.UplineCoachId || null,
        pendingRequest: null,
        redirectTo: "/dashboard",
        message: hasUpline 
          ? "Setup skipped - coach relationship saved" 
          : "Setup skipped by user",
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
    // Now accepts EITHER (TeamId + Upline) OR just Upline (Team ID is optional)
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
        message: "Setup complete",
      });
      return;
    }

    // STATE 1: No Team ID and no Upline - Allow user to skip Team ID
    // User can proceed to select coach without Team ID
    if (!hasTeamId) {
      res.status(200).json({
        success: true,
        setupComplete: false,
        hasTeamId: false,
        hasUpline: false,
        pendingRequest: null,
        redirectTo: "/setup/team",
        message: "Please claim a Team ID or skip to select a coach",
      });
      return;
    }

    // Check for pending approval request using Supabase
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

        res.status(200).json({
          success: true,
          setupComplete: false,
          hasTeamId: true,
          hasUpline: false,
          pendingRequest: null,
          redirectTo: "/setup/upline",
          message: "Previous request expired. Please send a new request.",
        });
        return;
      }

      // STATE 3: Active pending request
      res.status(200).json({
        success: true,
        setupComplete: false,
        hasTeamId: true,
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
