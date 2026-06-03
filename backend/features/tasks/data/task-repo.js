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

const { dbPool } = require('../../../utils/dbPool');
const logger = require('../../../shared/lib/logger');

/**
 * Get all tasks for a user on a specific date with status filter
 * 
 * @param {string} userId - User ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} status - Optional status filter ('pending', 'completed', 'missed')
 * @returns {Promise<Array>} - Array of task objects
 */
async function getTasksByUserAndDate(userId, date, status = null) {
  const client = await dbPool();
  
  try {
    let query = `
      SELECT 
        "TaskId" as task_id,
        "UserId" as user_id,
        "TaskType" as task_type,
        "TaskDate" as task_date,
        "Status" as status,
        "Priority" as priority,
        "WindowStart" as window_start,
        "WindowEnd" as window_end,
        "CreatedAt" as created_at,
        "CompletedAt" as completed_at,
        "TaskData" as task_data,
        "CompletionData" as completion_data,
        "NotificationSent" as notification_sent,
        "NotificationSentAt" as notification_sent_at
      FROM tasks_table
      WHERE "UserId" = $1 AND "TaskDate" = $2
    `;
    
    const params = [userId, date];
    
    if (status) {
      query += ` AND "Status" = $3`;
      params.push(status);
    }
    
    query += ` ORDER BY "WindowStart" ASC, "Priority" DESC`;
    
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching tasks', { userId, date, status, error: error.message });
    throw error;
  } finally {
    client.release();
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
        t."WindowStart" as window_start,
        t."WindowEnd" as window_end,
        u."Email",
        u."UserName"
      FROM tasks_table t
      JOIN team_table u ON t."UserId" = u."UserId"::text
      WHERE t."TaskDate" = $1::date
        AND t."Status" = 'pending'
        AND t."NotificationSent" = false
        AND substring(t."WindowStart"::text, 1, 5) = $2
    `, [currentDate, currentTime]);
    
    return result.rows;
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
      ON CONFLICT ("UserId", "TaskType", "TaskDate") DO NOTHING
      RETURNING *
    `, [userId, taskType, taskDate, windowStart, windowEnd, priority, JSON.stringify(taskDataJson)]);
    
    if (result.rows.length > 0) {
      logger.info('Task created', { taskId: result.rows[0].TaskId, userId, taskType, taskDate });
      return result.rows[0];
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
    
    if (result.rows.length > 0) {
      logger.info('Task completed', { taskId, userId: result.rows[0].UserId });
      return result.rows[0];
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
    
    const count = result.rowCount;
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
    
    return result.rows;
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
        u."Status"
      FROM activity_time_windows_table tw
      CROSS JOIN team_table u
      WHERE tw."EffectiveToDate" IS NULL
        AND u."Status" = 'Active'
        AND substring(tw."WindowStartTime"::text, 1, 5) = $1
    `, [startTime]);
    
    return result.rows;
  } catch (error) {
    logger.error('Error fetching time windows by start time', { startTime, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getTasksByUserAndDate,
  getTasksNeedingNotification,
  createTask,
  completeTask,
  markNotificationSent,
  expireOldTasks,
  getTimeWindowsByUser,
  getTimeWindowsByStartTime
};
