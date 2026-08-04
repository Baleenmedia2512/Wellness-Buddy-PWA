/**
 * Resolve a user's IANA timezone from team_table.
 */
import { resolveProfileTimezone } from './profileTimezone.js';
import * as userRepo from '../user.repository.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

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

/**
 * Batch-load IANA timezones for many users (one query).
 * Keys are stringified UserId.
 *
 * @param {Array<string|number>} userIds
 * @returns {Promise<Map<string, string>>}
 */
export async function getUserTimezonesIanaMap(userIds) {
  const map = new Map();
  const ids = [...new Set(
    (userIds || [])
      .map((id) => Number.parseInt(String(id), 10))
      .filter((id) => Number.isFinite(id) && id > 0),
  )];
  if (ids.length === 0) return map;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", timezone_iana')
    .in('UserId', ids);
  if (error) throw error;

  for (const row of data || []) {
    map.set(String(row.UserId), resolveProfileTimezone(row.timezone_iana));
  }
  for (const id of ids) {
    const key = String(id);
    if (!map.has(key)) map.set(key, resolveProfileTimezone(null));
  }
  return map;
}

/**
 * Resolve TZ for a user id from a batch map, with fallback.
 * @param {Map<string, string>|Record<string, string>|null|undefined} timezoneByUserId
 * @param {string|number} userId
 * @param {string} fallback
 * @returns {string}
 */
export function resolveTimezoneFromMap(timezoneByUserId, userId, fallback) {
  if (!timezoneByUserId) return fallback;
  const key = String(userId);
  if (timezoneByUserId instanceof Map) {
    return timezoneByUserId.get(key) || fallback;
  }
  return timezoneByUserId[key] || timezoneByUserId[userId] || fallback;
}
