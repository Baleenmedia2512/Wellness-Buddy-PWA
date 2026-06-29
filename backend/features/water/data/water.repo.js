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
 * Uses Supabase REST (same transport as /api/tasks/list) so cron works when
 * DATABASE_URL is misconfigured but SUPABASE_URL is valid.
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
  const supabase = getSupabaseClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks_table')
    .select(
      'TaskId, UserId, TaskDate, WindowStart, WindowEnd, ReminderCount, ReminderDismissedToday, SnoozedUntil',
    )
    .eq('TaskDate', date)
    .eq('TaskType', 'water')
    .eq('Status', 'pending');

  if (tasksError) {
    logger.error('[water.repo] getPendingWaterTasksForDate failed', {
      date,
      err: tasksError.message,
    });
    throw new Error(tasksError.message);
  }

  if (!tasks?.length) return [];

  const userIds = [...new Set(tasks.map((t) => String(t.UserId)))];

  const { data: members, error: membersError } = await supabase
    .from('team_table')
    .select('UserId, PushToken, Status')
    .in('UserId', userIds)
    .eq('Status', 'Active')
    .not('PushToken', 'is', null);

  if (membersError) {
    logger.error('[water.repo] getPendingWaterTasksForDate members query failed', {
      date,
      err: membersError.message,
    });
    throw new Error(membersError.message);
  }

  const tokenByUser = Object.fromEntries(
    (members || []).map((m) => [String(m.UserId), m.PushToken]),
  );

  return tasks
    .filter((t) => tokenByUser[String(t.UserId)])
    .map((t) => ({
      task_id:                  t.TaskId,
      user_id:                  String(t.UserId),
      task_date:                t.TaskDate,
      window_start:             t.WindowStart,
      window_end:               t.WindowEnd,
      reminder_count:           t.ReminderCount,
      reminder_dismissed_today: t.ReminderDismissedToday,
      snoozed_until:            t.SnoozedUntil,
      push_token:               tokenByUser[String(t.UserId)],
    }));
}

