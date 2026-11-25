/**
 * Member display-consent OTP for upline coach websites (What We Say / What We Do).
 */
import bcrypt from 'bcryptjs';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import logger from '../../shared/lib/logger.js';
import { generateEmailOtp, isValidEmailOtp } from '../auth/domain/otp-length.rules.js';
import * as authRepo from '../auth/auth.repository.js';
import { findByUserId } from '../user/user.repository.js';
import { maskEmailForDisplay } from '../user/domain/heightChange.rules.js';
import { bustPortfolioTeamMediaCache } from '../coach-portfolio/api/public-team-media.service.js';
import * as repo from './testimonials.repository.js';
import {
  WEBSITE_DISPLAY_CONSENT_FLAG,
  WEBSITE_DISPLAY_OTP_CONTACT_TYPE,
  WEBSITE_DISPLAY_OTP_HOURS,
  websiteDisplayOtpRecipientKey,
  canRequestDisplayConsent,
  hasWebsiteDisplayConsent,
  parseWebsiteDisplayAgreed,
} from './domain/websiteDisplayConsent.rules.js';
import { buildWebsiteDisplayConsentEmail } from './domain/websiteDisplayConsentEmail.rules.js';

function featureDisabled() {
  throw new ValidationError(404, 'Feature not enabled');
}

function otpExpiryIst(minutesFromNow) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + istOffset + minutesFromNow * 60 * 1000);
  return expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

function requirePositiveUserId(raw) {
  const userId = Number(raw);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  return userId;
}

/**
 * Bust portfolio team-media cache for every upline of this member (CoachId walk).
 * @param {number|string} memberUserId
 * @param {number|string|null} [knownCoachId]
 */
export async function bustUplinePortfolioCaches(memberUserId, knownCoachId = null) {
  // Owner gate: this user's own /coach page also depends on their consent_at.
  bustPortfolioTeamMediaCache(memberUserId);

  const startCoach = Number(knownCoachId);
  if (Number.isFinite(startCoach) && startCoach > 0) {
    bustPortfolioTeamMediaCache(startCoach);
  }

  let current = Number(memberUserId);
  const seen = new Set();
  for (let i = 0; i < 40 && Number.isFinite(current) && current > 0; i += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    let coachId = null;
    try {
      const info = await repo.findCoachIdForUser(current);
      coachId = Number(info?.coachId);
    } catch {
      break;
    }
    if (!Number.isFinite(coachId) || coachId <= 0) break;
    bustPortfolioTeamMediaCache(coachId);
    current = coachId;
  }
}

