import bcrypt from 'bcryptjs';
import * as repo from './auth.repository.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import { buildSignInOtpEmail } from './domain/otp-email.rules.js';
import { generateOtpForContactType } from './domain/otp-length.rules.js';
import logger from '../../shared/lib/logger.js';
import { isValidPhoneE164, usernameFromPhone } from './domain/contactIdentifier.js';
import { canonicalPhoneForStorage } from './domain/phone-identity.rules.js';
import { MDT_OTP_EXPIRY_MINUTES, getMdtSmsConfigGaps, maskPhoneForLog, mdtApiKeyHint, mdtSenderIdHint, mdtTemplateIdHint } from './domain/mdt-phone.rules.js';
import { buildMdtOtpMessage } from './domain/otp-message.rules.js';
import { sendMdtSms } from './data/mdt-sms.client.js';

import { nowUtc } from '../../shared/lib/datetime/index.js';
import { syncUserTimezoneIfChanged } from '../user/timezone-sync.service.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import {
  consentInsertFields,
  CURRENT_CONSENT_VERSION,
  isConsentRecorded,
  shouldStampSignupConsent,
} from './domain/consent.rules.js';
import {
  DEMO_PHONE_DISPLAY_NAME,
  demoPhoneForStorage,
  isDemoRecipient,
  isValidDemoDeleteOtp,
  isValidDemoLoginOtp,
} from './domain/demo-account.rules.js';

function consentGateOn() {
  return isEnabled('ff.consent-gate');
}

/**
 * Record the signup checkbox on the account when this request includes a valid acceptance.
 * Older apps omit the fields, so their accounts stay unconsented and keep the post-login form.
 */
async function stampAcceptedConsent(userInfo, input) {
  if (!userInfo?.UserId) return userInfo;
  if (!shouldStampSignupConsent(userInfo, input, consentGateOn())) return userInfo;
  const fields = consentInsertFields(nowUtc(), {
    version: input.consentVersion,
    ipAddress: input.ipAddress || null,
    deviceInfo: input.deviceInfo || null,
  });
  try {
    await repo.updateUserConsent(userInfo.UserId, fields);
  } catch (err) {
    logger.warn('[verify-otp] could not record signup consent', {
      userId: userInfo.UserId,
      message: err?.message,
    });
    return userInfo;
  }
  return { ...userInfo, ...fields };
}

function toAuthUserPayload(userInfo, { phone, consentGate } = {}) {
  const consentRequired = consentGate === true && !isConsentRecorded(userInfo);
  return {
    id: userInfo.UserId,
    username: userInfo.UserName,
    email: userInfo.Email || '',
    phone: userInfo.PhoneNumber || phone || '',
    status: userInfo.Status,
    role: userInfo.Role || 'user',
    consentRequired,
  };
}

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

