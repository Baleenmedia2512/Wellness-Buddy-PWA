import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { recipient: rawRecipient, contactType = 'phone' } = req.body;
  const recipient = rawRecipient ? rawRecipient.toLowerCase().trim() : rawRecipient;

  if (!recipient) {
    res.status(400).json({ message: 'Recipient is required' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Invalidate old OTPs
    const { error: updateError } = await supabase
      .from('otp_tokens_table')
      .update({ IsActive: false })
      .eq('"Recipient"', recipient)
      .eq('"ContactType"', contactType)
      .eq('"IsActive"', true);

    if (updateError) throw updateError;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    
    // Calculate expiry time in IST (5 minutes from now)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const expiresAt = new Date(now.getTime() + istOffset + 5 * 60 * 1000);
    const expiresAtIST = expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
    const currentTime = getISTTimestamp();

    const { error: insertError } = await supabase
      .from('otp_tokens_table')
      .insert({
        Recipient: recipient,
        OTPHash: otpHash,
        ExpiresAt: expiresAtIST,
        ContactType: contactType,
        IsActive: true,
        CreatedAt: currentTime
      });

    if (insertError) throw insertError;

    if (contactType === 'email') {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
      });

    const emailTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your OTP Code</title>
          <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
            .header p { color: #d1fae5; margin: 8px 0 0 0; font-size: 16px; }
            .content { padding: 50px 40px; text-align: center; }
            .otp-container { background: #f0fdf4; border: 2px dashed #bbf7d0; border-radius: 12px; padding: 30px; margin: 30px 0; }
            .otp-label { color: #6b7280; font-size: 14px; font-weight: 500; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
            .otp-code { font-size: 36px; font-weight: 700; color: #047857; letter-spacing: 6px; margin: 10px 0; font-family: 'Courier New', monospace; }
            .message { color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0; }
            .warning { background: #fef7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 30px 0; }
            .warning-icon { color: #ea580c; font-size: 20px; margin-bottom: 8px; }
            .warning-text { color: #9a3412; font-size: 14px; font-weight: 500; }
            .footer { background: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
            .footer p { color: #6b7280; font-size: 14px; margin: 0; line-height: 1.5; }
            .security-note { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 30px 0; }
            .security-icon { color: #16a34a; font-size: 20px; margin-bottom: 8px; }
            .security-text { color: #15803d; font-size: 14px; font-weight: 500; }
            @media (max-width: 600px) {
              .content { padding: 30px 20px; }
              .header { padding: 30px 20px; }
              .otp-code { font-size: 28px; letter-spacing: 4px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌿 Wellness Valley</h1>
              <p>Your trusted health companion</p>
            </div>
            
            <div class="content">
              <h2 style="color: #374151; margin: 0 0 20px 0; font-size: 24px;">Verification Code</h2>
              <p class="message">
                We've generated a secure verification code for your account. Please use the code below to complete your authentication.
              </p>
              
              <div class="otp-container">
                <div class="otp-label">Your OTP Code</div>
                <div class="otp-code">${otp}</div>
              </div>
              
              <div class="warning">
                <div class="warning-icon">⏰</div>
                <div class="warning-text">This code will expire in 5 minutes for your security.</div>
              </div>
              
              <div class="security-note">
                <div class="security-icon">🔒</div>
                <div class="security-text">
                  Never share this code with anyone. Wellness Valley will never ask for your OTP via phone or email.
                </p>
              </div>
              
              <p class="message">
                If you didn't request this code, please ignore this email or contact our support team if you have concerns.
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


      await transporter.sendMail({
        from: '"Wellness Valley" <easy2work.india@gmail.com>',
        to: recipient,
        subject: '🔐 Your OTP Code - Wellness Valley',
        html: emailTemplate
      });
    }

    res.json({ success: true, otp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
