/**
 * task-repo.js — Data access layer for tasks
 * 
 * Responsibilities:
 * - All database queries for tasks
 * - No business logic (that lives in domain/)
 * - Parameterised queries only (SQL injection prevention)
 * 
 * Per claude.md §2.7: Use dbPool with parameterised queries
 */

import { getPool } from '../../../utils/dbPool.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

// Each call acquires a dedicated connection (has .query() and .release()).
// getPool() returns the pool wrapper, not a connection — do NOT call it directly.
const dbPool = () => getPool().getConnection();

/**
 * Get all tasks for a user on a specific date with status filter
 * 
 * @param {string} userId - User ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} status - Optional status filter ('pending', 'completed', 'missed')
 * @returns {Promise<Array>} - Array of task objects
 */
function mapTaskRowWithWindows(row, windowsByType) {
  const tw = windowsByType[row.TaskType];
  return {
    task_id: row.TaskId,
    user_id: row.UserId,
    task_type: row.TaskType,
    task_date: row.TaskDate,
    status: row.Status,
    priority: row.Priority,
    window_start: tw?.WindowStartTime ?? null,
    window_end: tw?.WindowEndTime ?? null,
    created_at: row.CreatedAt,
    completed_at: row.CompletedAt,
    task_data: row.TaskData,
    completion_data: row.CompletionData,
    notification_sent: row.NotificationSent,
    notification_sent_at: row.NotificationSentAt,
    reminder_count: row.ReminderCount,
    snoozed_until: row.SnoozedUntil,
    reminder_dismissed_today: row.ReminderDismissedToday,
  };
}

function sortTasksByWindowAndPriority(tasks) {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    const wsA = a.window_start ?? '\uffff';
    const wsB = b.window_start ?? '\uffff';
    if (wsA !== wsB) return wsA < wsB ? -1 : 1;
    const pA = priorityRank[a.priority] ?? 99;
    const pB = priorityRank[b.priority] ?? 99;
    return pA - pB;
  });
}

/**
 * Reads tasks via Supabase REST (same transport as /api/admin/time-windows).
 * Direct pg pool (DATABASE_URL) is not required for this hot path.
 */
async function getTasksByUserAndDate(userId, date, status = null) {
  try {
    const supabase = getSupabaseClient();

    let taskQuery = supabase
      .from('tasks_table')
      .select(
        'TaskId, UserId, TaskType, TaskDate, Status, Priority, CreatedAt, CompletedAt, TaskData, CompletionData, NotificationSent, NotificationSentAt, ReminderCount, SnoozedUntil, ReminderDismissedToday',
      )
      .eq('UserId', userId)
      .eq('TaskDate', date);

    if (status) {
      taskQuery = taskQuery.eq('Status', status);
    }

    const { data: taskRows, error: tasksError } = await taskQuery;
    if (tasksError) throw tasksError;

    const { data: windowRows, error: windowsError } = await supabase
      .from('activity_time_windows_table')
      .select('ActivityType, WindowStartTime, WindowEndTime')
      .is('EffectiveToDate', null);

    if (windowsError) throw windowsError;

    const windowsByType = Object.fromEntries(
      (windowRows || []).map((w) => [w.ActivityType, w]),
    );

    const tasks = (taskRows || []).map((row) => mapTaskRowWithWindows(row, windowsByType));
    return sortTasksByWindowAndPriority(tasks);
  } catch (error) {
    logger.error('Error fetching tasks', { userId, date, status, error: error.message });
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4c8196'},body:JSON.stringify({sessionId:'4c8196',location:'task-repo.js:getTasksByUserAndDate',message:'DB query failed',data:{userId,date,status,errorMessage:error.message,errorCode:error.code},timestamp:Date.now(),hypothesisId:'H1-H2-H3',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    throw error;
  }
}

/**
 * Get pending tasks that need notifications sent
 * 
 * @param {string} currentTime - Current time in HH:mm format
 * @param {string} currentDate - Current date in YYYY-MM-DD format
 * @returns {Promise<Array>} - Tasks needing notifications
 */
