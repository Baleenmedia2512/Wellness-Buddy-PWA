/**
 * Wellness Valley team_table UserId is a positive integer.
 * Firebase Auth uses alphanumeric `uid` — never treat that as our DB id.
 */
import * as Session from './sessionStorage.js';

export function parseNumericDbUserId(raw) {
  if (raw == null || raw === '') return null;
  const trimmed = String(raw).trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function readNumericDbUserId(user, sessionId = Session.getDbUserId()) {
  const candidates = [
    user?.id,
    user?.UserId,
    user?.userId,
    sessionId,
  ];
  for (const c of candidates) {
    const n = parseNumericDbUserId(c);
    if (n) return n;
  }
  return null;
}

/** Mutates `user` (Firebase User is extensible) and persists session dbUserId. */
export function attachNumericDbUserId(user, rawId) {
  const n = parseNumericDbUserId(rawId) || readNumericDbUserId(user);
  if (!n || !user) return null;
  user.id = n;
  user.UserId = n;
  Session.setDbUserId(n);
  return n;
}

/**
 * Plain snapshot for React state. Firebase User spread can drop a non-enumerable `id`.
 */
export function snapshotUserWithDbId(user, rawId) {
  if (!user) return user;
  const n = attachNumericDbUserId(user, rawId);
  return {
    ...user,
    uid: user.uid,
    email: user.email || user.Email || '',
    Email: user.email || user.Email || '',
    displayName: user.displayName || user.username || user.userName || '',
    photoURL: user.photoURL || user.photoUrl || null,
    phone: user.phone || user.phoneNumber || user.PhoneNumber || '',
    phoneNumber: user.phoneNumber || user.PhoneNumber || user.phone || '',
    username: user.username || user.userName || user.displayName || '',
    userName: user.userName || user.username || user.displayName || '',
    status: user.status || user.Status,
    consentRequired: user.consentRequired,
    ...(n ? { id: n, UserId: n, userId: n } : {}),
  };
}