async function sendOtpEmail(recipient, otp) {
  const mail = buildSignInOtpEmail(otp, { expiresMinutes: 5 });
  await sendTransactionalMail({
    to: recipient,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
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

  const otp = generateOtpForContactType(contactType);
  const otpHash = await bcrypt.hash(otp, 10);
  const expiryMinutes = contactType === 'phone' ? MDT_OTP_EXPIRY_MINUTES : 5;

  await repo.insertOtpToken({
    Recipient: recipient,
    OTPHash: otpHash,
    ExpiresAt: otpExpiryIst(expiryMinutes),
    ContactType: contactType,
    IsActive: true,
    CreatedAt: nowUtc(),
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

/**
 * Identify (create/find) the user on OTP.
 * New app sends signup checkbox acceptance on this request and it is stored here.
 * Older apps omit it — those accounts stay unconsented until POST /api/user/consent.
 */
async function resolveUserAfterOtp({ recipient, contactType, consentInput }) {
  const gate = consentGateOn();
  let userInfo;
  let isNewUser = false;

  if (contactType === 'phone') {
    userInfo = await repo.findUserByPhone(recipient);
    if (!userInfo) {
      const storedPhone = canonicalPhoneForStorage(recipient);
      const createdAt = nowUtc();
      const { row, isNewUser: created } = await repo.findOrInsertUserByPhone(
        {
          EntryDateTime: createdAt,
          EntryUser: 'Wellness Valley',
          UserName: usernameFromPhone(recipient),
          Password: 'User@123#',
          TargetWeightInKg: 0,
          Status: 'Active',
          CoachApproved: 0,
          Role: 'user',
          PhoneNumber: storedPhone,
        },
        recipient,
      );
      userInfo = row;
      isNewUser = created;
      if (created) {
        logger.info('[verify-otp] new phone user created (consent pending)', {
          phoneHint: maskPhoneForLog(recipient),
          storedPhoneHint: storedPhone.length >= 4 ? `***${storedPhone.slice(-4)}` : '****',
          userId: userInfo.UserId,
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
    userInfo = await stampAcceptedConsent(userInfo, consentInput);
    return {
      isNewUser,
      user: toAuthUserPayload(userInfo, { phone: recipient, consentGate: gate }),
    };
  }

  userInfo = await repo.findUserByEmail(recipient);
  if (!userInfo) {
    const createdAt = nowUtc();
    userInfo = await repo.insertUser({
      EntryDateTime: createdAt,
      EntryUser: 'Wellness Valley',
      UserName: recipient.split('@')[0],
      Password: 'User@123#',
      TargetWeightInKg: 0,
      Status: 'Active',
      CoachApproved: 0,
      Role: 'user',
      Email: recipient,
    });
    isNewUser = true;
    logger.debug('🆕 [verify-otp] New user created (consent pending):', recipient);
  }

  userInfo = await stampAcceptedConsent(userInfo, consentInput);
  return {
    isNewUser,
    user: toAuthUserPayload(userInfo, { consentGate: gate }),
  };
}

export async function sendOtp({ recipient, contactType }) {
  // Demo / Cashfree review: succeed without SMS or email delivery.
  if (isDemoRecipient(recipient, contactType)) {
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

/**
 * Keep Cashfree / demo phone accounts ready for main-app access:
 * Role=user (not admin), setup skipped, coach approved, consent stamped.
 */
async function ensureDemoPhoneAccess(userInfo) {
  if (!userInfo?.UserId) return userInfo;
  const patch = {};
  if (userInfo.SetupSkipped !== true) patch.SetupSkipped = true;
  if (Number(userInfo.CoachApproved) !== 1) patch.CoachApproved = 1;
  if (String(userInfo.Role || '').toLowerCase() === 'admin') patch.Role = 'user';
  if (!isConsentRecorded(userInfo)) {
    Object.assign(patch, consentInsertFields(nowUtc(), { version: CURRENT_CONSENT_VERSION }));
  }
  if (Object.keys(patch).length === 0) return userInfo;
  await repo.updateUserConsent(userInfo.UserId, patch);
  return { ...userInfo, ...patch };
}

async function handleDemoVerify({ recipient, otp, purpose, consentInput, contactType }) {
  const validDeleteOtp = purpose === 'delete' && isValidDemoDeleteOtp(otp);
  const validLoginOtp = purpose !== 'delete' && isValidDemoLoginOtp(otp);
  if (!validDeleteOtp && !validLoginOtp) {
    return { httpStatus: 400, body: { success: false, message: 'Invalid OTP. Please try again.' } };
  }

  const gate = consentGateOn();
  const isPhoneDemo = contactType === 'phone' || (contactType !== 'email' && isDemoRecipient(recipient, 'phone'));
  let userInfo;
  let isNewUser = false;

  if (isPhoneDemo) {
    const existing = await repo.findUserByPhone(recipient);
    if (existing) {
      userInfo = await ensureDemoPhoneAccess(existing);
    } else {
      const currentTime = nowUtc();
      const storedPhone = demoPhoneForStorage();
      const { row, isNewUser: created } = await repo.findOrInsertUserByPhone(
        {
          EntryDateTime: currentTime,
          LastActiveAt: currentTime,
          EntryUser: 'Cashfree Demo',
          UserName: DEMO_PHONE_DISPLAY_NAME,
          Password: 'User@123#',
          TargetWeightInKg: 0,
          Status: 'Active',
          CoachApproved: 1,
          Role: 'user',
          PhoneNumber: storedPhone,
          SetupSkipped: true,
          ...consentInsertFields(currentTime, { version: CURRENT_CONSENT_VERSION }),
        },
        recipient,
      );
      userInfo = created ? row : await ensureDemoPhoneAccess(row);
      isNewUser = created;
      logger.debug('🆕 [verify-otp] Cashfree demo phone account ready', {
        userId: userInfo?.UserId,
        created,
      });
    }
  } else {
    const existing = await repo.findUserByEmail(recipient);
    if (existing) {
      userInfo = existing;
    } else {
      const currentTime = nowUtc();
      userInfo = await repo.insertUser({
        EntryDateTime: currentTime,
        LastActiveAt: currentTime,
        EntryUser: 'Demo Account',
        UserName: 'testereasywork',
        Password: 'User@123#',
        TargetWeightInKg: 0,
        Status: 'Active',
        CoachApproved: 0,
        Role: 'user',
        Email: recipient,
      });
      isNewUser = true;
      logger.debug('🆕 [verify-otp] Demo account created in DB (consent pending):', recipient);
    }
  }

  userInfo = await stampAcceptedConsent(userInfo, consentInput);

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'OTP verified successfully',
      isNewUser,
      user: toAuthUserPayload(userInfo, {
        phone: isPhoneDemo ? recipient : undefined,
        consentGate: gate,
      }),
    },
  };
}

export async function verifyOtp(input) {
  const { recipient, otp, contactType, purpose } = input;

  if (isDemoRecipient(recipient, contactType)) {
    const result = await handleDemoVerify({
      recipient, otp, purpose, consentInput: input, contactType,
    });
    if (result.httpStatus === 200 && result.body?.user?.id) {
      await syncUserTimezoneIfChanged(result.body.user.id, input.timezoneIana);
    }
    return result;
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

  const resolved = await resolveUserAfterOtp({
    recipient,
    contactType,
    consentInput: input,
  });
  const { isNewUser, user } = resolved;

  await syncUserTimezoneIfChanged(user.id, input.timezoneIana);

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

/**
 * Prove inbox ownership without logging in as that email (no user create/switch).
 * Used during phone onboarding so a celebrity/govt address cannot be claimed
 * without the OTP that was mailed to it. Email OTPs expire in 5 minutes.
 */
export async function verifyEmailOwnershipOtp({ recipient, otp }) {
  const email = String(recipient || '').trim().toLowerCase();
  const code = String(otp || '').trim();

  if (isDemoRecipient(email, 'email')) {
    if (!isValidDemoLoginOtp(code)) {
      return { httpStatus: 400, body: { success: false, message: 'Invalid OTP. Please try again.' } };
    }
    return { httpStatus: 200, body: { success: true, verified: true } };
  }

  const otpData = await repo.fetchActiveOtp(email, 'email');
  if (!otpData) {
    return { httpStatus: 404, body: { success: false, message: 'No active OTP found' } };
  }

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIST = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(otpData.ExpiresAt + 'Z');
  if (currentIST > expiresAt) {
    return { httpStatus: 400, body: { success: false, message: 'OTP expired' } };
  }

  const valid = await bcrypt.compare(code, otpData.OTPHash);
  if (!valid) {
    return { httpStatus: 400, body: { success: false, message: 'Invalid OTP' } };
  }

  await repo.markOtpVerified(otpData.ID);
  return { httpStatus: 200, body: { success: true, verified: true } };
}
