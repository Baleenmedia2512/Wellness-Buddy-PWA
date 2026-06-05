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
 * Finds all members (downline) who are directly under a specific coach.
 * 
 * @param {string} coachId - The coach's UserId
 * @returns {Promise<Array<{UserId: string, CoachId: string}>>}
 */
async function findMembersUnderCoach(coachId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, CoachId')
    .eq('CoachId', coachId);
  
  if (error) {
    logger.error('Failed to find members under coach', {
      coachId,
      error: error.message,
    });
    throw new Error(`Failed to find members: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Finds the parent coach of a given user.
 * Returns the CoachId of the specified user.
 * 
 * @param {string} userId - The user's UserId
 * @returns {Promise<string|null>} - The parent CoachId or null if no parent
 */
async function findParentCoach(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('CoachId')
    .eq('UserId', userId)
    .single();
  
  if (error || !data) {
    logger.warn('Failed to find parent coach', {
      userId,
      error: error?.message,
    });
    return null;
  }
  
  return data.CoachId;
}

/**
 * Reassigns all members from an inactive coach to their parent coach.
 * 
 * @param {string} inactiveCoachId - The coach being deactivated
 * @param {string} correlationId - Correlation ID for logging
 * @returns {Promise<{reassigned: number, failed: number}>}
 */
async function reassignMembersToParentCoach(inactiveCoachId, correlationId) {
  try {
    // Find the parent coach (the inactive coach's coach)
    const parentCoachId = await findParentCoach(inactiveCoachId);
    
    if (!parentCoachId) {
      logger.warn('Inactive coach has no parent coach - members will remain orphaned', {
        correlationId,
        inactiveCoachId,
      });
      return { reassigned: 0, failed: 0 };
    }
    
    // Find all members under the inactive coach
    const members = await findMembersUnderCoach(inactiveCoachId);
    
    if (members.length === 0) {
      logger.info('No members to reassign', {
        correlationId,
        inactiveCoachId,
        parentCoachId,
      });
      return { reassigned: 0, failed: 0 };
    }
    
    // Reassign all members to the parent coach
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('team_table')
      .update({ CoachId: parentCoachId })
      .eq('CoachId', inactiveCoachId);
    
    if (error) {
      logger.error('Failed to reassign members', {
        correlationId,
        inactiveCoachId,
        parentCoachId,
        memberCount: members.length,
        error: error.message,
      });
      return { reassigned: 0, failed: members.length };
    }
    
    logger.info('Members reassigned to parent coach', {
      correlationId,
      inactiveCoachId,
      parentCoachId,
      memberCount: members.length,
      members: members.map(m => m.UserId),
    });
    
    return { reassigned: members.length, failed: 0 };
    
  } catch (err) {
    logger.error('Unexpected error in reassignMembersToParentCoach', {
      correlationId,
      inactiveCoachId,
      error: err.message,
      stack: err.stack,
    });
    return { reassigned: 0, failed: 0 };
  }
}

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
 * Does NOT modify the database hierarchy (CoachId remains unchanged).
 * 
 * Business Logic:
 * 1. Only deactivate the user (Status = 'Inactive')
 * 2. CoachId stays the same in the database
 * 3. Application code will handle inactive coach resolution when fetching data
 * 
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
      // Only deactivate the user - don't modify hierarchy
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
