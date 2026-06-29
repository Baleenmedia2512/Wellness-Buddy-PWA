/**
 * task-scheduler.js — Cron-like scheduler for task management
 * 
 * Responsibilities:
 * 1. Create tasks when time windows start
 * 2. Send notifications for new tasks
 * 3. Expire old tasks at end of day
 * 
 * Note: In production, this would run as:
 * - Vercel Cron Job
 * - AWS Lambda scheduled event
 * - Kubernetes CronJob
 * 
 * For now, can be triggered via API or scheduled function
 */

import {
  getTimeWindowsByStartTime,
  createTask,
  expireOldTasks,
  getWindowsAlreadyOpenedToday,
} from '../data/task-repo.js';
import {
  getISTPartsFromDate,
} from './completion-learning.rules.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Run daily reset at IST midnight: expire yesterday's pending tasks.
 */
async function runDailyTaskResetIfMidnight() {
  const now = new Date();
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(now);

  // Only run at midnight IST (00:00)
  if (currentTime.substring(0, 5) !== '00:00') {
    return { expired: 0, skipped: true };
  }

  logger.info('Running IST midnight task reset', { currentDate });
  const expired = await expireOldTasks(currentDate);
  return { expired, skipped: false };
}

/**
 * Check and create tasks for time windows starting now.
 * Runs every minute via cron.
 */
async function checkAndCreateTasksForCurrentTime() {
  const now = new Date();
  const { date: currentDate, timeHm: currentTime } = getISTPartsFromDate(now);
  const stats = { windowsFound: 0, tasksCreated: 0, errors: 0 };

  logger.info('Running task creation check', { currentTime, currentDate });

  try {
    const timeWindows = await getTimeWindowsByStartTime(currentTime);
    stats.windowsFound = timeWindows.length;

    for (const window of timeWindows) {
      try {
        const task = await createTask({
          userId: window.user_id,
          taskType: window.activity_type,
          taskDate: currentDate,
          windowStart: window.start_time,
          windowEnd: window.end_time,
          priority: window.activity_type === 'weight' ? 'high' : 'medium',
        });

        if (task) {
          stats.tasksCreated += 1;
          logger.info('Task created for time window', {
            taskId: task.task_id,
            userId: window.user_id,
            taskType: window.activity_type,
          });
        }
      } catch (loopError) {
        stats.errors += 1;
        logger.error('Error creating task for window', {
          userId: window.user_id,
          taskType: window.activity_type,
          error: loopError.message,
        });
      }
    }

    logger.info('Task creation check completed', stats);
    return stats;
  } catch (error) {
    logger.error('Error in task creation check', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Expire tasks from previous days.
 */
async function expirePreviousDayTasks() {
  const { date: today } = getISTPartsFromDate(new Date());
  logger.info('Running task expiration for previous days', { today });
  try {
    const expiredCount = await expireOldTasks(today);
    logger.info(`Expired ${expiredCount} old tasks`);
  } catch (error) {
    logger.error('Error expiring tasks', { error: error.message, stack: error.stack });
  }
}

/**
 * Create tasks for ALL time windows that opened today before now but whose
 * task rows are missing.
 *
 * @param {string|null} userId  Optional — scope to one user (catch-up path)
 * @returns {Promise<number>}  Number of tasks created.
 */
async function createMissingTasksForToday(userId = null) {
  const now = new Date();
  const { date: currentDate, timeHm: currentTime } = getISTPartsFromDate(now);

  logger.info('Running catch-up task creation', { currentDate, currentTime, userId });

  try {
    const windows = await getWindowsAlreadyOpenedToday(currentTime, currentDate, userId);

    logger.info(`Catch-up: ${windows.length} missing task(s) found`);

    let created = 0;
    for (const window of windows) {
      const task = await createTask({
        userId:      window.user_id,
        taskType:    window.activity_type,
        taskDate:    currentDate,
        windowStart: window.start_time,
        windowEnd:   window.end_time,
        priority:    window.activity_type === 'weight' ? 'high' : 'medium',
      });

      if (task) {
        created++;
        logger.info('Catch-up task created', {
          taskId:   task.TaskId ?? task.task_id,
          userId:   window.user_id,
          taskType: window.activity_type,
        });
      }
    }

    logger.info(`Catch-up complete — created ${created} task(s)`);
    return created;
  } catch (error) {
    logger.error('Error in catch-up task creation', {
      error: error.message,
      stack: error.stack,
    });
    return 0;
  }
}

export {
  checkAndCreateTasksForCurrentTime,
  expirePreviousDayTasks,
  runDailyTaskResetIfMidnight,
  createMissingTasksForToday,
};
