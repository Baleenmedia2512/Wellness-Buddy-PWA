/**
 * Send Upline Coach Approval Request
 * POST /api/upline/request
 * 
 * Creates approval request, generates OTP, sends email to coach
 * Stores request in approval_requests_table with 24-hour expiry
 */

import { getPool } from '../../utils/dbPool.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

// Production email service using nodemailer (same as send-otp.js)
const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: '"Wellness Valley" <easy2work.india@gmail.com>',
      to: to,
      subject: subject,
      html: html
    });

    console.log('✅ OTP email sent successfully to:', to);
    return { success: true };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    // Don't throw - allow request creation to succeed even if email fails
    return { success: false, error: error.message };
  }
};

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
    const pool = getPool();

    try {
      await connection.beginTransaction();

      // Get requester's UserId and details
      const [requesterRows] = await pool.execute(
        'SELECT UserId, UserName, Email, TeamId, UplineCoachId FROM team_table WHERE Email = ? LIMIT 1',
        [email]
      );

      if (requesterRows.length === 0) {
        await connection.rollback();
return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const requesterId = requesterRows[0].UserId;

      // Prevent self-approval
      if (coachId === requesterId) {
        await connection.rollback();
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

      // Cancel any existing pending requests for this user
      await pool.execute(
        `UPDATE approval_requests_table 
         SET Status = 'cancelled', ProcessedAt = NOW()
         WHERE RequesterId = ? AND Status = 'pending'`,
        [requesterId]
      );

      // Get coach details
      const [coachRows] = await pool.execute(
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

      // Note: Not checking Role since all users can be coaches
      // if (coach.Role !== 'admin') {
      //   await connection.rollback();
      //   return res.status(400).json({
      //     success: false,
      //     error: 'Selected user is not a coach'
      //   });
      // }

      // Generate 6-digit OTP
      const otp = generateOTP();
      const otpHash = await bcrypt.hash(otp, 10);

      // Create approval request with 24-hour expiry
      const [result] = await pool.execute(
        `INSERT INTO approval_requests_table 
        (RequesterId, UplineCoachId, Status, OtpHash, OtpExpiresAt, OtpSentAt, OtpAttempts, RequestedAt)
        VALUES (?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW(), 0, NOW())`,
        [requesterId, coachId, otpHash]
      );

      const requestId = result.insertId;

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
                <div class="info-value">📧 ${requester.Email}</div>
                <div class="info-value">🔖 Team ID: ${requester.TeamId}</div>
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
