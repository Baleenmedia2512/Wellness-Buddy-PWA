/**
 * Cross-feature user activity helpers.
 * Used by every feature that mutates user data (weight, education, screen, etc.).
 */
import { getMysqlClient } from '../../utils/mysqlClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { cache, cacheKeys } from '../../utils/cache.js';

/**
 * Update team_table.LastActiveAt for the user. Failures are logged, not thrown,
 * so they never break the parent operation.
 */
export async function touchUserActivity(userId) {
  if (!userId) return;
  try {
    const db = getMysqlClient();
    const { error } = await db
      .from('team_table')
      .update({ LastActiveAt: nowUtc() })
      .eq('UserId', userId);
    if (error) console.warn('[userActivity] LastActiveAt update failed:', error.message);
  } catch (err) {
    console.warn('[userActivity] LastActiveAt update threw:', err.message);
  }
}

/**
 * Look up the user's email and invalidate their profile cache entry.
 * Failures are logged, not thrown.
 */
export async function invalidateUserProfileCache(userId) {
  if (!userId) return;
  try {
    const db = getMysqlClient();
    const { data: user } = await db
      .from('team_table')
      .select('Email')
      .eq('UserId', userId)
      .maybeSingle();
    if (user?.Email) cache.delete(cacheKeys.userProfile(user.Email));
  } catch (err) {
    console.warn('[userActivity] Cache invalidation threw:', err.message);
  }
}
