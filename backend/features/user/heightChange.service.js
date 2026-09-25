/**
 * Profile height change — first set free on profile save; later changes need OTP.
 *
 * OTP is emailed to the account email (or SMS to phone when no email).
 * Uses otp_tokens_table via auth helpers — no new table.
 */
import bcrypt from 'bcryptjs';
import logger from '../../shared/lib/logger.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { sendOtp, verifyEmailOwnershipOtp } from '../auth/auth.service.js';
import { generateEmailOtp } from '../auth/domain/otp-length.rules.js';
import * as authRepo from '../auth/auth.repository.js';
import * as userRepo from './user.repository.js';
import {
  HEIGHT_CHANGE_OTP_FLAG,
  isHeightLocked,
  maskEmailForDisplay,
  maskPhoneForDisplay,
  parseHeightCm,
  validateHeightCm,
} from './domain/heightChange.rules.js';
import { buildHeightChangeOtpEmail } from './domain/heightChangeOtpEmail.rules.js';

function featureDisabled() {
  throw new ValidationError(404, 'Height change verification is not available.');
}

function clearProfileCache({ email, userId }) {
  if (email) {
    try { cache.delete(cacheKeys.userProfile(String(email).toLowerCase())); } catch { /* non-fatal */ }
  }
  if (userId != null) {
    try { cache.delete(cacheKeys.userProfile(`id:${userId}`)); } catch { /* non-fatal */ }
  }
}

async function loadUser({ email, userId }) {
  const cols = '"UserId", "UserName", "Email", "PhoneNumber", "Height"';
  if (userId) {
    const row = await userRepo.findByUserId(userId, cols);
    if (row) return row;
  }
  if (email) {
    return userRepo.findByEmail(email, cols);
  }
  return null;
}

function resolveOtpDestination(user) {
  const email = String(user?.Email || '').trim().toLowerCase();
  if (email.includes('@')) {
    return { contactType: 'email', recipient: email, masked: maskEmailForDisplay(email) };
  }
  const phone = String(user?.PhoneNumber || '').trim();
  if (phone && /^\+?[0-9]{10,15}$/.test(phone.replace(/[\s\-()]/g, ''))) {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    return { contactType: 'phone', recipient: cleaned, masked: maskPhoneForDisplay(cleaned) };
  }
  return null;
}

/**
 * Prove phone ownership without logging in (mirrors verifyEmailOwnershipOtp).
 * Does not modify auth.service — local to height change.
 */
async function verifyPhoneOwnershipOtp({ recipient, otp }) {
  const phone = String(recipient || '').trim();
  const code = String(otp || '').trim();
  const otpData = await authRepo.fetchActiveOtp(phone, 'phone');
  if (!otpData) {
    return { ok: false, message: 'No active OTP found' };
  }
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIST = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(`${otpData.ExpiresAt}Z`);
  if (currentIST > expiresAt) {
    return { ok: false, message: 'OTP expired' };
  }
  const valid = await bcrypt.compare(code, otpData.OTPHash);
  if (!valid) {
    return { ok: false, message: 'Invalid OTP' };
  }
  await authRepo.markOtpVerified(otpData.ID);
  return { ok: true };
}

/**
 * Send a 5-minute code so the member can change a locked height.
 * @param {{ email?: string|null, userId?: number|null, height: number }} input
 */
