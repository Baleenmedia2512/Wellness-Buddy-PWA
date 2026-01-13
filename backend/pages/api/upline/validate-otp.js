/**
 * Validate OTP
 * POST /api/upline/validate-otp
 * 
 * Validates OTP code, checks 24-hour expiry, updates user's UplineCoachId
 * Completes the setup process
 */

import { getPool, getConnection } from '../../../utils/dbPool.js';
import bcrypt from 'bcryptjs';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'baleed5_wellness'
};

const MAX_OTP_ATTEMPTS = 5;

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Get email and otp from body
    const { otp, email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Get OTP from request body
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        error: 'OTP must be exactly 6 digits'
      });
    }

    // Connect to database
    const pool = getPool();

    // Get requester's UserId
    const [userRows] = await pool.execute(
      'SELECT UserId FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    if (userRows.length === 0) {
return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const requesterId = userRows[0].UserId;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get pending request
      const [requestRows] = await pool.execute(
        `SELECT Id, RequesterId, UplineCoachId, OtpHash, OtpExpiresAt, OtpAttempts, Status
         FROM approval_requests_table
         WHERE RequesterId = ?
         AND Status = 'pending'
         ORDER BY RequestedAt DESC
         LIMIT 1`,
        [requesterId]
      );

      if (requestRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'No pending request found'
        });
      }

      const request = requestRows[0];

      // Check if OTP has expired (24 hours)
      const now = new Date();
      const expiresAt = new Date(request.OtpExpiresAt);

      if (now > expiresAt) {
        // Mark as expired and delete
        await pool.execute(
          'UPDATE approval_requests_table SET Status = ? WHERE Id = ?',
          ['expired', request.Id]
        );
        
        await connection.commit();

        return res.status(400).json({
          success: false,
          error: 'This code has expired (24 hours). Please send a new request.',
          expired: true
        });
      }

      // Check max attempts
      if (request.OtpAttempts >= MAX_OTP_ATTEMPTS) {
        // Delete request after max attempts
        await pool.execute(
          'DELETE FROM approval_requests_table WHERE Id = ?',
          [request.Id]
        );
        
        await connection.commit();

        return res.status(400).json({
          success: false,
          error: 'Maximum attempts exceeded. Please send a new request.',
          maxAttemptsExceeded: true
        });
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
        
        await pool.execute(
          'UPDATE approval_requests_table SET OtpAttempts = ? WHERE Id = ?',
          [newAttempts, request.Id]
        );
        
        await connection.commit();

        return res.status(400).json({
          success: false,
          error: 'Incorrect verification code',
          attemptsLeft: MAX_OTP_ATTEMPTS - newAttempts
        });
      }

      // OTP is valid! Complete setup

      // Get requester's TeamId first
      const [requesterData] = await pool.execute(
        'SELECT TeamId FROM team_table WHERE UserId = ?',
        [requesterId]
      );

      const requesterTeamId = requesterData[0]?.TeamId;

      if (!requesterTeamId) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Requester does not have a TeamId assigned'
        });
      }

      // STEP 1: Update coach_teams_table FIRST (before team_table)
      // Check if TeamId exists in coach_teams_table (including inactive)
      const [existingTeam] = await pool.execute(
        'SELECT TeamId, CoachId, CoCoachId, Status FROM coach_teams_table WHERE TeamId = ?',
        [requesterTeamId]
      );

      if (existingTeam.length > 0) {
        const team = existingTeam[0];
        
        if (team.Status === 'active') {
          // Team is active, add requester as CoCoachId if slot available
          if (!team.CoCoachId) {
            await pool.execute(
              'UPDATE coach_teams_table SET CoCoachId = ?, UpdatedAt = NOW() WHERE TeamId = ? AND Status = "active"',
              [requesterId, requesterTeamId]
            );
          }
        } else {
          // Team is inactive, reactivate with requester as primary coach
          await pool.execute(
            'UPDATE coach_teams_table SET CoachId = ?, CoCoachId = NULL, Status = "active", UpdatedAt = NOW() WHERE TeamId = ?',
            [requesterId, requesterTeamId]
          );
        }
      } else {
        // Create new entry with requester as primary coach
        await pool.execute(
          'INSERT INTO coach_teams_table (TeamId, CoachId, Status) VALUES (?, ?, "active")',
          [requesterTeamId, requesterId]
        );
      }

      // STEP 2: Get coach details for CoachName and CoCoachName
      const [coachData] = await pool.execute(
        'SELECT TeamId, UserName FROM team_table WHERE UserId = ?',
        [request.UplineCoachId]
      );

      const coachTeamId = coachData[0]?.TeamId;
      const coachName = coachData[0]?.UserName;
      let coCoachName = null;

      if (coachTeamId) {
        // Find the co-coach from coach_teams_table
        const [coachTeam] = await pool.execute(
          'SELECT CoachId, CoCoachId FROM coach_teams_table WHERE TeamId = ? AND Status = "active"',
          [coachTeamId]
        );

        if (coachTeam.length > 0) {
          // Determine which is the co-coach (the one that's not our coach)
          const coCoachId = coachTeam[0].CoachId === request.UplineCoachId 
            ? coachTeam[0].CoCoachId 
            : coachTeam[0].CoachId;

          if (coCoachId) {
            const [coCoachData] = await pool.execute(
              'SELECT UserName FROM team_table WHERE UserId = ?',
              [coCoachId]
            );
            coCoachName = coCoachData[0]?.UserName || null;
          }
        }
      }

      // STEP 3: NOW update team_table (after coach_teams_table succeeds)
      await pool.execute(
        'UPDATE team_table SET UplineCoachId = ?, CoachName = ?, CoCoachName = ? WHERE UserId = ?',
        [request.UplineCoachId, coachName, coCoachName, requesterId]
      );

      // STEP 4: Mark request as approved
      await pool.execute(
        'UPDATE approval_requests_table SET Status = ?, ProcessedAt = NOW() WHERE Id = ?',
        ['approved', request.Id]
      );

      // Get requester and coach details for response
      const [userDetails] = await pool.execute(
        `SELECT 
          r.UserName as RequesterName,
          r.TeamId as RequesterTeamId,
          c.UserName as CoachName,
          c.Email as CoachEmail
         FROM team_table r
         JOIN team_table c ON c.UserId = ?
         WHERE r.UserId = ?`,
        [request.UplineCoachId, requesterId]
      );

      await connection.commit();
      connection.release();

      return res.status(200).json({
        success: true,
        message: 'Setup complete! You are now part of your coach\'s team.',
        coach: {
          name: userDetails[0]?.CoachName,
          email: userDetails[0]?.CoachEmail
        },
        redirectTo: '/dashboard'
      });

    } catch (dbError) {
      await connection.rollback();
      connection.release();
      throw dbError;
    }

  } catch (error) {
    console.error('Error validating OTP:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to validate OTP',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
