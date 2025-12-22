/**
 * Validate OTP
 * POST /api/upline/validate-otp
 * 
 * Validates OTP code, checks 24-hour expiry, updates user's UplineCoachId
 * Completes the setup process
 */

import mysql from 'mysql2/promise';
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    const connection = await mysql.createConnection(dbConfig);

    // Get requester's UserId
    const [userRows] = await connection.execute(
      'SELECT UserId FROM team_table WHERE Email = ? LIMIT 1',
      [email]
    );

    if (userRows.length === 0) {
      await connection.end();
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const requesterId = userRows[0].UserId;

    try {
      await connection.beginTransaction();

      // Get pending request
      const [requestRows] = await connection.execute(
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
        await connection.execute(
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
        await connection.execute(
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
      const isValid = await bcrypt.compare(otp, request.OtpHash);

      if (!isValid) {
        // Increment attempts
        const newAttempts = request.OtpAttempts + 1;
        
        await connection.execute(
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

      // Update user's UplineCoachId
      await connection.execute(
        'UPDATE team_table SET UplineCoachId = ? WHERE UserId = ?',
        [request.UplineCoachId, requesterId]
      );

      // Mark request as approved
      await connection.execute(
        'UPDATE approval_requests_table SET Status = ?, ProcessedAt = NOW() WHERE Id = ?',
        ['approved', request.Id]
      );

      // Get requester and coach details for response
      const [userDetails] = await connection.execute(
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
      throw dbError;

    } finally {
      await connection.end();
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
