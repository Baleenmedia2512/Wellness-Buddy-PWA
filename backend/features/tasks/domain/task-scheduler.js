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

import { format } from 'date-fns';
import {
  getTimeWindowsByStartTime,
  createTask,
  markNotificationSent,
  expireOldTasks,
  getTasksNeedingReminder,
  incrementReminderCount,
  getTasksPastAverageTime,
  getPendingTasksNeedingInitialNotification,
  getTasksAtWindowStartMinute,
  getWindowsAlreadyOpenedToday,
} from '../data/task-repo.js';
import { shouldTriggerReminder, isWithinTaskWindow } from './task-rules.js';
import {
  getISTPartsFromDate,
  formatAverageTimeLabel,
  buildPersonalisedReminderBody,
  buildSecondReminderBody,
  buildWindowStartReminderBody,
  buildGroupedPendingTasksBody,
  getReminderTitle,
  isAtReminderMinute,
} from './completion-learning.rules.js';
import logger from '../../../shared/lib/logger.js';
import { sendPushNotification } from '../../../shared/services/pushNotificationService.js';

/**
 * Group tasks by user and send one notification per user when multiple are eligible.
 * Returns stats { sent, errors, grouped }.
 */
async function sendNotificationsGrouped(tasks, buildNotificationForTask, markSent) {
  const stats = { sent: 0, errors: 0, grouped: 0 };
  const byUser = new Map();

  for (const task of tasks) {
    const key = `${task.user_id}:${task.PushToken || task.push_token || ''}`;
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(task);
  }

  for (const [, userTasks] of byUser) {
    const pushToken = userTasks[0].PushToken || userTasks[0].push_token;
    if (!pushToken) continue;

    try {
      if (userTasks.length === 1) {
        const task = userTasks[0];
        const notification = buildNotificationForTask(task);
        const sent = await sendPushNotification(pushToken, notification);
        if (sent) {
          await markSent(task);
          stats.sent += 1;
        } else {
          stats.errors += 1;
        }
        continue;
      }

      stats.grouped += 1;
      const notification = {
        title: 'Wellness Tasks Pending',
        body:  buildGroupedPendingTasksBody(userTasks.length),
        data: {
          action:     'openTaskPanel',
          userId:     userTasks[0].user_id.toString(),
          taskCount:  String(userTasks.length),
          isGrouped:  'true',
        },
      };

      const sent = await sendPushNotification(pushToken, notification);
      if (sent) {
        for (const task of userTasks) {
          await markSent(task);
        }
        stats.sent += userTasks.length;
      } else {
        stats.errors += userTasks.length;
      }
    } catch (error) {
      stats.errors += userTasks.length;
      logger.error('Error sending grouped notification', {
        userId: userTasks[0].user_id,
        error: error.message,
      });
    }
  }

  return stats;
}

/**
 * Run daily reset at IST midnight: expire yesterday's pending tasks.
 */
async function runDailyTaskResetIfMidnight() {
  const now = new Date();
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(now);

  if (!isAtReminderMinute(currentTime, '00:00:00')) {
    return { expired: 0, skipped: true };
  }

  logger.info('Running IST midnight task reset', { currentDate });
  const expired = await expireOldTasks(currentDate);
  return { expired, skipped: false };
}

/**
 * Check and create tasks for time windows starting now
 * Should run every minute
 */
