/**
 * Unified profile-change sponsor OTP — one coach code for all gated field
 * changes on Save (ADR-0018). First fill stays free on profile POST.
 */
import bcrypt from 'bcryptjs';
import logger from '../../shared/lib/logger.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { generateEmailOtp } from '../auth/domain/otp-length.rules.js';
import * as userRepo from './user.repository.js';
import * as profileChangeRepo from './profileChange.repository.js';
import { clearUserProfileCache } from './profileCache.js';
import {
  PROFILE_CHANGE_OTP_BCRYPT_COST,
  PROFILE_CHANGE_OTP_FLAG,
  PROFILE_CHANGE_OTP_HOURS,
  PROFILE_CHANGE_OTP_MAX_ATTEMPTS,
  PROFILE_CHANGE_STATUS_PENDING,
  classifyProfileGatedChanges,
  existingSnapshotFromUser,
  extractGatedIncoming,
  isProfileChangeOtpExpired,
  isUnifiedProfileChangeOtpActive,
  labelsForChangedKeys,
  maskEmailForDisplay,
} from './domain/profileChange.rules.js';
import { buildProfileChangeOtpEmail } from './domain/profileChangeOtpEmail.rules.js';

function featureDisabled() {
  throw new ValidationError(404, 'Profile change verification is not available.');
}

async function loadUser({ email, userId }) {
  const cols = [
    '"UserId"',
    '"UserName"',
    '"Email"',
    '"PhoneNumber"',
    '"Height"',
    '"CoachId"',
    '"CommunityId"',
    '"EventLevel"',
    '"EventTranslation"',
    '"ProfileImage"',
    'AvatarKey',
    'recovered_health_issues',
  ].join(', ');
  if (userId) {
    const row = await userRepo.findByUserId(userId, cols);
    if (row) return row;
  }
  if (email) {
    return userRepo.findByEmail(email, cols);
  }
  return null;
}

