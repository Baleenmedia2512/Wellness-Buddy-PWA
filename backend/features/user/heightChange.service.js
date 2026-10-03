/**
 * Profile height change — first set free on profile save.
 * Later changes email an approval code to the member's coach (CoachId).
 * The member enters that code. Uses otp_tokens_table — no new table.
 * Contact type `height-change` so a coach login OTP is not replaced.
 */
import bcrypt from 'bcryptjs';
import logger from '../../shared/lib/logger.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { generateEmailOtp } from '../auth/domain/otp-length.rules.js';
import * as authRepo from '../auth/auth.repository.js';
import * as userRepo from './user.repository.js';
import {
  HEIGHT_CHANGE_OTP_CONTACT_TYPE,
  HEIGHT_CHANGE_OTP_FLAG,
  HEIGHT_CHANGE_OTP_HOURS,
  isHeightLocked,
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
  const cols = '"UserId", "UserName", "Email", "PhoneNumber", "Height", "CoachId"';
  if (userId) {
    const row = await userRepo.findByUserId(userId, cols);
    if (row) return row;
  }
  if (email) {
    return userRepo.findByEmail(email, cols);
  }
  return null;
}

function heightOtpRecipientKey(userId) {
  return `height:${userId}`;
}

/**
 * Coach (team_table.CoachId) must have an email. The code is stored per member
 * so two members of the same coach do not cancel each other's approval.
 */
async function resolveCoachApprover(user) {
  const coachId = Number(user?.CoachId);
  if (!Number.isFinite(coachId) || coachId <= 0) {
    throw new ValidationError(
      400,
      'Link a coach before changing your height. Ask your wellness centre to connect you.',
    );
  }
  const coach = await userRepo.findByUserId(coachId, '"UserId", "UserName", "Email"');
  if (!coach) {
    throw new ValidationError(404, 'Your coach could not be found.');
  }
  const email = String(coach.Email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw new ValidationError(
      400,
      'Your coach has no email on file, so we cannot send the approval code.',
    );
  }
  const name = String(coach.UserName || '').replace(/[\r\n]/g, ' ').trim() || 'your coach';
  return { userId: coach.UserId, email, name };
}

async function verifyHeightChangeCode({ userId, otp }) {
  const code = String(otp || '').trim();
  const otpData = await authRepo.fetchActiveOtp(
    heightOtpRecipientKey(userId),
    HEIGHT_CHANGE_OTP_CONTACT_TYPE,
  );
  if (!otpData) {
    return { ok: false, message: 'No active approval code found. Ask your coach to check email, or send a new code.' };
  }
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIST = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(`${otpData.ExpiresAt}Z`);
  if (currentIST > expiresAt) {
    return { ok: false, message: 'Approval code expired. Send a new one to your coach.' };
  }
  const valid = await bcrypt.compare(code, otpData.OTPHash);
  if (!valid) {
    return { ok: false, message: 'Invalid approval code' };
  }
  await authRepo.markOtpVerified(otpData.ID);
  return { ok: true };
}

/**
 * Email the member's coach a code so a locked height can change.
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
      'Your height is not locked yet. Save it once from Profile, then your coach approves later changes.',
    );
  }

  if (!heightsWouldChange(user.Height, check.value)) {
    throw new ValidationError(400, 'Enter a different height to request coach approval.');
  }

  const coach = await resolveCoachApprover(user);
  await deliverCoachHeightOtp({
    memberUserId: user.UserId,
    coachEmail: coach.email,
    memberName: user.UserName,
    currentHeightCm: parseHeightCm(user.Height),
    newHeightCm: check.value,
  });

  logger.info('[height-change] coach approval email sent', {
    userId: user.UserId,
    coachUserId: coach.userId,
    newHeight: check.value,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: `We sent an approval code to your coach (${coach.name}). Ask them for the code to update your height.`,
      contactType: 'email',
      destination: coach.name,
      destinationMasked: coach.name,
      approverName: coach.name,
      height: check.value,
      currentHeight: parseHeightCm(user.Height),
      expiresInSeconds: HEIGHT_CHANGE_OTP_HOURS * 60 * 60,
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

async function deliverCoachHeightOtp({
  memberUserId,
  coachEmail,
  memberName,
  currentHeightCm,
  newHeightCm,
}) {
  const recipientKey = heightOtpRecipientKey(memberUserId);
  await authRepo.deactivateActiveOtps(recipientKey, HEIGHT_CHANGE_OTP_CONTACT_TYPE);
  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  await authRepo.insertOtpToken({
    Recipient: recipientKey,
    OTPHash: otpHash,
    ExpiresAt: otpExpiryIst(HEIGHT_CHANGE_OTP_HOURS * 60),
    ContactType: HEIGHT_CHANGE_OTP_CONTACT_TYPE,
    IsActive: true,
    CreatedAt: nowUtc(),
  });
  const mail = buildHeightChangeOtpEmail({
    otp,
    memberName,
    currentHeightCm,
    newHeightCm,
    expiresHours: HEIGHT_CHANGE_OTP_HOURS,
  });
  await sendTransactionalMail({
    to: coachEmail,
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
 * Coach shared the approval code. Apply the new height.
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

  const codeResult = await verifyHeightChangeCode({ userId: user.UserId, otp });
  if (!codeResult.ok) {
    throw new ValidationError(400, codeResult.message || 'Invalid or expired code. Try again.');
  }

  await userRepo.updateUserById(user.UserId, { Height: check.value });
  clearProfileCache({ email: user.Email || email, userId: user.UserId });

  logger.info('[height-change] height updated after coach approval', {
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
