/**
 * Resolve a user's IANA timezone from team_table.
 */
import { resolveProfileTimezone } from './profileTimezone.js';
import * as userRepo from '../user.repository.js';

/**
 * @param {string|number} userId
 * @returns {Promise<string>} IANA timezone (defaults to Asia/Kolkata)
 */
export async function getUserTimezoneIana(userId) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    return resolveProfileTimezone(null);
  }
  const row = await userRepo.findByUserId(uid, 'timezone_iana');
  return resolveProfileTimezone(row?.timezone_iana);
}
