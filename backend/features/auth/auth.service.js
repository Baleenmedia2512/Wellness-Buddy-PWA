import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import * as repo from './auth.repository.js';
import logger from '../../shared/lib/logger.js';
import { isValidPhoneE164, usernameFromPhone } from './domain/contactIdentifier.js';
import { canonicalPhoneForStorage } from './domain/phone-identity.rules.js';
import { MDT_OTP_EXPIRY_MINUTES, getMdtSmsConfigGaps, maskPhoneForLog, mdtApiKeyHint, mdtSenderIdHint, mdtTemplateIdHint } from './domain/mdt-phone.rules.js';
import { buildMdtOtpMessage } from './domain/otp-message.rules.js';
import { sendMdtSms } from './data/mdt-sms.client.js';

const { getISTTimestamp } = repo;
const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];

/** Returns names of missing SMTP env-vars, analogous to getMdtSmsConfigGaps(). */
function getSmtpConfigGaps() {
  const gaps = [];
  if (!process.env.SMTP_USER) gaps.push('SMTP_USER');
  if (!process.env.SMTP_PASS) gaps.push('SMTP_PASS');
  return gaps;
}

function smtpUserHint() {
  const u = process.env.SMTP_USER;
  if (!u) return 'not set';
  const at = u.indexOf('@');
  return at > 0 ? `${u.slice(0, Math.min(3, at))}***@${u.slice(at + 1)}` : `${u.slice(0, 3)}***`;
}

