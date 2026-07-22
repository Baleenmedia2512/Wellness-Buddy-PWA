/**
 * Keeps OTP session identity (user id, cached dbUserId, otpUser) in sync so
 * feature modules always query data for the currently logged-in user.
 */
import * as Session from './sessionStorage.js';
import { clearUserIdCache } from './getUserId.js';

function normalizeId(value) {
  if (value == null || value === '') return null;
  return String(value);
}

/**
 * Persist the authenticated user's id after OTP verify or login.
 * Clears stale email→id cache from a previous session.
 *
 * @param {object|null|undefined} parsedUser
 */
export function persistOtpSessionUser(parsedUser) {
  if (!parsedUser) return;

  const id = normalizeId(parsedUser.id ?? parsedUser.UserId);
  const email = parsedUser.email || parsedUser.Email || null;

  if (id) {
    Session.setDbUserId(id);
    Session.setOtpUser({ ...parsedUser, id: parsedUser.id ?? parsedUser.UserId ?? id });
  }

  if (email) {
    Session.setUserEmail(email);
  }

  clearUserIdCache();
}

/**
 * Resolve the authenticated user's database id from React state and session.
 * Never returns a stale dbUserId that conflicts with the stored otpUser.
 *
 * @param {object|null|undefined} user
 * @returns {string|null}
 */
export function resolveAuthenticatedUserId(user) {
  const fromUser = normalizeId(user?.id ?? user?.UserId);
  if (fromUser) return fromUser;

  const otpUser = Session.getOtpUser();
  const fromOtp = normalizeId(otpUser?.id ?? otpUser?.UserId);
  if (fromOtp) return fromOtp;

  const cached = Session.getDbUserId();
  if (cached && otpUser) {
    const otpId = normalizeId(otpUser.id ?? otpUser.UserId);
    if (otpId && otpId === String(cached)) return String(cached);
    return null;
  }

  return cached ? String(cached) : null;
}

/**
 * Attach a missing id to a restored otpUser without inheriting another user's
 * cached dbUserId.
 *
 * @param {object} otpUser
 * @returns {object}
 */
export function hydrateOtpUserId(otpUser) {
  if (!otpUser) return otpUser;

  const existingId = normalizeId(otpUser.id ?? otpUser.UserId);
  if (existingId) {
    Session.setDbUserId(existingId);
    return { ...otpUser, id: otpUser.id ?? otpUser.UserId ?? existingId };
  }

  return otpUser;
}
