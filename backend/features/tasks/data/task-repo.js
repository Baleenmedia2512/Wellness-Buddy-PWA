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

// ─── Supabase REST helpers (cron hot path — no DATABASE_URL required) ─────────

function timeHm(timeStr) {
  return String(timeStr ?? '').substring(0, 5);
}

function isTimeInRange(currentTime, windowStart, windowEnd) {
  return currentTime >= windowStart && currentTime <= windowEnd;
}

function addSecondsToTime(timeStr, seconds) {
  const parts = String(timeStr).split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  let total = h * 3600 + m * 60 + s + seconds;
  total = ((total % 86400) + 86400) % 86400;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function timeToSeconds(timeStr) {
  const parts = String(timeStr).split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

function secondsToTime(totalSeconds) {
  let total = ((totalSeconds % 86400) + 86400) % 86400;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function mapCreatedTaskRow(row) {
  if (!row) return null;
  return {
    ...row,
    task_id:   row.TaskId,
    user_id:   String(row.UserId),
    task_type: row.TaskType,
  };
}

async function fetchActiveTimeWindows(supabase) {
  const { data, error } = await supabase
    .from('activity_time_windows_table')
    .select('ActivityType, WindowStartTime, WindowEndTime, EffectiveFromDate, EffectiveToDate')
    .is('EffectiveToDate', null)
    .order('WindowStartTime');
  if (error) throw error;
  return data || [];
}

async function fetchActiveMembers(supabase) {
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, Email, UserName, Status, PushToken')
    .eq('Status', 'Active');
  if (error) throw error;
  return data || [];
}

function crossJoinWindowsWithMembers(windows, members) {
  const result = [];
  for (const tw of windows) {
    for (const u of members) {
      result.push({
        activity_type: tw.ActivityType,
        start_time:    tw.WindowStartTime,
        end_time:      tw.WindowEndTime,
        user_id:       String(u.UserId),
        Email:         u.Email,
        UserName:      u.UserName,
        Status:        u.Status,
        PushToken:     u.PushToken,
      });
    }
  }
  return result;
}

/**
 * Get all tasks for a user on a specific date with status filter.
 * Uses Supabase REST (same transport as /api/admin/time-windows).
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
  const supabase = getSupabaseClient();

  try {
    const {
      userId,
      taskType,
      taskDate,
      windowStart,
      windowEnd,
      priority = 'medium',
      taskDataJson = {},
    } = taskData;

    const { data: existing, error: findError } = await supabase
      .from('tasks_table')
      .select('*')
      .eq('UserId', String(userId))
      .eq('TaskType', taskType)
      .eq('TaskDate', taskDate)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      if (existing.Status !== 'pending') return null;

      const { data: updated, error: updateError } = await supabase
        .from('tasks_table')
        .update({ WindowStart: windowStart, WindowEnd: windowEnd })
        .eq('TaskId', existing.TaskId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      logger.info('Task created', { taskId: updated.TaskId, userId, taskType, taskDate });
      return mapCreatedTaskRow(updated);
    }

    const { data: inserted, error: insertError } = await supabase
      .from('tasks_table')
      .insert({
        UserId:      String(userId),
        TaskType:    taskType,
        TaskDate:    taskDate,
        WindowStart: windowStart,
        WindowEnd:   windowEnd,
        Priority:    priority,
        TaskData:    taskDataJson,
        Status:      'pending',
      })
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505') return null;
      throw insertError;
    }

    logger.info('Task created', { taskId: inserted.TaskId, userId, taskType, taskDate });
    return mapCreatedTaskRow(inserted);
  } catch (error) {
    logger.error('Error creating task', { taskData, error: error.message });
    throw error;
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
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks_table')
      .update({
        Status:         'completed',
        CompletedAt:    new Date().toISOString(),
        CompletionData: completionData,
      })
      .eq('TaskId', taskId)
      .eq('Status', 'pending')
      .select('*')
      .single();

    if (error || !data) {
      throw new Error('Task not found or already completed');
    }

    logger.info('Task completed', { taskId, userId: data.UserId });
    return data;
  } catch (error) {
    logger.error('Error completing task', { taskId, error: error.message });
    throw error;
  }
}

/**
 * Mark notification as sent for a task
 * 
 * @param {number} taskId - Task ID
 * @returns {Promise<void>}
 */
async function markNotificationSent(taskId) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('tasks_table')
      .update({
        NotificationSent:   true,
        NotificationSentAt: new Date().toISOString(),
      })
      .eq('TaskId', taskId);

    if (error) throw error;
    logger.info('Notification marked as sent', { taskId });
  } catch (error) {
    logger.error('Error marking notification sent', { taskId, error: error.message });
    throw error;
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
  try {
    const supabase = getSupabaseClient();
    const windows = await fetchActiveTimeWindows(supabase);
    return windows.map((w) => ({
      activity_type:  w.ActivityType,
      start_time:     w.WindowStartTime,
      end_time:       w.WindowEndTime,
      effective_from: w.EffectiveFromDate,
      effective_to:   w.EffectiveToDate,
    }));
  } catch (error) {
    logger.error('Error fetching time windows', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get all time windows that have already opened today (start_time <= currentTime)
 * but whose tasks do NOT yet exist for the given user+date.
 *
 * Used by the catch-up scheduler when the normal per-minute cron was missed.
 *
 * @param {string} currentTime  HH:mm (IST)
 * @param {string} currentDate  YYYY-MM-DD (IST)
 * @returns {Promise<Array>}    Rows: { activity_type, start_time, end_time, user_id, PushToken, ... }
 */
async function getWindowsAlreadyOpenedToday(currentTime, currentDate, userId = null) {
  try {
    const supabase = getSupabaseClient();
    const [windows, members] = await Promise.all([
      fetchActiveTimeWindows(supabase),
      fetchActiveMembers(supabase),
    ]);

    const scopedMembers = userId
      ? members.filter((u) => String(u.UserId) === String(userId))
      : members;

    const { data: existingTasks, error } = await supabase
      .from('tasks_table')
      .select('UserId, TaskType')
      .eq('TaskDate', currentDate);

    if (error) throw error;

    const existingKeys = new Set(
      (existingTasks || []).map((t) => `${String(t.UserId)}:${t.TaskType}`),
    );

    const openedWindows = windows.filter((w) => timeHm(w.WindowStartTime) <= currentTime);
    const rows = crossJoinWindowsWithMembers(openedWindows, scopedMembers);

    return rows.filter((row) => !existingKeys.has(`${row.user_id}:${row.activity_type}`));
  } catch (error) {
    logger.error('Error fetching opened windows without tasks', {
      currentTime, currentDate, error: error.message,
    });
    throw error;
  }
}

/**
 * Get all active time windows starting at a specific time
 * 
 * @param {string} startTime - Start time in HH:mm format
 * @returns {Promise<Array>} - Array of time windows with user info (all active users get same windows)
 */
async function getTimeWindowsByStartTime(startTime) {
  try {
    const supabase = getSupabaseClient();
    const [windows, members] = await Promise.all([
      fetchActiveTimeWindows(supabase),
      fetchActiveMembers(supabase),
    ]);

    const matching = windows.filter((w) => timeHm(w.WindowStartTime) === startTime);
    return crossJoinWindowsWithMembers(matching, members);
  } catch (error) {
    logger.error('Error fetching time windows by start time', { startTime, error: error.message });
    throw error;
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
  try {
    const supabase = getSupabaseClient();
    const { data: row, error: readError } = await supabase
      .from('tasks_table')
      .select('ReminderCount')
      .eq('TaskId', taskId)
      .single();

    if (readError) throw readError;

    const { error: updateError } = await supabase
      .from('tasks_table')
      .update({ ReminderCount: (row?.ReminderCount ?? 0) + 1 })
      .eq('TaskId', taskId);

    if (updateError) throw updateError;
    logger.info('Reminder count incremented', { taskId });
  } catch (error) {
    logger.error('Error incrementing reminder count', { taskId, error: error.message });
    throw error;
  }
}

/**
 * Snooze a task — sets SnoozedUntil and increments ReminderCount.
 *
 * @param {number} taskId      - Task ID.
 * @param {Date}   snoozedUntil - Expiry timestamp returned by calculateSnoozeExpiry().
 * @returns {Promise<Object>}   - Updated task row.
 */
async function snoozeTask(taskId, snoozedUntil, userId) {
  try {
    const supabase = getSupabaseClient();
    const { data: row, error: readError } = await supabase
      .from('tasks_table')
      .select('ReminderCount')
      .eq('TaskId', taskId)
      .eq('UserId', String(userId))
      .eq('Status', 'pending')
      .single();

    if (readError || !row) {
      throw new Error('Task not found or not pending');
    }

    const { data, error } = await supabase
      .from('tasks_table')
      .update({
        SnoozedUntil:  snoozedUntil.toISOString(),
        ReminderCount: (row.ReminderCount ?? 0) + 1,
      })
      .eq('TaskId', taskId)
      .eq('UserId', String(userId))
      .eq('Status', 'pending')
      .select('TaskId, ReminderCount, SnoozedUntil')
      .single();

    if (error || !data) {
      throw new Error('Task not found or not pending');
    }

    logger.info('Task snoozed', { taskId, snoozedUntil, userId });
    return {
      task_id:        data.TaskId,
      reminder_count: data.ReminderCount,
      snoozed_until:  data.SnoozedUntil,
    };
  } catch (error) {
    logger.error('Error snoozing task', { taskId, userId, error: error.message });
    throw error;
  }
}

/**
 * Dismiss reminders for a task for the rest of today.
 * Sets ReminderDismissedToday = true; does NOT change task Status.
 *
 * @param {number} taskId - Task ID.
 * @returns {Promise<Object>} - Updated task row.
 */
async function dismissTaskToday(taskId, userId) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks_table')
      .update({ ReminderDismissedToday: true })
      .eq('TaskId', taskId)
      .eq('UserId', String(userId))
      .eq('Status', 'pending')
      .select('TaskId, ReminderDismissedToday')
      .single();

    if (error || !data) {
      throw new Error('Task not found or not pending');
    }

    logger.info('Task reminders dismissed for today', { taskId, userId });
    return {
      task_id:                  data.TaskId,
      reminder_dismissed_today: data.ReminderDismissedToday,
    };
  } catch (error) {
    logger.error('Error dismissing task reminders', { taskId, userId, error: error.message });
    throw error;
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
  try {
    const supabase = getSupabaseClient();
    const [windows, members] = await Promise.all([
      fetchActiveTimeWindows(supabase),
      fetchActiveMembers(supabase),
    ]);

    const windowsByType = Object.fromEntries(windows.map((w) => [w.ActivityType, w]));
    const memberByUser  = Object.fromEntries(members.map((m) => [String(m.UserId), m]));

    const { data: tasks, error } = await supabase
      .from('tasks_table')
      .select('*')
      .eq('TaskDate', currentDate)
      .eq('Status', 'pending')
      .eq('ReminderDismissedToday', false)
      .eq('NotificationSent', true);

    if (error) throw error;

    return (tasks || [])
      .filter((t) => {
        if ((t.ReminderCount ?? 0) >= 2) return false;
        if (t.SnoozedUntil && new Date(t.SnoozedUntil) > currentDateTime) return false;
        const tw = windowsByType[t.TaskType];
        if (!tw || !isTimeInRange(currentTime, tw.WindowStartTime, tw.WindowEndTime)) return false;
        return Boolean(memberByUser[String(t.UserId)]?.PushToken);
      })
      .map((t) => {
        const tw     = windowsByType[t.TaskType];
        const member = memberByUser[String(t.UserId)];
        return {
          task_id:                  t.TaskId,
          user_id:                  String(t.UserId),
          task_type:                t.TaskType,
          task_date:                t.TaskDate,
          window_start:             tw.WindowStartTime,
          window_end:               tw.WindowEndTime,
          reminder_count:           t.ReminderCount,
          snoozed_until:            t.SnoozedUntil,
          reminder_dismissed_today: t.ReminderDismissedToday,
          notification_sent:        t.NotificationSent,
          status:                   t.Status,
          PushToken:                member.PushToken,
        };
      });
  } catch (error) {
    logger.error('Error fetching tasks needing reminder', { currentDate, error: error.message });
    throw error;
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
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks_table')
      .select('TaskId, UserId, TaskType, TaskDate, Status')
      .eq('UserId', String(userId))
      .eq('TaskType', taskType)
      .eq('TaskDate', taskDate)
      .eq('Status', 'pending')
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      task_id:   data.TaskId,
      user_id:   String(data.UserId),
      task_type: data.TaskType,
      task_date: data.TaskDate,
      status:    data.Status,
    };
  } catch (error) {
    logger.error('Error fetching pending task for user', {
      userId, taskType, taskDate, error: error.message,
    });
    throw error;
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
  try {
    const supabase = getSupabaseClient();
    const { data: existing, error: findError } = await supabase
      .from('user_task_averages')
      .select('AverageId, UserId, TaskType, AverageCompletionTime, SampleCount')
      .eq('UserId', userId)
      .eq('TaskType', taskType)
      .maybeSingle();

    if (findError) throw findError;

    const now = new Date().toISOString();

    if (!existing) {
      const { data, error } = await supabase
        .from('user_task_averages')
        .insert({
          UserId:                  userId,
          TaskType:                taskType,
          AverageCompletionTime:   completionTimeStr,
          SampleCount:             1,
          LastCalculatedAt:        now,
        })
        .select('AverageId, UserId, TaskType, AverageCompletionTime, SampleCount')
        .single();

      if (error) throw error;
      logger.info('Task average upserted', { userId, taskType, completionTimeStr });
      return {
        average_id:              data.AverageId,
        user_id:                 data.UserId,
        task_type:               data.TaskType,
        average_completion_time: data.AverageCompletionTime,
        sample_count:            data.SampleCount,
      };
    }

    const count  = (existing.SampleCount ?? 0) + 1;
    const oldSec = timeToSeconds(existing.AverageCompletionTime);
    const newSec = timeToSeconds(completionTimeStr);
    const avgSec = oldSec + (newSec - oldSec) / count;

    const { data, error } = await supabase
      .from('user_task_averages')
      .update({
        AverageCompletionTime: secondsToTime(avgSec),
        SampleCount:           count,
        LastCalculatedAt:      now,
      })
      .eq('UserId', userId)
      .eq('TaskType', taskType)
      .select('AverageId, UserId, TaskType, AverageCompletionTime, SampleCount')
      .single();

    if (error) throw error;
    logger.info('Task average upserted', { userId, taskType, completionTimeStr });
    return {
      average_id:              data.AverageId,
      user_id:                 data.UserId,
      task_type:               data.TaskType,
      average_completion_time: data.AverageCompletionTime,
      sample_count:            data.SampleCount,
    };
  } catch (error) {
    logger.error('Error upserting task average', { userId, taskType, error: error.message });
    throw error;
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
  try {
    const supabase = getSupabaseClient();
    const [windows, members, averagesResult] = await Promise.all([
      fetchActiveTimeWindows(supabase),
      fetchActiveMembers(supabase),
      supabase.from('user_task_averages').select('UserId, TaskType, AverageCompletionTime'),
    ]);

    if (averagesResult.error) throw averagesResult.error;

    const { data: tasks, error } = await supabase
      .from('tasks_table')
      .select('*')
      .eq('TaskDate', currentDate)
      .eq('Status', 'pending')
      .eq('NotificationSent', true)
      .eq('ReminderDismissedToday', false);

    if (error) throw error;

    const windowsByType = Object.fromEntries(windows.map((w) => [w.ActivityType, w]));
    const memberByUser  = Object.fromEntries(members.map((m) => [String(m.UserId), m]));
    const avgKey        = (uid, type) => `${uid}:${type}`;
    const avgMap        = Object.fromEntries(
      (averagesResult.data || []).map((a) => [avgKey(String(a.UserId), a.TaskType), a.AverageCompletionTime]),
    );

    return (tasks || [])
      .filter((t) => {
        if ((t.ReminderCount ?? 0) >= 2) return false;
        if (t.SnoozedUntil && new Date(t.SnoozedUntil) > currentDateTime) return false;
        const avg = avgMap[avgKey(String(t.UserId), t.TaskType)];
        if (!avg) return false;
        const tw = windowsByType[t.TaskType];
        if (!tw || !isTimeInRange(currentTime, tw.WindowStartTime, tw.WindowEndTime)) return false;
        if (currentTime < avg) return false;
        if (currentTime >= addSecondsToTime(avg, 300)) return false;
        return Boolean(memberByUser[String(t.UserId)]?.PushToken);
      })
      .map((t) => {
        const tw     = windowsByType[t.TaskType];
        const member = memberByUser[String(t.UserId)];
        return {
          task_id:                  t.TaskId,
          user_id:                  String(t.UserId),
          task_type:                t.TaskType,
          task_date:                t.TaskDate,
          window_start:             tw.WindowStartTime,
          window_end:               tw.WindowEndTime,
          reminder_count:           t.ReminderCount,
          snoozed_until:            t.SnoozedUntil,
          reminder_dismissed_today: t.ReminderDismissedToday,
          status:                   t.Status,
          average_completion_time:  avgMap[avgKey(String(t.UserId), t.TaskType)],
          PushToken:                member.PushToken,
        };
      });
  } catch (error) {
    logger.error('Error in getTasksPastAverageTime', { currentDate, error: error.message });
    throw error;
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

/**
 * Fetch all learned average completion times for a user.
 *
 * Used by the frontend reminderService to personalise native alarm times.
 *
 * @param {number} userId
 * @returns {Promise<Array<{ task_type, average_completion_time, sample_count }>>}
 */
async function getUserTaskAverages(userId) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_task_averages')
      .select('TaskType, AverageCompletionTime, SampleCount')
      .eq('UserId', userId);

    if (error) throw error;

    return (data || []).map((row) => ({
      task_type:               row.TaskType,
      average_completion_time: row.AverageCompletionTime,
      sample_count:            row.SampleCount,
    }));
  } catch (error) {
    logger.error('Error fetching user task averages', { userId, error: error.message });
    throw error;
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
  getWindowsAlreadyOpenedToday,
  // reminder helpers
  snoozeTask,
  dismissTaskToday,
  getTasksNeedingReminder,
  upsertTaskAverage,
  incrementReminderCount,
  getTasksPastAverageTime,
  getPendingTaskForUser,
  getUserTaskAverages,
  syncPendingTaskWindowsForActivityType,
};
