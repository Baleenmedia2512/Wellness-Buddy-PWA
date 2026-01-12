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

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const getSupabaseClient = () => {
  if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY is not set in environment variables');
  }
  return createClient(
    process.env.SUPABASE_URL || 'https://lnvvaeudhtazvxtmifeg.supabase.co',
    process.env.SUPABASE_ANON_KEY
  );
};

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Get email from query parameter
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const supabase = getSupabaseClient();

    // Get user's details from team_table using Supabase
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('"UserId", "TeamId", "UplineCoachId", "Role"')
      .eq('"Email"', email)
      .maybeSingle();

    if (userError) {
      console.error('❌ [status] Query error:', userError);
      throw new Error(userError.message);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    const userId = user.UserId;
    const userRole = user.Role;
    const hasTeamId = !!user.TeamId;
    const hasUpline = !!user.UplineCoachId;

    // ADMIN/DEVELOPER users bypass coach auth flow
    if (userRole === 'admin' || userRole === 'developer') {
return res.status(200).json({
        success: true,
        setupComplete: true,
        hasTeamId: hasTeamId,
        hasUpline: hasUpline,
        teamId: user.TeamId,
        uplineCoachId: user.UplineCoachId,
        role: userRole,
        pendingRequest: null,
        redirectTo: '/dashboard',
        message: 'Admin/Developer - setup not required'
      });
    }

    // STATE 5: Setup complete ✅
    if (hasTeamId && hasUpline) {
return res.status(200).json({
        success: true,
        setupComplete: true,
        hasTeamId: true,
        hasUpline: true,
        teamId: user.team_id,
        uplineCoachId: user.upline_coach_id,
        pendingRequest: null,
        redirectTo: '/dashboard',
        message: 'Setup complete'
      });
    }

    // STATE 1: No Team ID
    if (!hasTeamId) {
return res.status(200).json({
        success: true,
        setupComplete: false,
          hasTeamId: false,
          hasUpline: false,
          pendingRequest: null,
          redirectTo: '/setup/team',
          message: 'Please claim a Team ID'
        });
      }

      // Check for pending approval request using Supabase
      const { data: requestRows, error: requestError } = await supabase
        .from('approval_requests_table')
        .select('"Id", "UplineCoachId", "Status", "OtpExpiresAt", "RequestedAt"')
        .eq('"RequesterId"', userId)
        .eq('"Status"', 'pending')
        .order('"RequestedAt"', { ascending: false })
        .limit(1);

      if (requestError) {
        console.error('❌ [status] Request query error:', requestError);
      }

      if (requestRows && requestRows.length > 0) {
        const request = requestRows[0];
        const now = new Date();
        const expiresAt = new Date(request.OtpExpiresAt);

        // STATE 4: Expired request - delete it
        if (now > expiresAt) {
          await supabase
            .from('approval_requests_table')
            .delete()
            .eq('"Id"', request.Id);

          return res.status(200).json({
            success: true,
            setupComplete: false,
            hasTeamId: true,
            hasUpline: false,
            pendingRequest: null,
            redirectTo: '/setup/upline',
            message: 'Previous request expired. Please send a new request.'
          });
        }

        // STATE 3: Active pending request
        return res.status(200).json({
          success: true,
          setupComplete: false,
          hasTeamId: true,
          hasUpline: false,
          pendingRequest: {
            id: request.Id,
            coachId: request.UplineCoachId,
            status: request.Status,
            expiresAt: request.OtpExpiresAt,
            requestedAt: request.RequestedAt
          },
          redirectTo: '/setup/validate-otp',
          message: 'Waiting for OTP validation'
        });
      }

      // STATE 2: Has Team ID, no request
      return res.status(200).json({
        success: true,
        setupComplete: false,
        hasTeamId: true,
        hasUpline: false,
        teamId: user.TeamId,
        pendingRequest: null,
        redirectTo: '/setup/upline',
        message: 'Please select your upline coach'
      });

    } catch (error) {
      console.error('Error checking user status:', error);
return res.status(500).json({
        success: false,
        error: 'Failed to check user status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
}
