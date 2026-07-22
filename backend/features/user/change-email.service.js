/**
 * change-email.service.js — OTP-gated email address updates for authenticated users.
 */
import { cache, cacheKeys } from '../../utils/cache.js';
import logger from '../../shared/lib/logger.js';
import { sendOtp, hasRecentlyVerifiedOtp } from '../auth/auth.service.js';
import * as repo from './user.repository.js';
import { normalizeEmail } from './user.validators.js';
import {
  assertEmailAvailable,
  isUniqueViolationError,
  uniqueViolationResponse,
} from './contact-uniqueness.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalidEmailResponse() {
  return { httpStatus: 400, body: { success: false, message: 'A valid email address is required.' } };
}

async function assertUserOwnsEmail(userId, currentEmail) {
  const user = await repo.findByUserId(userId, '"UserId", "Email"');
  if (!user) {
    return { ok: false, response: { httpStatus: 404, body: { success: false, message: 'User not found.' } } };
  }

  const storedEmail = normalizeEmail(user.Email);
  const normalizedCurrent = normalizeEmail(currentEmail);
  if (!storedEmail || storedEmail !== normalizedCurrent) {
    return {
      ok: false,
      response: {
        httpStatus: 403,
        body: { success: false, message: 'Current email does not match your account.' },
      },
    };
  }

  return { ok: true, user };
}

async function assertNewEmailAvailable(userId, newEmail) {
  return assertEmailAvailable(newEmail, userId);
}

export async function requestEmailChange({ userId, currentEmail, newEmail }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    return { httpStatus: 400, body: { success: false, message: 'userId is required.' } };
  }

  const current = normalizeEmail(currentEmail);
  const next = normalizeEmail(newEmail);
  if (!current) {
    return { httpStatus: 400, body: { success: false, message: 'Current email is required.' } };
  }
  if (!next || !EMAIL_RE.test(next)) {
    return invalidEmailResponse();
  }
  if (current === next) {
    return {
      httpStatus: 400,
      body: { success: false, message: 'New email must be different from your current email.' },
    };
  }

  const ownership = await assertUserOwnsEmail(uid, current);
  if (!ownership.ok) return ownership.response;

  const availability = await assertNewEmailAvailable(uid, next);
  if (!availability.ok) {
    return { httpStatus: availability.httpStatus, body: availability.body };
  }

  logger.info('[change-email/request] sending OTP to new address', { userId: uid });
  return sendOtp({ recipient: next, contactType: 'email' });
}

export async function changeEmail({ userId, currentEmail, newEmail }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    return { httpStatus: 400, body: { success: false, message: 'userId is required.' } };
  }

  const current = normalizeEmail(currentEmail);
  const next = normalizeEmail(newEmail);
  if (!current) {
    return { httpStatus: 400, body: { success: false, message: 'Current email is required.' } };
  }
  if (!next || !EMAIL_RE.test(next)) {
    return invalidEmailResponse();
  }
  if (current === next) {
    return {
      httpStatus: 400,
      body: { success: false, message: 'New email must be different from your current email.' },
    };
  }

  const ownership = await assertUserOwnsEmail(uid, current);
  if (!ownership.ok) return ownership.response;

  const availability = await assertNewEmailAvailable(uid, next);
  if (!availability.ok) {
    return { httpStatus: availability.httpStatus, body: availability.body };
  }

  const otpVerified = await hasRecentlyVerifiedOtp(next, 'email');
  if (!otpVerified) {
    return {
      httpStatus: 403,
      body: {
        success: false,
        message: 'Email verification required. Please verify the OTP sent to your new email address.',
      },
    };
  }

  try {
    await repo.updateUserById(uid, { Email: next });
  } catch (err) {
    if (isUniqueViolationError(err)) return uniqueViolationResponse(err);
    throw err;
  }

  try {
    cache.delete(cacheKeys.userProfile(current));
    cache.delete(cacheKeys.userProfile(next));
    cache.delete(cacheKeys.userContext(uid));
    cache.delete(cacheKeys.userContext(String(uid)));
  } catch (err) {
    logger.warn('[change-email] cache clear failed (non-fatal)', { userId: uid, message: err?.message });
  }

  logger.info('[change-email] email updated', { userId: uid });

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Email address updated successfully.',
      email: next,
    },
  };
}
