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

import { getPool } from '../../../utils/dbPool.js';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'baleed5_wellness'
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

    // Connect to database
    const pool = getPool();

    // Get user's UserId from team_table
    const [userRows] = await pool.execute(
      'SELECT UserId, TeamId, UplineCoachId, Role FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    if (userRows.length === 0) {
return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userRows[0];
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
        teamId: user.TeamId,
        uplineCoachId: user.UplineCoachId,
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

      // Check for pending approval request
      const [requestRows] = await pool.execute(
        `SELECT Id, UplineCoachId, Status, OtpExpiresAt, RequestedAt
         FROM approval_requests_table
         WHERE RequesterId = ?
         AND Status = 'pending'
         ORDER BY RequestedAt DESC
         LIMIT 1`,
        [userId]
      );

      if (requestRows.length > 0) {
        const request = requestRows[0];
        const now = new Date();
        const expiresAt = new Date(request.OtpExpiresAt);

        // STATE 4: Expired request - delete it
        if (now > expiresAt) {
          await pool.execute(
            'DELETE FROM approval_requests_table WHERE Id = ?',
            [request.Id]
          );

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
