/**
 * idle-repo.js — Data layer for idle user detection and bulk operations.
 * Per claude.md §3.1: data layer is the only place that talks to Supabase/Postgres.
 * 
 * @module backend/features/idle-cleanup/data/idle-repo
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { getInactivityCutoff } from '../domain/inactivity-rules.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Finds all idle users who are currently Active.
 * Returns users with Status='Active' and LastActiveAt older than the cutoff.
 * 
 * Safety: LIMIT 10000 to prevent memory exhaustion.
 * Idempotency: filters out already-Inactive users.
 * 
 * @param {Object} [options={}] - Query options
 * @param {Date} [options.now=new Date()] - Current timestamp (for testing)
 * @param {number} [options.limit=10000] - Max results (safety guard)
 * @returns {Promise<Array<{UserId: string, Email: string, LastActiveAt: Date|null}>>}
 * @throws {Error} If database query fails
 * 
 * @example
 * const idleUsers = await findIdleUsers({ now: new Date('2026-06-04T00:00:00Z') });
 * // => [{ UserId: '123', Email: 'user@example.com', LastActiveAt: '2026-05-20' }, ...]
 */
export async function findIdleUsers(options = {}) {
  const { now = new Date(), limit = 10000 } = options;
  const cutoff = getInactivityCutoff(now);
  
  const correlationId = `idle-query-${Date.now()}`;
  const startTime = Date.now();

  try {
    const supabase = getSupabaseClient();
    
    // Query: Active users with LastActiveAt < cutoff OR LastActiveAt IS NULL
    const { data, error } = await supabase
      .from('team_table')
      .select('UserId, Email, LastActiveAt')
      .eq('Status', 'Active')
      .or(`LastActiveAt.lt.${cutoff.toISOString()},LastActiveAt.is.null`)
      .limit(limit);

    if (error) {
      logger.error('Failed to query idle users', {
        correlationId,
        error: error.message,
        cutoff: cutoff.toISOString(),
        durationMs: Date.now() - startTime,
      });
      throw new Error(`Database query failed: ${error.message}`);
    }

    logger.info('Idle users query completed', {
      correlationId,
      count: data.length,
      cutoff: cutoff.toISOString(),
      durationMs: Date.now() - startTime,
    });

    return data || [];
  } catch (err) {
    logger.error('Unexpected error in findIdleUsers', {
      correlationId,
      error: err.message,
      stack: err.stack,
      durationMs: Date.now() - startTime,
    });
    throw err;
  }
}

/**
 * Deactivates multiple users by setting Status='Inactive'.
 * Reuses existing setUserStatus() from user.repository.js.
 * Per-user error isolation: logs failures but continues processing.
 * 
 * @param {Array<string>} userIds - Array of UserIds to deactivate
 * @param {string} correlationId - Correlation ID for logging
 * @returns {Promise<{success: number, failed: number, errors: Array<{userId: string, error: string}>}>}
 * 
 * @example
 * const result = await batchDeactivateUsers(['123', '456'], 'cron-xyz');
 * // => { success: 1, failed: 1, errors: [{ userId: '456', error: 'Not found' }] }
 */
export async function batchDeactivateUsers(userIds, correlationId) {
  // Import here to avoid circular dependency
  const { setUserStatus } = await import('../../user/user.repository.js');
  
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const userId of userIds) {
    try {
      await setUserStatus(userId, 'Inactive');
      results.success++;
      
      logger.debug('User deactivated', {
        correlationId,
        userId,
        action: 'deactivate',
      });
    } catch (err) {
      results.failed++;
      results.errors.push({
        userId,
        error: err.message,
      });
      
      // Log but continue (per-user error isolation)
      logger.warn('Failed to deactivate user', {
        correlationId,
        userId,
        error: err.message,
      });
    }
  }

  logger.info('Batch deactivation completed', {
    correlationId,
    totalUsers: userIds.length,
    success: results.success,
    failed: results.failed,
  });

  return results;
}
