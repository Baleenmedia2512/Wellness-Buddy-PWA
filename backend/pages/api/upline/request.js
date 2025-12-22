/**
 * Send Upline Coach Approval Request
 * POST /api/upline/request
 * 
 * Creates approval request, generates OTP, sends email to coach
 * Stores request in approval_requests_table with 24-hour expiry
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../../utils/email'; // Assumes existing email service

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'baleed5_wellness'
};

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
    // Get email and coachId from body
    const { coachId, email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!coachId) {
      return res.status(400).json({
        success: false,
        error: 'Coach ID is required'
      });
    }

    // Connect to database
    const connection = await mysql.createConnection(dbConfig);

    try {
      await connection.beginTransaction();

      // Get requester's UserId and details
      const [requesterRows] = await connection.execute(
        'SELECT UserId, UserName, Email, TeamId, UplineCoachId FROM team_table WHERE Email = ? LIMIT 1',
        [email]
      );

      if (requesterRows.length === 0) {
        await connection.rollback();
        await connection.end();
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const requesterId = requesterRows[0].UserId;

      // Prevent self-approval
      if (coachId === requesterId) {
        await connection.rollback();
        await connection.end();
        return res.status(400).json({
          success: false,
          error: 'You cannot select yourself as your coach'
        });
      }

      const requester = requesterRows[0];

      // Check if user has Team ID
      if (!requester.TeamId) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'You must claim a Team ID first',
          redirectTo: '/setup/team'
        });
      }

      // Check if user already has an upline coach
      if (requester.UplineCoachId) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'You already have an upline coach',
          redirectTo: '/dashboard'
        });
      }

      // Check for existing pending request
      const [existingRequests] = await connection.execute(
        `SELECT Id, Status, OtpExpiresAt 
         FROM approval_requests_table 
         WHERE RequesterId = ? 
         AND Status = 'pending'
         AND OtpExpiresAt > NOW()`,
        [requesterId]
      );

      if (existingRequests.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'You already have a pending request',
          requestId: existingRequests[0].Id,
          expiresAt: existingRequests[0].OtpExpiresAt,
          redirectTo: '/setup/validate-otp'
        });
      }

      // Delete any expired requests for this user
      await connection.execute(
        'DELETE FROM approval_requests_table WHERE RequesterId = ? AND Status = \'pending\' AND OtpExpiresAt < NOW()',
        [requesterId]
      );

      // Get coach details
      const [coachRows] = await connection.execute(
        'SELECT UserId, UserName, Email, CoachName, Role FROM team_table WHERE UserId = ?',
        [coachId]
      );

      if (coachRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'Coach not found'
        });
      }

      const coach = coachRows[0];

      // Verify coach role
      if (coach.Role !== 'admin') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Selected user is not a coach'
        });
      }

      // Generate 6-digit OTP
      const otp = generateOTP();
      const otpHash = await bcrypt.hash(otp, 10);

      // Create approval request with 24-hour expiry
      const [result] = await connection.execute(
        `INSERT INTO approval_requests_table 
        (RequesterId, UplineCoachId, Status, OtpHash, OtpExpiresAt, OtpSentAt, OtpAttempts, RequestedAt)
        VALUES (?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW(), 0, NOW())`,
        [requesterId, coachId, otpHash]
      );

      const requestId = result.insertId;

      // Send OTP email to coach
      const emailSubject = `Team Approval Request from ${requester.UserName}`;
      const emailBody = `
        <h2>New Team Member Request</h2>
        <p>Hello ${coach.CoachName || coach.UserName},</p>
        
        <p><strong>${requester.UserName}</strong> (${requester.Email}) has requested to join your team as a member.</p>
        
        <p><strong>Team ID:</strong> ${requester.TeamId}</p>
        
        <h3>Verification Code: ${otp}</h3>
        
        <p>Please share this 6-digit code with ${requester.UserName} to approve their request.</p>
        
        <p><strong>Important:</strong> This code expires in 24 hours.</p>
        
        <p>If you did not expect this request, please ignore this email.</p>
        
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated email from Wellness Buddy PWA.</p>
      `;

      try {
        await sendEmail({
          to: coach.Email,
          subject: emailSubject,
          html: emailBody
        });
      } catch (emailError) {
        console.error('Failed to send OTP email:', emailError);
        // Continue even if email fails - user can resend
      }

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Request sent successfully. OTP has been emailed to your coach.',
        requestId: requestId,
        coachName: coach.CoachName || coach.UserName,
        coachEmail: coach.Email,
        expiresIn: '24 hours',
        nextStep: 'validate-otp',
        redirectTo: '/setup/validate-otp'
      });

    } catch (dbError) {
      await connection.rollback();
      throw dbError;

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Error creating approval request:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to send request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
