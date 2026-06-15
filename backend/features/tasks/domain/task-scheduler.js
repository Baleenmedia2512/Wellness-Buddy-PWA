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
  getTasksPastAverageTime
} from '../data/task-repo.js';
import { shouldTriggerReminder, isWithinTaskWindow } from './task-rules.js';
import {
  getISTPartsFromDate,
  formatAverageTimeLabel,
  buildPersonalisedReminderBody,
} from './completion-learning.rules.js';
import logger from '../../../shared/lib/logger.js';
import { sendPushNotification } from '../../../shared/services/pushNotificationService.js';

/**
 * Check and create tasks for time windows starting now
 * Should run every minute
 */
async function checkAndCreateTasksForCurrentTime() {
  const now = new Date();
  const { date: currentDate, timeHm: currentTime } = getISTPartsFromDate(now);

  logger.info('Running task creation check', { currentTime, currentDate });
  
  try {
    // Get all time windows starting at current time
    const timeWindows = await getTimeWindowsByStartTime(currentTime);
    
    logger.info(`Found ${timeWindows.length} time windows starting now`);
    
    for (const window of timeWindows) {
      // Create task
      const task = await createTask({
        userId: window.user_id,
        taskType: window.activity_type,
        taskDate: currentDate,
        windowStart: window.start_time,
        windowEnd: window.end_time,
        priority: window.activity_type === 'weight' ? 'high' : 'medium'
      });
      
      if (task) {
        logger.info('Task created for time window', {
          taskId: task.task_id,
          userId: window.user_id,
          taskType: window.activity_type
        });
        
        // Send notification (implement based on your notification system)
        await sendTaskNotification(task, window);
      }
    }
    
    logger.info('Task creation check completed');
  } catch (error) {
    logger.error('Error in task creation check', { error: error.message, stack: error.stack });
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
    // Notification payload
    const notification = {
      title: getNotificationTitle(task.task_type),
      body: getNotificationBody(task.task_type),
      data: {
        action: 'openTaskPanel',
        taskId: task.task_id.toString(),
        taskType: task.task_type,
        userId: task.user_id
      }
    };
    
    logger.info('Sending task notification', {
      taskId: task.task_id,
      userId: task.user_id,
      taskType: task.task_type
    });
    
    // Get user's push token from window data (populated by task-repo query)
    const pushToken = window.PushToken;
    
    if (!pushToken) {
      logger.warn('Cannot send notification: user has no push token', {
        userId: task.user_id
      });
      return;
    }
    
    // Send push notification via Firebase
    const sent = await sendPushNotification(pushToken, notification);
    
    if (sent) {
      // Mark notification as sent in database
      await markNotificationSent(task.task_id);
      logger.info('Task notification sent successfully', {
        taskId: task.task_id,
        userId: task.user_id
      });
    } else {
      logger.error('Failed to send task notification', {
        taskId: task.task_id,
        userId: task.user_id
      });
    }
    
  } catch (error) {
    logger.error('Error sending task notification', {
      taskId: task.task_id,
      error: error.message
    });
  }
}

function getNotificationTitle(taskType) {
  const titles = {
    weight: '⚖️ Time to log your weight!',
    breakfast: '🍳 Time to log breakfast!',
    lunch: '🍽️ Time to log lunch!',
    dinner: '🌙 Time to log dinner!',
    education: '📚 Time to log education!',
    water: '💧 Time to track water!'
  };
  return titles[taskType] || '📋 Task reminder';
}

function getNotificationBody(taskType) {
  const bodies = {
    weight: 'Take a quick photo of your scale',
    breakfast: 'Capture your meal to track nutrition',
    lunch: 'Don\'t forget to log your lunch',
    dinner: 'Log your dinner to complete the day',
    education: 'Record your learning activity',
    water: 'Track your water intake'
  };
  return bodies[taskType] || 'Tap to complete';
}

// ─── Follow-up reminder (second push) ────────────────────────────────────────

/**
 * Check for pending tasks whose snooze has expired and send a follow-up FCM push.
 *
 * Rules enforced by shouldTriggerReminder() (domain layer, pure):
 * - Status must be pending
 * - Not dismissed today
 * - ReminderCount < 2
 * - SnoozedUntil must have passed (or be null)
 *
 * Should run every minute alongside checkAndCreateTasksForCurrentTime().
 */
