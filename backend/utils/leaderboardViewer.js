/**
 * Leaderboard viewer id — numeric team_table UserId, or email lookup
 * when the client still only has a Firebase uid (Android/iOS Google sign-in).
 */
import * as userRepo from '../features/user/user.repository.js';

export function parseLeaderboardUserId(raw) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 && String(raw).trim() === String(n) ? n : null;
}

export async function resolveLeaderboardViewerId({ userId, email } = {}) {
  const fromId = parseLeaderboardUserId(userId);
  if (fromId) return fromId;
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  const row = await userRepo.findByEmail(normalized, '"UserId"');
  const fromEmail = parseLeaderboardUserId(row?.UserId);
  return fromEmail;
}