async function resolveCoachApprover(user) {
  const coachId = Number(user?.CoachId);
  if (!Number.isFinite(coachId) || coachId <= 0) {
    throw new ValidationError(
      400,
      'Link a coach before changing these profile fields. Ask your wellness centre to connect you.',
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

function otpExpiryUtc(hoursFromNow) {
  const ms = Number(hoursFromNow) * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function buildPendingPatch(changes) {
  const patch = { ...changes };
  const intro = {};
  for (const key of ['professionalTitle', 'herbalifeJoinedOn', 'aboutMe', 'qualification']) {
    if (patch[key] !== undefined) {
      intro[key] = patch[key];
      delete patch[key];
    }
  }
  if (Object.keys(intro).length > 0) {
    patch.profileIntro = intro;
  }
  // Email ownership stays on KYC; do not apply email via updateProfile.
  delete patch.email;
  return patch;
}

/**
 * Email the member's coach one code covering all gated field changes.
 * @param {{
 *   email?: string|null,
 *   userId?: number|null,
 *   pendingProfile?: object,
 *   appVersion?: string|null,
 * }} input
 */
export async function requestProfileChangeOtp(input = {}) {
  if (!isEnabled(PROFILE_CHANGE_OTP_FLAG)) featureDisabled();

  const {
    email = null,
    userId = null,
    pendingProfile = {},
    appVersion = null,
  } = input;

  if (!isUnifiedProfileChangeOtpActive({
    flagEnabled: true,
    appVersion,
  })) {
    throw new ValidationError(
      400,
      'Update the app to request a single profile approval code.',
    );
  }

  const user = await loadUser({ email, userId });
  if (!user) throw new ValidationError(404, 'User not found');

  let profileIntro = {};
  try {
    profileIntro = await userRepo.getProfileIntro(user.UserId);
  } catch {
    profileIntro = {};
  }

  const existing = existingSnapshotFromUser(user, {
    profileIntro,
    hasProfileImage: Boolean(user.ProfileImage || user.AvatarKey),
  });
  const incoming = extractGatedIncoming(pendingProfile);
  const classified = classifyProfileGatedChanges({ existing, incoming });

  if (!classified.needsOtp) {
    throw new ValidationError(
      400,
      'No locked profile fields changed. Save your profile without an approval code.',
    );
  }

  const coach = await resolveCoachApprover(user);
  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, PROFILE_CHANGE_OTP_BCRYPT_COST);
  const expiresAt = otpExpiryUtc(PROFILE_CHANGE_OTP_HOURS);
  const pendingPatch = buildPendingPatch(classified.changes);

  await profileChangeRepo.cancelPendingByRequesterId(user.UserId);
  await profileChangeRepo.insertRequest({
    RequesterId: user.UserId,
    ApproverId: coach.userId,
    PendingPayload: pendingPatch,
    ChangedKeys: classified.changedKeys,
    OtpHash: otpHash,
    OtpExpiresAt: expiresAt,
    OtpSentAt: nowUtc(),
    OtpAttempts: 0,
    Status: PROFILE_CHANGE_STATUS_PENDING,
    RequestedAt: nowUtc(),
  });

  const mail = buildProfileChangeOtpEmail({
    otp,
    memberName: user.UserName,
    memberPhone: user.PhoneNumber,
    changedKeys: classified.changedKeys,
    expiresHours: PROFILE_CHANGE_OTP_HOURS,
  });

  try {
    await sendTransactionalMail({
      to: coach.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (error) {
    logger.warn('[profile-change] sponsor OTP email failed', {
      userId: user.UserId,
      coachUserId: coach.userId,
      message: String(error?.message || error || ''),
    });
    throw new ValidationError(502, 'Could not email the approval code to your coach. Please try again.');
  }

  logger.info('[profile-change] coach approval email sent', {
    userId: user.UserId,
    coachUserId: coach.userId,
    changedKeys: classified.changedKeys,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: `We sent one approval code to your coach (${coach.name}). Ask them for the code to save your changes.`,
      contactType: 'email',
      destination: coach.name,
      destinationMasked: coach.name,
      approverName: coach.name,
      approverEmailMasked: maskEmailForDisplay(coach.email),
      changedFields: labelsForChangedKeys(classified.changedKeys),
      changedKeys: classified.changedKeys,
      expiresInSeconds: PROFILE_CHANGE_OTP_HOURS * 60 * 60,
      needsOtp: true,
    },
  };
}

/**
 * Verify the single coach code and apply all pending gated changes.
 */
export async function verifyProfileChangeOtp({
  email = null,
  userId = null,
  otp,
  appVersion = null,
} = {}) {
  if (!isEnabled(PROFILE_CHANGE_OTP_FLAG)) featureDisabled();

  const user = await loadUser({ email, userId });
  if (!user) throw new ValidationError(404, 'User not found');

  const pending = await profileChangeRepo.findPendingByRequesterId(user.UserId);
  if (!pending) {
    throw new ValidationError(400, 'No active approval code. Save again to send a new code.');
  }

  if (isProfileChangeOtpExpired(pending.OtpExpiresAt)) {
    await profileChangeRepo.markExpired(pending.Id);
    throw new ValidationError(400, 'Approval code expired. Save again to send a new code.');
  }

  const attempts = Number(pending.OtpAttempts) || 0;
  if (attempts >= PROFILE_CHANGE_OTP_MAX_ATTEMPTS) {
    await profileChangeRepo.markExpired(pending.Id);
    throw new ValidationError(400, 'Too many attempts. Save again to send a new code.');
  }

  const code = String(otp || '').trim();
  const valid = await bcrypt.compare(code, pending.OtpHash);
  if (!valid) {
    await profileChangeRepo.incrementOtpAttempts(pending.Id, attempts + 1);
    throw new ValidationError(400, 'That approval code did not match.');
  }

  const patch = pending.PendingPayload && typeof pending.PendingPayload === 'object'
    ? pending.PendingPayload
    : {};

  // Dynamic import avoids a circular dependency with profile.service.
  const { updateProfile } = await import('./profile.service.js');
  const result = await updateProfile({
    email: email || user.Email || null,
    userId: user.UserId,
    ...patch,
    appVersion,
    skipOtp: true,
  });

  await profileChangeRepo.markApproved(pending.Id);
  clearUserProfileCache({ email: email || user.Email, userId: user.UserId });

  logger.info('[profile-change] approved and applied', {
    userId: user.UserId,
    changedKeys: pending.ChangedKeys,
  });

  return {
    httpStatus: result?.httpStatus || 200,
    body: {
      ...(result?.body || { success: true }),
      message: result?.body?.message || 'Profile changes saved after coach approval.',
      changedFields: labelsForChangedKeys(pending.ChangedKeys || []),
      changedKeys: pending.ChangedKeys || [],
    },
  };
}
