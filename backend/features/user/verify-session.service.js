/**
 * verify-session.service.js — confirm the client session maps to a live team_table row.
 *
 * Used on app cold start / resume so a hard-deleted account cannot keep using a
 * cached local userId. Returns 404 when no row exists; may return a different
 * userId when email/phone resolves to a new row (re-registration after delete).
 */
import * as repo from './user.repository.js';
import { findUserByPhone } from '../auth/auth.repository.js';
import { syncUserTimezoneIfChanged } from './timezone-sync.service.js';

function parseUserId(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const uid = Number.parseInt(String(raw), 10);
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}

/**
 * @param {{ userId?: unknown, email?: unknown, phone?: unknown, timezoneIana?: unknown }}
 */
export async function verifyUserSession({ userId, email, phone, timezoneIana }) {
  const cachedId = parseUserId(userId);
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  const normalizedPhone = phone ? String(phone).trim() : null;

  let row = null;

  if (normalizedEmail) {
    row = await repo.findByEmail(
      normalizedEmail,
      '"UserId", "UserName", "Email", "PhoneNumber", "Status", "Role"',
    );
  } else if (normalizedPhone) {
    row = await findUserByPhone(normalizedPhone);
  } else if (cachedId) {
    row = await repo.findByUserId(
      cachedId,
      '"UserId", "UserName", "Email", "PhoneNumber", "Status", "Role"',
    );
  }

  if (!row) {
    return {
      httpStatus: 404,
      body: {
        success: false,
        userNotFound: true,
        message: 'Account not found',
      },
    };
  }

  const resolvedId = row.UserId;
  const sessionStale = cachedId != null && cachedId !== resolvedId;

  await syncUserTimezoneIfChanged(resolvedId, timezoneIana);

  return {
    httpStatus: 200,
    body: {
      success: true,
      userId: resolvedId,
      userName: row.UserName,
      email: row.Email || null,
      phone: row.PhoneNumber || null,
      status: row.Status,
      role: row.Role || 'user',
      isActive: row.Status === 'Active',
      sessionStale,
    },
  };
}