export async function requestHeightChangeOtp({ email = null, userId = null, height }) {
  if (!isEnabled(HEIGHT_CHANGE_OTP_FLAG)) featureDisabled();

  const check = validateHeightCm(height);
  if (!check.valid) throw new ValidationError(400, check.message);

  const user = await loadUser({ email, userId });
  if (!user) throw new ValidationError(404, 'User not found');

  if (!isHeightLocked(user.Height)) {
    throw new ValidationError(
      400,
      'Your height is not locked yet. Save it once from Profile, then use OTP only to change it.',
    );
  }

  if (!heightsWouldChange(user.Height, check.value)) {
    throw new ValidationError(400, 'Enter a different height to request a change code.');
  }

  const dest = resolveOtpDestination(user);
  if (!dest) {
    throw new ValidationError(
      400,
      'Verify an email on Profile (or add a phone) before changing height.',
    );
  }

  if (dest.contactType === 'email') {
    await deliverEmailHeightOtp(dest.recipient, check.value);
  } else {
    const sent = await sendOtp({ recipient: dest.recipient, contactType: 'phone' });
    if (sent?.httpStatus && sent.httpStatus >= 400) {
      const msg = sent?.body?.message || 'Could not send the verification code. Try again.';
      throw new ValidationError(sent.httpStatus, msg);
    }
    if (sent?.body?.success === false) {
      throw new ValidationError(400, sent.body.message || 'Could not send the verification code.');
    }
  }

  logger.info('[height-change] OTP sent', {
    userId: user.UserId,
    contactType: dest.contactType,
    newHeight: check.value,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: `We sent a 4-digit code to ${dest.masked}.`,
      contactType: dest.contactType,
      destinationMasked: dest.masked,
      height: check.value,
      expiresInSeconds: 300,
    },
  };
}

/** Same ExpiresAt encoding as auth createAndDeliverOtp (IST wall clock string). */
function otpExpiryIst(minutesFromNow) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + istOffset + minutesFromNow * 60 * 1000);
  return expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

async function deliverEmailHeightOtp(recipient, heightCm) {
  await authRepo.deactivateActiveOtps(recipient, 'email');
  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  await authRepo.insertOtpToken({
    Recipient: recipient,
    OTPHash: otpHash,
    ExpiresAt: otpExpiryIst(5),
    ContactType: 'email',
    IsActive: true,
    CreatedAt: nowUtc(),
  });
  const mail = buildHeightChangeOtpEmail({ otp, newHeightCm: heightCm, expiresMinutes: 5 });
  await sendTransactionalMail({
    to: recipient,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

function heightsWouldChange(existing, next) {
  const left = parseHeightCm(existing);
  const right = parseHeightCm(next);
  if (left == null || right == null) return left !== right;
  return Math.abs(left - right) > 0.01;
}

/**
 * Verify OTP and apply the new height.
 * @param {{ email?: string|null, userId?: number|null, height: number, otp: string }} input
 */
export async function verifyHeightChangeOtp({
  email = null,
  userId = null,
  height,
  otp,
}) {
  if (!isEnabled(HEIGHT_CHANGE_OTP_FLAG)) featureDisabled();

  const check = validateHeightCm(height);
  if (!check.valid) throw new ValidationError(400, check.message);

  const user = await loadUser({ email, userId });
  if (!user) throw new ValidationError(404, 'User not found');

  if (!isHeightLocked(user.Height)) {
    throw new ValidationError(
      400,
      'Your height is not locked yet. Save it once from Profile first.',
    );
  }

  const dest = resolveOtpDestination(user);
  if (!dest) {
    throw new ValidationError(
      400,
      'Verify an email on Profile (or add a phone) before changing height.',
    );
  }

  if (dest.contactType === 'email') {
    const otpResult = await verifyEmailOwnershipOtp({
      recipient: dest.recipient,
      otp,
    });
    if (!otpResult?.body?.success) {
      throw new ValidationError(
        otpResult?.httpStatus || 400,
        otpResult?.body?.message || 'Invalid or expired code. Try again.',
      );
    }
  } else {
    const phoneResult = await verifyPhoneOwnershipOtp({
      recipient: dest.recipient,
      otp,
    });
    if (!phoneResult.ok) {
      throw new ValidationError(400, phoneResult.message || 'Invalid or expired code. Try again.');
    }
  }

  await userRepo.updateUserById(user.UserId, { Height: check.value });
  clearProfileCache({ email: user.Email || email, userId: user.UserId });

  logger.info('[height-change] height updated after OTP', {
    userId: user.UserId,
    height: check.value,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Height updated.',
      height: check.value,
    },
  };
}