async function checkAndSendFollowUpReminders() {
  const now = new Date();
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(now);

  logger.info('Running follow-up reminder check', { currentDate, currentTime });

  try {
    const tasks = await getTasksNeedingReminder(currentDate, currentTime, now);

    logger.info(`Found ${tasks.length} tasks eligible for follow-up reminder`);

    for (const task of tasks) {
      // Double-check domain rules with injected clock (defence-in-depth)
      if (!shouldTriggerReminder(task, now)) continue;
      if (!isWithinTaskWindow(task, now)) {
        logger.info('Skipping follow-up reminder — outside window', {
          taskId: task.task_id, taskType: task.task_type,
          window: `${task.window_start}–${task.window_end}`
        });
        continue;
      }

      const pushToken = task.PushToken || task.push_token;
      if (!pushToken) {
        logger.warn('No push token for follow-up reminder', { taskId: task.task_id, userId: task.user_id });
        continue;
      }

      const notification = {
        title: `🔔 Reminder: ${getNotificationTitle(task.task_type)}`,
        body: getNotificationBody(task.task_type),
        data: {
          action: 'openTaskPanel',
          taskId: task.task_id.toString(),
          taskType: task.task_type,
          userId: task.user_id.toString(),
          isFollowUp: 'true'
        }
      };

      const sent = await sendPushNotification(pushToken, notification);

      if (sent) {
        await incrementReminderCount(task.task_id);
        logger.info('Follow-up reminder sent', {
          taskId: task.task_id,
          userId: task.user_id,
          taskType: task.task_type
        });
      } else {
        logger.error('Failed to send follow-up reminder', {
          taskId: task.task_id,
          userId: task.user_id
        });
      }
    }

    logger.info('Follow-up reminder check completed');
  } catch (error) {
    logger.error('Error in follow-up reminder check', { error: error.message, stack: error.stack });
  }
}

// ─── Personalised reminder (past average time) ────────────────────────────────

/**
 * Send a personalised reminder to any user who has NOT yet completed a task
 * and whose personal average completion time for that task has already passed.
 *
 * Example:
 *   User normally uploads weight at 06:30.
 *   Today at 06:31 the weight task is still pending.
 *   → Send: "You usually log your weight around 6:30 AM — still pending!"
 *
 * Runs every minute as part of the cron job.
 * Only fires when user_task_averages has a record (at least 1 past completion).
 */
async function checkAndSendPersonalisedReminders() {
  const now = new Date();
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(now);

  logger.info('Running personalised reminder check', { currentDate, currentTime });

  try {
    const tasks = await getTasksPastAverageTime(currentDate, currentTime, now);

    logger.info(`Found ${tasks.length} tasks past user average time`);

    for (const task of tasks) {
      // Domain rule guard (defence-in-depth)
      if (!shouldTriggerReminder(task, now)) continue;
      if (!isWithinTaskWindow(task, now)) {
        logger.info('Skipping personalised reminder — outside window', {
          taskId: task.task_id, taskType: task.task_type,
          window: `${task.window_start}–${task.window_end}`
        });
        continue;
      }

      const pushToken = task.PushToken || task.push_token;
      if (!pushToken) {
        logger.warn('No push token for personalised reminder', {
          taskId: task.task_id,
          userId: task.user_id
        });
        continue;
      }

      const avgLabel = formatAverageTimeLabel(task.average_completion_time || '');

      const notification = {
        title: `⏰ ${getNotificationTitle(task.task_type)}`,
        body:  buildPersonalisedReminderBody(task.task_type, avgLabel),
        data: {
          action:     'openTaskPanel',
          taskId:     task.task_id.toString(),
          taskType:   task.task_type,
          userId:     task.user_id.toString(),
          isPersonal: 'true'
        }
      };

      const sent = await sendPushNotification(pushToken, notification);

      if (sent) {
        await incrementReminderCount(task.task_id);
        logger.info('Personalised reminder sent', {
          taskId:  task.task_id,
          userId:  task.user_id,
          avgTime: avgLabel
        });
      } else {
        logger.error('Failed to send personalised reminder', {
          taskId: task.task_id,
          userId: task.user_id
        });
      }
    }

    logger.info('Personalised reminder check completed');
  } catch (error) {
    logger.error('Error in personalised reminder check', {
      error: error.message,
      stack: error.stack
    });
  }
}

export {
  checkAndCreateTasksForCurrentTime,
  expirePreviousDayTasks,
  sendTaskNotification,
  checkAndSendFollowUpReminders,
  checkAndSendPersonalisedReminders
};
