/**
 * Task by Coach — request / verify coach email OTP, then persist habit.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { sendTransactionalMail } from '../../../shared/lib/smtp-mail.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import logger from '../../../shared/lib/logger.js';
import { generateEmailOtp, isValidEmailOtp } from '../../auth/domain/otp-length.rules.js';
import * as authRepo from '../../auth/auth.repository.js';
import { findByUserId } from '../../user/user.repository.js';
import { maskEmailForDisplay } from '../../user/domain/heightChange.rules.js';
import {
  GOOD_HABIT_OTP_CONTACT_TYPE,
  goodHabitOtpExpiryIst,
  goodHabitOtpExpiryLabelIst,
  goodHabitOtpExpiryUtcIso,
  goodHabitOtpRecipientKey,
} from '../domain/otp.rules.js';
import {
  buildGoodHabitOtpEmail,
  buildGoodHabitPhotoAttachment,
} from '../domain/otpEmail.rules.js';
import * as pendingRepo from '../data/pending.repo.js';
import { validateSaveHabit } from '../validation/save.schema.js';
import { saveHabit } from './save.handler.js';
import { deleteById as deleteCaptureById } from '../../captures/captures.service.js';

function featureDisabled() {
  throw new ValidationError(404, 'Task by Coach is not enabled');
}

async function resolveMemberCoachApprover(member) {
  const coachId = Number(member?.CoachId);
  if (!Number.isFinite(coachId) || coachId <= 0) {
    throw new ValidationError(
      400,
      'Link a coach before logging Task by Coach. Your coach must verify the photo with an email OTP.',
    );
  }
  const coach = await findByUserId(coachId, '"UserId", "UserName", "Email"');
  if (!coach) {
    throw new ValidationError(404, 'Your coach could not be found.');
  }
  const email = String(coach.Email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw new ValidationError(
      400,
      'Your coach has no email on file, so we cannot send the verification OTP.',
    );
  }
  const name = String(coach.UserName || '').replace(/[\r\n]/g, ' ').trim() || 'your coach';
  return { userId: coach.UserId, email, name };
}

async function verifyCoachOtpCode(userId, otpKey, otp) {
  const code = String(otp || '').trim();
  if (!isValidEmailOtp(code)) {
    return { ok: false, message: 'Enter the 4-digit OTP from your coach email' };
  }
  const recipient = goodHabitOtpRecipientKey(userId, otpKey);
  const otpData = await authRepo.fetchActiveOtp(recipient, GOOD_HABIT_OTP_CONTACT_TYPE);
  if (!otpData) {
    return { ok: false, message: 'No active code found. Tap Save again to email your coach.' };
  }
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIST = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(`${otpData.ExpiresAt}Z`);
  if (currentIST > expiresAt) {
    return { ok: false, message: 'OTP expired. Tap Save again to email your coach.' };
  }
  const valid = await bcrypt.compare(code, otpData.OTPHash);
  if (!valid) {
    return { ok: false, message: 'Invalid OTP. Ask your coach for the code and try again.' };
  }
  await authRepo.markOtpVerified(otpData.ID);
  return { ok: true };
}

/**
 * Step 1: store pending habit + email OTP + photo to the member's coach.
 */
export async function requestGoodHabitOtp(rawBody) {
  if (!isEnabled('ff.good-habit')) featureDisabled();
  const input = validateSaveHabit(rawBody);
  const member = await findByUserId(
    input.userId,
    '"UserId", "UserName", "Email", "PhoneNumber", "CoachId"',
  );
  if (!member) {
    throw new ValidationError(404, 'Account not found');
  }
  const coach = await resolveMemberCoachApprover(member);

  const otpKey = crypto.randomBytes(12).toString('hex');
  const expiresAtUtcIso = goodHabitOtpExpiryUtcIso();
  const expiresAtIst = goodHabitOtpExpiryIst();
  const expiresLabel = goodHabitOtpExpiryLabelIst();
  await pendingRepo.upsertPending({
    otpKey,
    userId: input.userId,
    payload: {
      userId: input.userId,
      habitType: input.habitType,
      notes: input.notes,
      imageBase64: input.imageBase64,
      beforeImageBase64: input.beforeImageBase64,
      afterImageBase64: input.afterImageBase64,
      captureId: input.captureId,
      // Business day = verify time (IST), not gallery capture time.
      clientTimestamp: null,
    },
    expiresAtUtcIso,
  });

  const recipient = goodHabitOtpRecipientKey(input.userId, otpKey);
  await authRepo.deactivateActiveOtps(recipient, GOOD_HABIT_OTP_CONTACT_TYPE);
  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  await authRepo.insertOtpToken({
    Recipient: recipient,
    OTPHash: otpHash,
    ExpiresAt: expiresAtIst,
    ContactType: GOOD_HABIT_OTP_CONTACT_TYPE,
    IsActive: true,
    CreatedAt: nowUtc(),
  });

  const mail = buildGoodHabitOtpEmail({
    otp,
    memberName: member.UserName,
    memberPhone: member.PhoneNumber,
    coachName: coach.name,
    expiresLabel,
  });
  const photo = buildGoodHabitPhotoAttachment(
    input.imageBase64 || input.afterImageBase64 || input.beforeImageBase64,
  );
  await sendTransactionalMail({
    to: coach.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: photo ? [photo] : [],
  });

  logger.info('[good-habits] coach OTP emailed', {
    userId: String(input.userId),
    coachUserId: coach.userId,
    otpKey,
    expiresAtIst,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        otpSent: true,
        otpRequired: true,
        otpKey,
        maskedEmail: maskEmailForDisplay(coach.email),
        coachName: coach.name,
        // End of IST day (not a fixed minute TTL). Kept for older clients that ignore unknown fields.
        otpExpiresAtIst: expiresAtIst,
        otpExpiresLabel: expiresLabel,
      },
    },
  };
}

/**
 * Step 2: verify coach OTP → insert habit (CreatedAt = now IST).
 */
export async function verifyGoodHabitOtp({ userId: rawUserId, otp, otpKey }) {
  if (!isEnabled('ff.good-habit')) featureDisabled();
  const userId = String(rawUserId || '').trim();
  if (!userId) {
    throw new ValidationError(400, 'userId is required');
  }
  const key = String(otpKey || '').trim();
  if (!key) {
    throw new ValidationError(400, 'otpKey is required');
  }

  const codeResult = await verifyCoachOtpCode(userId, key, otp);
  if (!codeResult.ok) {
    throw new ValidationError(400, codeResult.message || 'Invalid or expired OTP');
  }

  const payload = await pendingRepo.takePending(key, userId);
  if (!payload) {
    throw new ValidationError(
      400,
      'This verification expired. Tap Save again to email your coach a new code.',
    );
  }

  const result = await saveHabit({
    ...payload,
    userId,
    clientTimestamp: null,
    useServerNow: true,
  });

  if (payload.captureId) {
    try {
      await deleteCaptureById({
        captureId: payload.captureId,
        userId,
      });
    } catch (err) {
      logger.warn('good-habits.verify: failed to discard original capture', {
        captureId: payload.captureId,
        err: err?.message || String(err),
      });
    }
  }

  return result;
}