async function getTasksNeedingNotification(currentTime, currentDate) {
  const client = await dbPool();
  
  try {
    const result = await client.query(`
      SELECT 
        t."TaskId" as task_id,
        t."UserId" as user_id,
        t."TaskType" as task_type,
        t."TaskDate" as task_date,
        tw."WindowStartTime" as window_start,
        tw."WindowEndTime" as window_end,
        u."Email",
        u."UserName"
      FROM tasks_table t
      JOIN team_table u ON t."UserId" = u."UserId"::text
      JOIN activity_time_windows_table tw
        ON tw."ActivityType" = t."TaskType"
       AND tw."EffectiveToDate" IS NULL
      WHERE t."TaskDate" = $1::date
        AND t."Status" = 'pending'
        AND t."NotificationSent" = false
        AND substring(tw."WindowStartTime"::text, 1, 5) = $2
    `, [currentDate, currentTime]);
    
    return result[0];
  } catch (error) {
    logger.error('Error fetching tasks needing notification', { currentTime, currentDate, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create a new task
 * 
 * @param {Object} taskData - Task data
 * @returns {Promise<Object>} - Created task
 */
async function createTask(taskData) {
  const client = await dbPool();
  
  try {
    const {
      userId,
      taskType,
      taskDate,
      windowStart,
      windowEnd,
      priority = 'medium',
      taskDataJson = {}
    } = taskData;
    
    const result = await client.query(`
      INSERT INTO tasks_table (
        "UserId",
        "TaskType",
        "TaskDate",
        "WindowStart",
        "WindowEnd",
        "Priority",
        "TaskData",
        "Status"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      ON CONFLICT ("UserId", "TaskType", "TaskDate") DO UPDATE
        SET
          "WindowStart" = EXCLUDED."WindowStart",
          "WindowEnd"   = EXCLUDED."WindowEnd"
        WHERE tasks_table."Status" = 'pending'
      RETURNING *
    `, [userId, taskType, taskDate, windowStart, windowEnd, priority, JSON.stringify(taskDataJson)]);
    
    if (result[0].length > 0) {
      logger.info('Task created', { taskId: result[0][0].TaskId, userId, taskType, taskDate });
      return result[0][0];
    }
    
    return null; // Task already exists
  } catch (error) {
    logger.error('Error creating task', { taskData, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Complete a task
 * 
 * @param {number} taskId - Task ID
 * @param {Object} completionData - Data captured during completion
 * @returns {Promise<Object>} - Updated task
 */
async function completeTask(taskId, completionData) {
  const client = await dbPool();
  
  try {
    const result = await client.query(`
      UPDATE tasks_table
      SET 
        "Status" = 'completed',
        "CompletedAt" = NOW(),
        "CompletionData" = $1
      WHERE "TaskId" = $2 AND "Status" = 'pending'
      RETURNING *
    `, [JSON.stringify(completionData), taskId]);
    
    if (result[0].length > 0) {
      logger.info('Task completed', { taskId, userId: result[0][0].UserId });
      return result[0][0];
    }
    
    throw new Error('Task not found or already completed');
  } catch (error) {
    logger.error('Error completing task', { taskId, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Mark notification as sent for a task
 * 
 * @param {number} taskId - Task ID
 * @returns {Promise<void>}
 */
async function markNotificationSent(taskId) {
  const client = await dbPool();
  
  try {
    await client.query(`
      UPDATE tasks_table
      SET 
        "NotificationSent" = true,
        "NotificationSentAt" = NOW()
      WHERE "TaskId" = $1
    `, [taskId]);
    
    logger.info('Notification marked as sent', { taskId });
  } catch (error) {
    logger.error('Error marking notification sent', { taskId, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Expire (mark as missed) all pending tasks from previous days
 * 
 * @param {string} beforeDate - Date before which tasks should expire (YYYY-MM-DD)
 * @returns {Promise<number>} - Number of tasks expired
 */
async function expireOldTasks(beforeDate) {
  const client = await dbPool();
  
  try {
    const result = await client.query(`
      UPDATE tasks_table
      SET "Status" = 'missed'
      WHERE "TaskDate" < $1::date
        AND "Status" = 'pending'
    `, [beforeDate]);
    
    const count = result[0].affectedRows;
    logger.info('Expired old tasks', { count, beforeDate });
    return count;
  } catch (error) {
    logger.error('Error expiring old tasks', { beforeDate, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get time windows for a user
 * 
 * @param {string} userId - User ID (not used - global time windows apply to all users)
 * @returns {Promise<Array>} - Array of time window objects
 */
async function getTimeWindowsByUser(userId) {
  const client = await dbPool();
  
  try {
    const result = await client.query(`
      SELECT 
        "ActivityType" as activity_type,
        "WindowStartTime" as start_time,
        "WindowEndTime" as end_time,
        "EffectiveFromDate" as effective_from,
        "EffectiveToDate" as effective_to
      FROM activity_time_windows_table
      WHERE "EffectiveToDate" IS NULL
      ORDER BY "WindowStartTime" ASC
    `);
    
    return result[0];
  } catch (error) {
    logger.error('Error fetching time windows', { userId, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all active time windows starting at a specific time
 * 
 * @param {string} startTime - Start time in HH:mm format
 * @returns {Promise<Array>} - Array of time windows with user info (all active users get same windows)
 */
async function getTimeWindowsByStartTime(startTime) {
  const client = await dbPool();
  
  try {
    const result = await client.query(`
      SELECT 
        tw."ActivityType" as activity_type,
        tw."WindowStartTime" as start_time,
        tw."WindowEndTime" as end_time,
        u."UserId" as user_id,
        u."Email",
        u."UserName",
        u."Status",
        u."PushToken"
      FROM activity_time_windows_table tw
      CROSS JOIN team_table u
      WHERE tw."EffectiveToDate" IS NULL
        AND u."Status" = 'Active'
        AND substring(tw."WindowStartTime"::text, 1, 5) = $1
    `, [startTime]);
    
    return result[0];
  } catch (error) {
    logger.error('Error fetching time windows by start time', { startTime, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

// ─── Snooze / dismiss / reminder queries ────────────────────────────────────

/**
 * Increment ReminderCount after a follow-up reminder is sent.
 * Used by the background scheduler after each second-reminder FCM push.
 *
 * @param {number} taskId - Task ID.
 * @returns {Promise<void>}
 */
async function incrementReminderCount(taskId) {
  const client = await dbPool();
  try {
    await client.query(`
      UPDATE tasks_table
      SET "ReminderCount" = "ReminderCount" + 1
      WHERE "TaskId" = $1
    `, [taskId]);
    logger.info('Reminder count incremented', { taskId });
  } catch (error) {
    logger.error('Error incrementing reminder count', { taskId, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Snooze a task — sets SnoozedUntil and increments ReminderCount.
 *
 * @param {number} taskId      - Task ID.
 * @param {Date}   snoozedUntil - Expiry timestamp returned by calculateSnoozeExpiry().
 * @returns {Promise<Object>}   - Updated task row.
 */
async function snoozeTask(taskId, snoozedUntil) {
  const client = await dbPool();
  try {
    const result = await client.query(`
      UPDATE tasks_table
      SET
        "SnoozedUntil"   = $1,
        "ReminderCount"  = "ReminderCount" + 1
      WHERE "TaskId" = $2 AND "Status" = 'pending'
      RETURNING
        "TaskId"              as task_id,
        "ReminderCount"       as reminder_count,
        "SnoozedUntil"        as snoozed_until
    `, [snoozedUntil, taskId]);

    if (result[0].length === 0) {
      throw new Error('Task not found or not pending');
    }

    logger.info('Task snoozed', { taskId, snoozedUntil });
    return result[0][0];
  } catch (error) {
    logger.error('Error snoozing task', { taskId, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Dismiss reminders for a task for the rest of today.
 * Sets ReminderDismissedToday = true; does NOT change task Status.
 *
 * @param {number} taskId - Task ID.
 * @returns {Promise<Object>} - Updated task row.
 */
async function dismissTaskToday(taskId) {
  const client = await dbPool();
  try {
    const result = await client.query(`
      UPDATE tasks_table
      SET "ReminderDismissedToday" = true
      WHERE "TaskId" = $1 AND "Status" = 'pending'
      RETURNING
        "TaskId"                  as task_id,
        "ReminderDismissedToday"  as reminder_dismissed_today
    `, [taskId]);

    if (result[0].length === 0) {
      throw new Error('Task not found or not pending');
    }

    logger.info('Task reminders dismissed for today', { taskId });
    return result[0][0];
  } catch (error) {
    logger.error('Error dismissing task reminders', { taskId, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Fetch pending tasks whose snooze has expired and that are still eligible
 * for a follow-up reminder (ReminderCount < 2, not dismissed).
 *
 * Used by the background scheduler to trigger second reminders.
 *
 * @param {string} currentDate     - YYYY-MM-DD (IST)
 * @param {string} currentTime     - HH:mm:ss (IST)
 * @param {Date}   currentDateTime - injected clock (snooze expiry)
 * @returns {Promise<Array>}
 */
async function getTasksNeedingReminder(currentDate, currentTime, currentDateTime) {
  const client = await dbPool();
  try {
    const result = await client.query(`
      SELECT
        t."TaskId"                  as task_id,
        t."UserId"                  as user_id,
        t."TaskType"                as task_type,
        t."TaskDate"                as task_date,
        tw."WindowStartTime"        as window_start,
        tw."WindowEndTime"          as window_end,
        t."ReminderCount"           as reminder_count,
        t."SnoozedUntil"            as snoozed_until,
        t."ReminderDismissedToday"  as reminder_dismissed_today,
        t."NotificationSent"        as notification_sent,
        t."Status"                  as status,
        u."PushToken"
      FROM tasks_table t
      JOIN team_table u ON t."UserId"::text = u."UserId"::text
      JOIN activity_time_windows_table tw
        ON tw."ActivityType" = t."TaskType"
       AND tw."EffectiveToDate" IS NULL
      WHERE t."TaskDate"                = $1::date
        AND t."Status"                  = 'pending'
        AND t."ReminderDismissedToday"  = false
        AND t."ReminderCount"           < 2
        AND t."NotificationSent"        = true
        AND (
              t."SnoozedUntil" IS NULL
              OR t."SnoozedUntil" <= $3
            )
        AND $2::time BETWEEN tw."WindowStartTime" AND tw."WindowEndTime"
    `, [currentDate, currentTime, currentDateTime]);

    return result[0];
  } catch (error) {
    logger.error('Error fetching tasks needing reminder', { currentDate, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find today's pending task for a user and task type.
 *
 * @param {number} userId
 * @param {string} taskType
 * @param {string} taskDate  YYYY-MM-DD (IST)
 * @returns {Promise<Object|null>}
 */
async function getPendingTaskForUser(userId, taskType, taskDate) {
  const client = await dbPool();
  try {
    const result = await client.query(`
      SELECT
        "TaskId" as task_id,
        "UserId" as user_id,
        "TaskType" as task_type,
        "TaskDate" as task_date,
        "Status" as status
      FROM tasks_table
      WHERE "UserId"   = $1
        AND "TaskType" = $2
        AND "TaskDate" = $3::date
        AND "Status"   = 'pending'
      LIMIT 1
    `, [userId, taskType, taskDate]);

    return result[0][0] || null;
  } catch (error) {
    logger.error('Error fetching pending task for user', {
      userId, taskType, taskDate, error: error.message,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Upsert a user's rolling average completion time for a task type.
 *
 * Uses an incremental running-average formula so no historical rows are needed:
 *   new_avg = old_avg + (new_value - old_avg) / new_count
 *
 * @param {number} userId           - User ID.
 * @param {string} taskType         - e.g. 'weight', 'breakfast'.
 * @param {string} completionTimeStr - Time string in HH:mm:ss (local wall-clock, already tz-converted).
 * @returns {Promise<Object>}        - Updated average row.
 */
async function upsertTaskAverage(userId, taskType, completionTimeStr) {
  const client = await dbPool();
  try {
    const result = await client.query(`
      INSERT INTO user_task_averages (
        "UserId", "TaskType", "AverageCompletionTime", "SampleCount", "LastCalculatedAt"
      ) VALUES ($1, $2, $3::time, 1, NOW())
      ON CONFLICT ("UserId", "TaskType") DO UPDATE
        SET
          "AverageCompletionTime" = (
            -- incremental running average (stored as epoch seconds, then cast back to time)
            to_timestamp(
              (
                EXTRACT(EPOCH FROM user_task_averages."AverageCompletionTime"::interval)
                + (
                    EXTRACT(EPOCH FROM $3::time::interval)
                    - EXTRACT(EPOCH FROM user_task_averages."AverageCompletionTime"::interval)
                  )
                  / (user_task_averages."SampleCount" + 1)
              )
            )::time
          ),
          "SampleCount"          = user_task_averages."SampleCount" + 1,
          "LastCalculatedAt"     = NOW()
      RETURNING
        "AverageId"             as average_id,
        "UserId"                as user_id,
        "TaskType"              as task_type,
        "AverageCompletionTime" as average_completion_time,
        "SampleCount"           as sample_count
    `, [userId, taskType, completionTimeStr]);

    logger.info('Task average upserted', { userId, taskType, completionTimeStr });
    return result[0][0];
  } catch (error) {
    logger.error('Error upserting task average', { userId, taskType, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find pending tasks where the current time has passed the user's personal
 * average completion time for that task type.
 *
 * Example:
 *   User usually uploads weight at 06:30. Today at 06:31 it is still pending.
 *   → this query returns that task so a personalised reminder can be sent.
 *
 * Guards (all must be true to return a row):
 *   1. Task is pending today.
 *   2. Current time > user's AverageCompletionTime for that TaskType.
 *   3. NotificationSent = true  (first push already sent — this is a follow-up only).
 *   4. ReminderDismissedToday = false.
 *   5. ReminderCount < 2  (cap at 2 reminders per day).
 *   6. SnoozedUntil is NULL or already expired  (respect active snooze).
 *
 * @param {string} currentDate     - YYYY-MM-DD (IST)
 * @param {string} currentTime     - HH:mm:ss (IST wall clock)
 * @param {Date}   currentDateTime - injected clock (for snooze expiry)
 * @returns {Promise<Array>}
 */
async function getTasksPastAverageTime(currentDate, currentTime, currentDateTime) {
  const client = await dbPool();
  try {
    const result = await client.query(`
      SELECT
        t."TaskId"                  AS task_id,
        t."UserId"                  AS user_id,
        t."TaskType"                AS task_type,
        t."TaskDate"                AS task_date,
        tw."WindowStartTime"        AS window_start,
        tw."WindowEndTime"          AS window_end,
        t."ReminderCount"           AS reminder_count,
        t."SnoozedUntil"            AS snoozed_until,
        t."ReminderDismissedToday"  AS reminder_dismissed_today,
        t."Status"                  AS status,
        uta."AverageCompletionTime" AS average_completion_time,
        u."PushToken"
      FROM tasks_table t
      JOIN user_task_averages uta
        ON uta."UserId"   = t."UserId"::integer
       AND uta."TaskType" = t."TaskType"
      JOIN team_table u
        ON u."UserId"::text = t."UserId"::text
      JOIN activity_time_windows_table tw
        ON tw."ActivityType" = t."TaskType"
       AND tw."EffectiveToDate" IS NULL
      WHERE t."TaskDate"               = $1::date
        AND t."Status"                 = 'pending'
        AND t."NotificationSent"       = true
        AND t."ReminderDismissedToday" = false
        AND t."ReminderCount"          < 2
        AND (t."SnoozedUntil" IS NULL OR t."SnoozedUntil" <= $3)
        AND $2::time BETWEEN tw."WindowStartTime" AND tw."WindowEndTime"
        AND $2::time >= uta."AverageCompletionTime"
        AND $2::time <  (uta."AverageCompletionTime"::interval + interval '2 minutes')::time
    `, [currentDate, currentTime, currentDateTime]);

    return result[0];
  } catch (error) {
    logger.error('Error in getTasksPastAverageTime', { currentDate, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * After admin updates activity_time_windows_table, sync today's (and future)
 * pending tasks so stored WindowStart/WindowEnd match the active row.
 *
 * Reminder SQL also JOINs the live table, but this keeps tasks_table consistent.
 *
 * @param {string} activityType  ActivityType value (weight, breakfast, …)
 * @param {string} fromDate      YYYY-MM-DD — usually EffectiveFromDate
 * @returns {Promise<number>}    Rows updated
 */
async function syncPendingTaskWindowsForActivityType(activityType, fromDate) {
  const client = await dbPool();
  try {
    const result = await client.query(`
      UPDATE tasks_table t
      SET
        "WindowStart" = tw."WindowStartTime",
        "WindowEnd"   = tw."WindowEndTime"
      FROM activity_time_windows_table tw
      WHERE tw."ActivityType"    = $1
        AND tw."EffectiveToDate" IS NULL
        AND t."TaskType"         = tw."ActivityType"
        AND t."Status"           = 'pending'
        AND t."TaskDate"        >= $2::date
    `, [activityType, fromDate]);

    const count = result[0]?.affectedRows ?? 0;
    logger.info('Synced pending task windows from activity_time_windows_table', {
      activityType,
      fromDate,
      count,
    });
    return count;
  } catch (error) {
    logger.error('Error syncing pending task windows', {
      activityType,
      fromDate,
      error: error.message,
    });
    throw error;
  } finally {
    client.release();
  }
}

export {
  getTasksByUserAndDate,
  getTasksNeedingNotification,
  createTask,
  completeTask,
  markNotificationSent,
  expireOldTasks,
  getTimeWindowsByUser,
  getTimeWindowsByStartTime,
  // reminder helpers
  snoozeTask,
  dismissTaskToday,
  getTasksNeedingReminder,
  upsertTaskAverage,
  incrementReminderCount,
  getTasksPastAverageTime,
  getPendingTaskForUser,
  syncPendingTaskWindowsForActivityType,
};