async function deliverMemberDisplayConsentOtp({ userId, testimonialId, memberName, memberEmail }) {
  const recipientKey = websiteDisplayOtpRecipientKey(userId, testimonialId);
  await authRepo.deactivateActiveOtps(recipientKey, WEBSITE_DISPLAY_OTP_CONTACT_TYPE);
  const otp = generateEmailOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  await authRepo.insertOtpToken({
    Recipient: recipientKey,
    OTPHash: otpHash,
    ExpiresAt: otpExpiryIst(WEBSITE_DISPLAY_OTP_HOURS * 60),
    ContactType: WEBSITE_DISPLAY_OTP_CONTACT_TYPE,
    IsActive: true,
    CreatedAt: nowUtc(),
  });
  const mail = buildWebsiteDisplayConsentEmail({
    otp,
    memberName,
    expiresHours: WEBSITE_DISPLAY_OTP_HOURS,
  });
  await sendTransactionalMail({
    to: memberEmail,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return { maskedEmail: maskEmailForDisplay(memberEmail) };
}

/**
 * After coach content verify — if member already agreed, email display-consent OTP.
 * Best-effort; never throws to callers.
 * @param {object} row testimonials row after verify
 */
export async function maybeAutoSendDisplayConsentOtp(row) {
  if (!isEnabled(WEBSITE_DISPLAY_CONSENT_FLAG)) return;
  if (!row || hasWebsiteDisplayConsent(row)) return;
  if (!canRequestDisplayConsent(row)) return;
  if (!(row.website_display_agreed === true || row.website_display_agreed === 1)) return;

  try {
    const userId = Number(row.user_id);
    const user = await findByUserId(userId, '"UserId", "UserName", "Email"');
    const email = String(user?.Email || '').trim().toLowerCase();
    if (!email.includes('@')) {
      logger.warn('[testimonials.display-consent] auto-send skipped — no member email', { userId });
      return;
    }
    await deliverMemberDisplayConsentOtp({
      userId,
      testimonialId: row.id,
      memberName: user?.UserName || 'Member',
      memberEmail: email,
    });
    logger.info('[testimonials.display-consent] auto OTP emailed to member', {
      userId,
      testimonialId: row.id,
    });
  } catch (err) {
    logger.warn('[testimonials.display-consent] auto-send failed', {
      testimonialId: row?.id,
      message: err?.message || String(err),
    });
  }
}

/**
 * Member requests (or re-requests) display-consent OTP.
 */
export async function requestWebsiteDisplayConsentOtp(rawBody = {}) {
  if (!isEnabled(WEBSITE_DISPLAY_CONSENT_FLAG)) featureDisabled();
  const userId = requirePositiveUserId(rawBody.userId);
  const agreed = parseWebsiteDisplayAgreed(rawBody.websiteDisplayAgreed ?? true);

  const row = await repo.findByUserId(userId);
  if (!row) throw new ValidationError(404, 'Testimonial not found');
  if (!canRequestDisplayConsent(row)) {
    throw new ValidationError(
      422,
      'Your Transformation must be verified by your coach before website display consent.',
    );
  }
  if (hasWebsiteDisplayConsent(row)) {
    throw new ValidationError(409, 'Already consented — your Transformation can show on upline websites.');
  }
  if (!agreed) {
    throw new ValidationError(
      400,
      'Tick the agreement checkbox to display on all your Upline websites.',
    );
  }

  if (!(row.website_display_agreed === true || row.website_display_agreed === 1)) {
    await repo.updateTestimonial(row.id, {
      websiteDisplayAgreed: true,
      websiteDisplayConsentRevokedAt: null,
    });
  }

  const user = await findByUserId(userId, '"UserId", "UserName", "Email"');
  const email = String(user?.Email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw new ValidationError(400, 'Add an email on your profile to receive the consent OTP.');
  }

  const { maskedEmail } = await deliverMemberDisplayConsentOtp({
    userId,
    testimonialId: row.id,
    memberName: user?.UserName || 'Member',
    memberEmail: email,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      otpSent: true,
      maskedEmail,
      expiresInHours: WEBSITE_DISPLAY_OTP_HOURS,
      message: `We emailed a code to ${maskedEmail}. Enter it to show your Transformation on all upline websites.`,
    },
  };
}

/**
 * Member verifies display-consent OTP → sets consent_at.
 */
export async function verifyWebsiteDisplayConsentOtp(rawBody = {}) {
  if (!isEnabled(WEBSITE_DISPLAY_CONSENT_FLAG)) featureDisabled();
  const userId = requirePositiveUserId(rawBody.userId);
  const code = String(rawBody.otp || '').trim();
  if (!isValidEmailOtp(code)) {
    throw new ValidationError(400, 'Enter the 4-digit OTP from your email');
  }

  const row = await repo.findByUserId(userId);
  if (!row) throw new ValidationError(404, 'Testimonial not found');
  if (!canRequestDisplayConsent(row)) {
    throw new ValidationError(422, 'Coach verification is required before website consent.');
  }
  if (hasWebsiteDisplayConsent(row)) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        alreadyConsented: true,
        websiteDisplayConsentAt: row.website_display_consent_at,
        message: 'Already consented.',
      },
    };
  }

  const otpData = await authRepo.fetchActiveOtp(
    websiteDisplayOtpRecipientKey(userId, row.id),
    WEBSITE_DISPLAY_OTP_CONTACT_TYPE,
  );
  if (!otpData) {
    throw new ValidationError(422, 'No active code found. Tap Resend to email a new code.');
  }
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIST = new Date(now.getTime() + istOffset);
  const expiresAt = new Date(`${otpData.ExpiresAt}Z`);
  if (currentIST > expiresAt) {
    throw new ValidationError(422, 'OTP expired. Tap Resend to email a new code.');
  }
  const valid = await bcrypt.compare(code, otpData.OTPHash);
  if (!valid) throw new ValidationError(422, 'Invalid OTP. Check your email and try again.');
  await authRepo.markOtpVerified(otpData.ID);

  const consentAt = nowUtc();
  await repo.updateTestimonial(row.id, {
    websiteDisplayAgreed: true,
    websiteDisplayConsentAt: consentAt,
    websiteDisplayConsentRevokedAt: null,
  });

  await bustUplinePortfolioCaches(userId, row.coach_id);

  logger.info('[testimonials.display-consent] consented', {
    userId,
    testimonialId: row.id,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      websiteDisplayConsentAt: consentAt,
      message: 'Consent saved. Your Transformation can now appear on all upline websites.',
    },
  };
}

/**
 * Member revokes website display — immediate hide on upline sites.
 */
export async function revokeWebsiteDisplayConsent(rawBody = {}) {
  if (!isEnabled(WEBSITE_DISPLAY_CONSENT_FLAG)) featureDisabled();
  const userId = requirePositiveUserId(rawBody.userId);

  const row = await repo.findByUserId(userId);
  if (!row) throw new ValidationError(404, 'Testimonial not found');

  await repo.updateTestimonial(row.id, {
    websiteDisplayAgreed: false,
    websiteDisplayConsentAt: null,
    websiteDisplayConsentRevokedAt: nowUtc(),
  });

  try {
    await authRepo.deactivateActiveOtps(
      websiteDisplayOtpRecipientKey(userId, row.id),
      WEBSITE_DISPLAY_OTP_CONTACT_TYPE,
    );
  } catch {
    /* non-fatal */
  }

  await bustUplinePortfolioCaches(userId, row.coach_id);

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Removed from upline websites.',
    },
  };
}
