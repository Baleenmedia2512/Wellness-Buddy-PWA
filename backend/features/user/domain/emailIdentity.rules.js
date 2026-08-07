/**
 * emailIdentity.rules.js — Pure email identity rules for team_table.Email.
 * No I/O.
 */

export const EMAIL_TAKEN_MESSAGE =
  'This email is already registered. Sign in with that account or use a different email.';

/**
 * Normalize email for storage and comparison (trim + lowercase).
 *
 * @param {string|null|undefined} email
 * @returns {string}
 */
export function normalizeEmailForStorage(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Whether a candidate email may be assigned to userId.
 * Skips conflict check when the user already owns that email.
 *
 * @param {{ email: string, userId: number, existingEmailOnUser?: string|null, conflictingUserId?: number|null }} input
 * @returns {{ ok: true } | { ok: false, code: 'EMAIL_TAKEN', message: string }}
 */
export function canAssignEmailToUser({
  email,
  userId,
  existingEmailOnUser = null,
  conflictingUserId = null,
}) {
  const normalized = normalizeEmailForStorage(email);
  const uid = Number(userId);
  const current = normalizeEmailForStorage(existingEmailOnUser);

  if (current && current === normalized) {
    return { ok: true };
  }

  if (conflictingUserId != null) {
    const otherId = Number(conflictingUserId);
    if (Number.isFinite(otherId) && otherId > 0 && otherId !== uid) {
      return { ok: false, code: 'EMAIL_TAKEN', message: EMAIL_TAKEN_MESSAGE };
    }
  }

  return { ok: true };
}