function buildOtpEmailHtml(otp) {
  return `
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
                  Never share this code with anyone. Wellness Valley Team will never ask for your OTP via phone or email.
                </div>
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
}

async function sendOtpEmail(recipient, otp) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: '"Wellness Valley" <easy2work.india@gmail.com>',
    to: recipient,
    subject: '🔐 Your OTP Code - Wellness Valley',
    html: buildOtpEmailHtml(otp),
  });
}

function otpExpiryIst(minutesFromNow) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + istOffset + minutesFromNow * 60 * 1000);
  return expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

async function createAndDeliverOtp({ recipient, contactType }) {
  logger.info('[sendOtp] creating OTP record', {
    contactType,
    recipientHint: contactType === 'phone' ? maskPhoneForLog(recipient) : recipient,
  });

  await repo.deactivateActiveOtps(recipient, contactType);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiryMinutes = contactType === 'phone' ? MDT_OTP_EXPIRY_MINUTES : 5;

  await repo.insertOtpToken({
    Recipient: recipient,
    OTPHash: otpHash,
    ExpiresAt: otpExpiryIst(expiryMinutes),
    ContactType: contactType,
    IsActive: true,
    CreatedAt: getISTTimestamp(),
  });

  logger.info('[sendOtp] OTP stored, dispatching', {
    contactType,
    expiryMinutes,
    channel: contactType === 'phone' ? 'mdt-sms' : 'smtp',
  });

  if (contactType === 'email') {
    await sendOtpEmail(recipient, otp);
    logger.info('[sendOtp] email dispatched', { recipient });
  } else if (contactType === 'phone') {
    const message = buildMdtOtpMessage(otp);
    logger.info('[sendOtp] calling MDT SMS', {
      recipientHint: maskPhoneForLog(recipient),
      messageLen: message.length,
    });
    await sendMdtSms({ e164: recipient, message });
    logger.info('[sendOtp] MDT SMS call completed', {
      recipientHint: maskPhoneForLog(recipient),
    });
  }
}

async function resolveUserAfterOtp({ recipient, contactType }) {
  let userInfo;
  let isNewUser = false;

  if (contactType === 'phone') {
    userInfo = await repo.findUserByPhone(recipient);
    if (!userInfo) {
      const storedPhone = canonicalPhoneForStorage(recipient);
      const { row, isNewUser: created } = await repo.findOrInsertUserByPhone(
        {
          EntryDateTime: getISTTimestamp(),
          EntryUser: 'Wellness Valley',
          UserName: usernameFromPhone(recipient),
          Password: 'User@123#',
          TargetWeightInKg: 0,
          Status: 'Active',
          CoachApproved: 0,
          PhoneNumber: storedPhone,
        },
        recipient,
      );
      userInfo = row;
      isNewUser = created;
      if (created) {
        logger.info('[verify-otp] new phone user created', {
          phoneHint: maskPhoneForLog(recipient),
          storedPhoneHint: storedPhone.length >= 4 ? `***${storedPhone.slice(-4)}` : '****',
        });
      } else {
        logger.info('[verify-otp] concurrent-insert resolved: returning existing user', {
          userId: userInfo.UserId,
          phoneHint: maskPhoneForLog(recipient),
        });
      }
    } else {
      logger.info('[verify-otp] existing phone user authenticated', {
        userId: userInfo.UserId,
        phoneHint: maskPhoneForLog(recipient),
      });
    }
    return {
      isNewUser,
      user: {
        id: userInfo.UserId,
        username: userInfo.UserName,
        email: userInfo.Email || '',
        phone: userInfo.PhoneNumber || recipient,
        status: userInfo.Status,
      },
    };
  }

  userInfo = await repo.findUserByEmail(recipient);
  if (!userInfo) {
    userInfo = await repo.insertUser({
      EntryDateTime: getISTTimestamp(),
      EntryUser: 'Wellness Valley',
      UserName: recipient.split('@')[0],
      Password: 'User@123#',
      TargetWeightInKg: 0,
      Status: 'Active',
      CoachApproved: 0,
      Email: recipient,
    });
    isNewUser = true;
    logger.debug('🆕 [verify-otp] New user created:', recipient);
  }

  return {
    isNewUser,
    user: {
      id: userInfo.UserId,
      username: userInfo.UserName,
      email: userInfo.Email,
      status: userInfo.Status,
    },
  };
}

export async function sendOtp({ recipient, contactType }) {
  if (DEMO_ACCOUNTS.includes(recipient)) {
    return { httpStatus: 200, body: { success: true } };
  }

  if (contactType === 'phone') {
    const configGaps = getMdtSmsConfigGaps();
    if (configGaps.length > 0) {
      logger.warn('[sendOtp] MDT not fully configured on server', {
        route: 'send-otp',
        missing: configGaps,
        senderIdHint: mdtSenderIdHint(),
        templateIdHint: mdtTemplateIdHint(),
        apiKeyHint: mdtApiKeyHint(process.env.MDT_SMS_API_KEY),
      });
      return {
        httpStatus: 503,
        body: {
          success: false,
          message: `SMS service misconfigured: set ${configGaps.join(', ')} in backend env (local .env or Vercel).`,
          missingConfig: configGaps,
          senderIdHint: mdtSenderIdHint(),
          templateIdHint: mdtTemplateIdHint(),
          apiKeyHint: mdtApiKeyHint(process.env.MDT_SMS_API_KEY),
        },
      };
    }
  }

  if (contactType === 'email') {
    const smtpGaps = getSmtpConfigGaps();
    if (smtpGaps.length > 0) {
      logger.warn('[sendOtp] SMTP not fully configured on server', {
        route: 'send-otp',
        missing: smtpGaps,
        smtpUserHint: smtpUserHint(),
      });
      return {
        httpStatus: 503,
        body: {
          success: false,
          message: `Email service misconfigured: set ${smtpGaps.join(', ')} in backend env (local .env or Vercel).`,
          missingConfig: smtpGaps,
          smtpUserHint: smtpUserHint(),
        },
      };
    }
  }

  logger.info('[sendOtp] starting delivery', {
    contactType,
    recipientHint: contactType === 'phone' ? maskPhoneForLog(recipient) : recipient,
    delivery: contactType === 'phone' ? 'mdt-sms' : 'smtp',
    mdtSenderId: contactType === 'phone' ? process.env.MDT_SMS_SENDER_ID : undefined,
    mdtApiKeyHint: contactType === 'phone' ? mdtApiKeyHint(process.env.MDT_SMS_API_KEY) : undefined,
  });

  try {
    await createAndDeliverOtp({ recipient, contactType });
  } catch (err) {
    logger.warn('[sendOtp] delivery failed', { contactType, message: err.message });
    const mdtDetail = err.message?.startsWith('MDT SMS rejected:')
      ? err.message.replace('MDT SMS rejected: ', '')
      : '';
    const senderIdHint = mdtSenderIdHint();
    const templateIdHint = mdtTemplateIdHint();
    const apiKeyHint = mdtApiKeyHint(process.env.MDT_SMS_API_KEY);
    const isInvalidSender = /invalid senderid/i.test(mdtDetail) || mdtDetail.includes('code 003');
    let userMessage;
    if (contactType === 'email') {
      // Surface enough detail for operators to diagnose without exposing credentials.
      const isAuthError = /invalid login|authentication failed|535|534|Username and Password/i.test(err.message);
      const isConnError = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connect/i.test(err.message);
      if (isAuthError) {
        userMessage = 'Email service authentication failed. Check SMTP_USER / SMTP_PASS in backend env.';
      } else if (isConnError) {
        userMessage = 'Email service unreachable. Check network access to smtp.gmail.com from the server.';
      } else {
        userMessage = 'Failed to send verification email. Please try again.';
      }
    } else {
      userMessage = mdtDetail
        ? (
          isInvalidSender
            ? `SMS could not be sent: ${mdtDetail}. Ensure MDT_SMS_API_KEY, MDT_SMS_SENDER_ID, and MDT_SMS_TEMPLATE_ID all belong to the same Baleen/MDT account.`
            : `SMS could not be sent: ${mdtDetail}. Contact My Dreams Technology to fix sender ID.`
        )
        : 'Failed to send OTP. Please try again.';
    }
    logger.warn('[sendOtp] returning 502 to client', {
      contactType,
      userMessage,
      providerError: mdtDetail || err.message?.slice(0, 120),
      senderIdHint,
      templateIdHint,
      apiKeyHint,
      smtpUserHint: contactType === 'email' ? smtpUserHint() : undefined,
    });
    return {
      httpStatus: 502,
      body: {
        success: false,
        message: userMessage,
        ...(contactType === 'phone' && mdtDetail ? {
          providerError: mdtDetail,
          senderIdHint,
          templateIdHint,
          apiKeyHint,
        } : {}),
      },
    };
  }

  logger.info('[sendOtp] delivery succeeded', {
    contactType,
    recipientHint: contactType === 'phone' ? maskPhoneForLog(recipient) : recipient,
  });
  return { httpStatus: 200, body: { success: true } };
}

async function handleDemoVerify({ recipient, otp, purpose }) {
  const validDeleteOtp = purpose === 'delete' && otp === '654321';
  const validLoginOtp = purpose !== 'delete' && otp === '123456';
  if (!validDeleteOtp && !validLoginOtp) {
    return { httpStatus: 400, body: { success: false, message: 'Invalid OTP. Please try again.' } };
  }

  const existing = await repo.findUserByEmailLite(recipient);
  let userInfo;
  let isNewUser = false;

  if (existing) {
    userInfo = existing;
  } else {
    const currentTime = getISTTimestamp();
    userInfo = await repo.insertUser({
      EntryDateTime: currentTime,
      LastActiveAt: currentTime,
      EntryUser: 'Demo Account',
      UserName: 'testereasywork',
      Password: 'User@123#',
      TargetWeightInKg: 0,
      Status: 'Active',
      CoachApproved: 0,
      Email: recipient,
    });
    isNewUser = true;
    logger.debug('🆕 [verify-otp] Demo account created in DB:', recipient);
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'OTP verified successfully',
      isNewUser,
      user: {
        id: userInfo.UserId,
        username: userInfo.UserName,
        email: userInfo.Email,
        status: userInfo.Status,
      },
    },
  };
}

export async function verifyOtp(input) {
  const { recipient, otp, contactType, purpose } = input;

  if (DEMO_ACCOUNTS.includes(recipient)) {
    return handleDemoVerify({ recipient, otp, purpose });
  }

  const otpData = await repo.fetchActiveOtp(recipient, contactType);
  if (!otpData) {
    return { httpStatus: 404, body: { success: false, message: 'No active OTP found' } };
  }

  // Compare current IST time with stored expiry time (both in IST)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIST = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(otpData.ExpiresAt + 'Z');
  if (currentIST > expiresAt) {
    return { httpStatus: 400, body: { success: false, message: 'OTP expired' } };
  }

  const valid = await bcrypt.compare(otp, otpData.OTPHash);
  if (!valid) {
    return { httpStatus: 400, body: { success: false, message: 'Invalid OTP' } };
  }

  await repo.markOtpVerified(otpData.ID);

  const { isNewUser, user } = await resolveUserAfterOtp({ recipient, contactType });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'OTP verified successfully',
      isNewUser,
      user,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Firebase Phone Auth has been removed (no Firebase Admin SDK configured).
// Use MDT SMS-based OTP instead: /api/auth/send-otp + /api/auth/verify-otp
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns true if `recipient` has a verified OTP for `contactType` within the
 * past 15 minutes.  Called by the account-deletion endpoint to enforce that
 * the OTP flow was completed server-side before data destruction — preventing
 * unauthenticated DELETE calls from bypassing the OTP gate.
 */
export async function hasRecentlyVerifiedOtp(recipient, contactType = 'email') {
  const normalised = contactType === 'email'
    ? String(recipient).toLowerCase().trim()
    : String(recipient).trim();
  return repo.fetchRecentlyVerifiedOtp(normalised, contactType);
}