async function checkAndCreateTasksForCurrentTime() {
  const now = new Date();
  const { date: currentDate, timeHm: currentTime } = getISTPartsFromDate(now);
  const stats = { windowsFound: 0, tasksCreated: 0, notificationsSent: 0, errors: 0 };

  logger.info('Running task creation check', { currentTime, currentDate, transport: 'supabase-rest' });

  try {
    const timeWindows = await getTimeWindowsByStartTime(currentTime);
    stats.windowsFound = timeWindows.length;

    logger.info(`Found ${timeWindows.length} time windows starting now`);

    // Collect initial-notification promises so DB writes finish first (sequential)
    // but FCM sends run in parallel (fire-and-forget) after the loop.
    const notificationPromises = [];

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

          // Send initial FCM push immediately for every newly created task.
          // NotificationSent guards against double-sends if createTask returned
          // an existing pending row that was already notified.
          if (!task.NotificationSent) {
            notificationPromises.push(
              sendTaskNotification(task, window)
                .then((sent) => {
                  if (sent) {
                    stats.notificationsSent += 1;
                    logger.info('Initial task notification sent', {
                      taskId: task.task_id,
                      userId: window.user_id,
                      taskType: window.activity_type,
                    });
                  }
                })
                .catch((err) => {
                  stats.errors += 1;
                  logger.error('Initial task notification failed', {
                    taskId: task.task_id,
                    userId: window.user_id,
                    error: err.message,
                  });
                }),
            );
          }
        }
      } catch (loopError) {
        stats.errors += 1;
        logger.error('Error creating/sending task for window', {
          userId: window.user_id,
          taskType: window.activity_type,
          error: loopError.message,
        });
      }
    }

    // Wait for all FCM sends to settle before returning stats.
    await Promise.all(notificationPromises);

    logger.info('Task creation check completed', stats);
    return stats;
  } catch (error) {
    logger.error('Error in task creation check', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Expire tasks from previous days
 * Should run once daily at midnight
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
 * Send notification for a task
 * Sends push notification via Firebase Cloud Messaging
 */
async function sendTaskNotification(task, window) {
  try {
    const notification = {
      title: getReminderTitle(task.task_type),
      body: buildWindowStartReminderBody(task.task_type),
      data: {
        action: 'openTaskPanel',
        taskId: task.task_id.toString(),
        taskType: task.task_type,
        userId: task.user_id,
        isWindowStart: 'true',
      },
    };

    logger.info('Sending window-start task notification', {
      taskId: task.task_id,
      userId: task.user_id,
      taskType: task.task_type,
    });

    const pushToken = window.PushToken || task.PushToken;

    if (!pushToken) {
      logger.warn('Cannot send notification: user has no push token', {
        userId: task.user_id,
      });
      return false;
    }

    const sent = await sendPushNotification(pushToken, notification);

    if (sent) {
      await markNotificationSent(task.task_id);
      logger.info('Window-start notification sent successfully', {
        taskId: task.task_id,
        userId: task.user_id,
      });
      return true;
    }

    logger.error('Failed to send window-start notification', {
      taskId: task.task_id,
      userId: task.user_id,
    });
    return false;
  } catch (error) {
    logger.error('Error sending window-start notification', {
      taskId: task.task_id,
      error: error.message,
    });
    return false;
  }
}

function getNotificationTitle(taskType) {
  return getReminderTitle(taskType);
}

function getNotificationBody(taskType) {
  return buildWindowStartReminderBody(taskType);
}

// ─── Reminder 2 (average + 30 minutes) ───────────────────────────────────────

/**
 * Send reminder 2 for pending tasks exactly 30 minutes after the user's
 * average completion time (reminder 1 must have already been sent).
 */
async function checkAndSendFollowUpReminders() {
  const now = new Date();
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(now);
  const stats = { eligible: 0, sent: 0, skipped: 0, errors: 0, grouped: 0 };

  logger.info('Running follow-up reminder check', { currentDate, currentTime });

  try {
    const tasks = await getTasksNeedingReminder(currentDate, currentTime, now);
    const eligible = tasks.filter((task) => {
      if (!shouldTriggerReminder(task, now)) { stats.skipped += 1; return false; }
      if (!isWithinTaskWindow(task, now)) {
        stats.skipped += 1;
        return false;
      }
      if (!(task.PushToken || task.push_token)) {
        stats.skipped += 1;
        return false;
      }
      return true;
    });

    stats.eligible = eligible.length;
    logger.info(`Found ${eligible.length} tasks eligible for follow-up reminder`);

    const groupStats = await sendNotificationsGrouped(
      eligible,
      (task) => ({
        title: getReminderTitle(task.task_type),
        body:  buildSecondReminderBody(task.task_type),
        data: {
          action:     'openTaskPanel',
          taskId:     task.task_id.toString(),
          taskType:   task.task_type,
          userId:     task.user_id.toString(),
          isFollowUp: 'true',
        },
      }),
      async (task) => {
        await incrementReminderCount(task.task_id);
        logger.info('Follow-up reminder sent', {
          taskId: task.task_id,
          userId: task.user_id,
          taskType: task.task_type,
        });
      },
    );

    stats.sent = groupStats.sent;
    stats.errors = groupStats.errors;
    stats.grouped = groupStats.grouped;

    logger.info('Follow-up reminder check completed', stats);
    return stats;
  } catch (error) {
    logger.error('Error in follow-up reminder check', { error: error.message, stack: error.stack });
    throw error;
  }
}

// ─── Reminder 1 (personalised average time) ─────────────────────────────────

/**
 * Send reminder 1 at the user's learned average completion time when the task
 * is still pending. Requires at least one past completion (user_task_averages).
 */
async function checkAndSendPersonalisedReminders() {
  const now = new Date();
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(now);
  const stats = { eligible: 0, sent: 0, skipped: 0, errors: 0, grouped: 0 };

  logger.info('Running personalised reminder check', { currentDate, currentTime });

  try {
    const tasks = await getTasksPastAverageTime(currentDate, currentTime, now);
    const eligible = tasks.filter((task) => {
      if (!shouldTriggerReminder(task, now)) { stats.skipped += 1; return false; }
      if (!isWithinTaskWindow(task, now)) {
        stats.skipped += 1;
        return false;
      }
      if (!(task.PushToken || task.push_token)) {
        stats.skipped += 1;
        return false;
      }
      return true;
    });

    stats.eligible = eligible.length;
    logger.info(`Found ${eligible.length} tasks at personalised reminder time`);

    const groupStats = await sendNotificationsGrouped(
      eligible,
      (task) => {
        const avgLabel = formatAverageTimeLabel(
          task.average_completion_time || task.effective_reminder_time || '',
        );
        return {
          title: getReminderTitle(task.task_type),
          body:  buildPersonalisedReminderBody(task.task_type, avgLabel),
          data: {
            action:     'openTaskPanel',
            taskId:     task.task_id.toString(),
            taskType:   task.task_type,
            userId:     task.user_id.toString(),
            isPersonal: 'true',
          },
        };
      },
      async (task) => {
        await incrementReminderCount(task.task_id);
        logger.info('Personalised reminder sent', {
          taskId: task.task_id,
          userId: task.user_id,
          taskType: task.task_type,
        });
      },
    );

    stats.sent = groupStats.sent;
    stats.errors = groupStats.errors;
    stats.grouped = groupStats.grouped;

    logger.info('Personalised reminder check completed', stats);
    return stats;
  } catch (error) {
    logger.error('Error in personalised reminder check', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// ─── Window-start reminder (existing system) ─────────────────────────────────

/**
 * Send window-start notifications when an activity window opens.
 * Uses NotificationSent flag (WindowStartReminderSent equivalent).
 */
async function checkAndSendWindowStartReminders() {
  const now = new Date();
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(now);
  const stats = { eligible: 0, sent: 0, skipped: 0, errors: 0, grouped: 0 };

  logger.info('Running window-start reminder check', { currentDate, currentTime });

  try {
    const tasks = await getTasksAtWindowStartMinute(currentDate, currentTime);
    stats.eligible = tasks.length;

    const groupStats = await sendNotificationsGrouped(
      tasks,
      (task) => ({
        title: getReminderTitle(task.task_type),
        body:  buildWindowStartReminderBody(task.task_type),
        data: {
          action:        'openTaskPanel',
          taskId:        task.task_id.toString(),
          taskType:      task.task_type,
          userId:        task.user_id.toString(),
          isWindowStart: 'true',
        },
      }),
      async (task) => {
        await markNotificationSent(task.task_id);
        logger.info('Window-start reminder sent', {
          taskId: task.task_id,
          userId: task.user_id,
          taskType: task.task_type,
        });
      },
    );

    stats.sent = groupStats.sent;
    stats.errors = groupStats.errors;
    stats.grouped = groupStats.grouped;

    logger.info('Window-start reminder check completed', stats);
    return stats;
  } catch (error) {
    logger.error('Error in window-start reminder check', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// ─── Catch-up: create tasks missed by cron ───────────────────────────────────

/**
 * Send the first FCM push for pending tasks whose window is already open but
 * NotificationSent is still false (catch-up rows, missed cron minute, etc.).
 */
async function checkAndSendMissedInitialNotifications(userId = null) {
  const now = new Date();
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(now);
  const stats = { eligible: 0, sent: 0, errors: 0 };

  logger.info('Running missed initial notification check', { currentDate, currentTime, userId });

  try {
    const tasks = await getPendingTasksNeedingInitialNotification(currentDate, currentTime, userId);
    stats.eligible = tasks.length;

    for (const task of tasks) {
      const sent = await sendTaskNotification(task, task);
      if (sent) stats.sent += 1;
      else stats.errors += 1;
    }

    logger.info('Missed initial notification check completed', stats);
    return stats;
  } catch (error) {
    logger.error('Error in missed initial notification check', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Create tasks for ALL time windows that opened today before now but whose
 * task rows are missing (cron was down, cold-start missed, Vercel free-tier
 * gap, etc.).
 *
 * Does NOT send a push notification when called alone — use
 * checkAndSendMissedInitialNotifications() in the same cron tick.
 * (createTask uses ON CONFLICT DO NOTHING for existing rows).
 *
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
  sendTaskNotification,
  checkAndSendFollowUpReminders,
  checkAndSendPersonalisedReminders,
  checkAndSendWindowStartReminders,
  checkAndSendMissedInitialNotifications,
  createMissingTasksForToday,
};
