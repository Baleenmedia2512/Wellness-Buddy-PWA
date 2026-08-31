/**
 * verifyAccountSession — server check that the cached client session still exists.
 *
 * Prevents ghost access after hard-delete: always confirms team_table row before
 * trusting localStorage dbUserId / otpUser.id.
 */
import { getApiBaseUrl } from '../../config/api.config.js';
import { getDeviceTimezoneIana } from '../utils/deviceTimezone.js';
import * as Session from './sessionStorage.js';
import { clearUserIdCache } from './getUserId.js';
import { attachNumericDbUserId, readNumericDbUserId } from './numericDbUserId.js';
import { apiFetch } from './apiFetch.js';
import { handlePossibleAppUpdateRequired } from './appVersionEnforce.client.js';

/**
 * Invalidate local session markers when the account no longer exists server-side.
 * Does not call Firebase signOut — App.js handleSignOut owns that.
 */
export function invalidateLocalAccountSession() {
  clearUserIdCache();
  Session.clearDbUserId();
  Session.clearOtpUser();
  Session.clearUserEmail();
  Session.markAccountDeleted();
  Session.markUserSignedOut();
}

/**
 * @param {{ userId?: string|number|null, email?: string|null, phone?: string|null }} identity
 * @returns {Promise<{
 *   ok: boolean,
 *   userId?: string|number,
 *   sessionStale?: boolean,
 *   userNotFound?: boolean,
 *   networkError?: boolean,
 * }>}
 */
export async function verifyAccountSession({ userId = null, email = null, phone = null } = {}) {
  const apiBaseUrl = getApiBaseUrl();
  const payload = {
    timezoneIana: getDeviceTimezoneIana() ?? '',
  };
  if (userId != null && String(userId).trim() !== '') payload.userId = String(userId);
  if (email) payload.email = String(email).trim().toLowerCase();
  if (phone) payload.phone = String(phone).trim();

  if (!payload.userId && !payload.email && !payload.phone) {
    return { ok: false, userNotFound: true };
  }

  try {
    const res = await apiFetch(`${apiBaseUrl}/api/user/verify-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (handlePossibleAppUpdateRequired(res, data)) {
      return { ok: false, networkError: true, updateRequired: true };
    }

    if (res.status === 404 || data.userNotFound || (data.success === false && !data.networkError)) {
      invalidateLocalAccountSession();
      return { ok: false, userNotFound: true };
    }

    if (!res.ok || !data.success || !data.userId) {
      // Transient server/network — do not wipe session on 5xx.
      return { ok: false, networkError: true };
    }

    const resolvedId = data.userId;
    clearUserIdCache();
    Session.setDbUserId(resolvedId);
    return {
      ok: true,
      userId: resolvedId,
      sessionStale: Boolean(data.sessionStale),
    };
  } catch {
    return { ok: false, networkError: true };
  }
}

/**
 * Resolve and attach DB user id after server verification.
 *
 * @param {{ id?: string|number, UserId?: string|number, email?: string, Email?: string, phone?: string, PhoneNumber?: string }} user
 * @returns {Promise<{ ok: boolean, user?: object, userNotFound?: boolean, networkError?: boolean }>}
 */
export async function verifyAndAttachDbUserId(user) {
  if (!user) return { ok: false, userNotFound: true };

  const email = user.email || user.Email || Session.getUserEmail() || null;
  const phone = user.phone || user.PhoneNumber || user.phoneNumber || null;
  const cachedId = readNumericDbUserId(user);

  const result = await verifyAccountSession({
    userId: cachedId,
    email,
    phone: email ? null : phone,
  });

  if (!result.ok) {
    if (result.userNotFound) {
      return { ok: false, userNotFound: true };
    }
    // Offline / transient — keep cached id until the next successful verify.
    if (cachedId) {
      return {
        ok: true,
        user: { ...user, id: cachedId, UserId: cachedId },
        offline: true,
      };
    }
    return { ok: false, networkError: true };
  }

  attachNumericDbUserId(user, result.userId);
  const nextUser = {
    ...user,
    id: result.userId,
    UserId: result.userId,
  };
  if (email) Session.setUserEmail(email);

  return { ok: true, user: nextUser, sessionStale: result.sessionStale };
}
