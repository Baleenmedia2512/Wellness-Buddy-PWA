/**
 * backend/features/water/data/water.repo.js
 * ---------------------------------------------------------------------------
 * Data-access layer for the water feature. Only this file may talk to
 * Supabase. Domain and api layers consume the returned plain objects.
 *
 * Per claude.md §2.2 / §8.3:
 *   - parameterised queries only
 *   - structured logger, never console.log
 * ---------------------------------------------------------------------------
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { getPool } from '../../../utils/dbPool.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Returns the user's most-recent non-deleted weight row, or null.
 * @param {string|number} userId
 * @returns {Promise<{ Weight: number|string, CreatedAt: string } | null>}
 */
export async function getLatestWeight(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('Weight, CreatedAt')
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
    .order('CreatedAt', { ascending: false })
    .limit(1);

  if (error) {
    logger.error('[water.repo] weight query failed', {
      userId,
      err: error.message,
    });
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Returns all non-deleted food rows for the given user/date.
 * @param {string|number} userId
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<Array<{ CreatedAt: string, AnalysisData: unknown }>>}
 */
export async function getFoodRowsForDate(userId, date) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('CreatedAt, AnalysisData')
    .eq('UserID', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .gte('CreatedAt', `${date}T00:00:00`)
    .lte('CreatedAt', `${date}T23:59:59`);

  if (error) {
    logger.error('[water.repo] food query failed', {
      userId,
      date,
      err: error.message,
    });
    return [];
  }
  return data || [];
}

// ─── Water reminder queries (tasks_table) ─────────────────────────────────────

/**
 * Return every active user's pending 'water' task for the given date,
 * including their push token so the scheduler can send FCM notifications.
 *
 * Uses the pg pool (not Supabase client) because it requires a JOIN
 * across tasks_table and team_table.
 *
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<Array<{
 *   task_id:                  number,
 *   user_id:                  string,
 *   task_date:                string,
 *   window_start:             string,
 *   window_end:               string,
 *   reminder_count:           number,
 *   reminder_dismissed_today: boolean,
 *   snoozed_until:            string|null,
 *   push_token:               string,
 * }>>}
 */
export async function getPendingWaterTasksForDate(date) {
  const client = await getPool();
  try {
    const result = await client.query(
      `SELECT
         t."TaskId"                  AS task_id,
         t."UserId"                  AS user_id,
         t."TaskDate"                AS task_date,
         t."WindowStart"             AS window_start,
         t."WindowEnd"               AS window_end,
         t."ReminderCount"           AS reminder_count,
         t."ReminderDismissedToday"  AS reminder_dismissed_today,
         t."SnoozedUntil"            AS snoozed_until,
         u."PushToken"               AS push_token
       FROM tasks_table t
       JOIN team_table u ON t."UserId"::text = u."UserId"::text
       WHERE t."TaskDate" = $1::date
         AND t."TaskType" = 'water'
         AND t."Status"   = 'pending'
         AND u."Status"   = 'Active'
         AND u."PushToken" IS NOT NULL
       ORDER BY t."UserId"`,
      [date],
    );
    return result.rows;
  } catch (error) {
    logger.error('[water.repo] getPendingWaterTasksForDate failed', {
      date,
      err: error.message,
    });
    return [];
  } finally {
    client.release();
  }
}

/**
 * Increment ReminderCount on a water task after a hydration reminder is sent.
 * Ensures each scheduled slot fires exactly once (idempotency guard lives in
 * shouldSendWaterReminder — this is the write-side of the same mechanism).
 *
 * @param {number} taskId
 * @returns {Promise<void>}
 */
export async function incrementWaterTaskReminderCount(taskId) {
  const client = await getPool();
  try {
    await client.query(
      'UPDATE tasks_table SET "ReminderCount" = "ReminderCount" + 1 WHERE "TaskId" = $1',
      [taskId],
    );
    logger.info('[water.repo] reminder count incremented', { taskId });
  } catch (error) {
    logger.error('[water.repo] incrementWaterTaskReminderCount failed', {
      taskId,
      err: error.message,
    });
    throw error;
  } finally {
    client.release();
  }
}
