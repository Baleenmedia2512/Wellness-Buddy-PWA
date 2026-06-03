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

const { format } = require('date-fns');
const { 
  getTimeWindowsByStartTime,
  createTask,
  markNotificationSent,
  expireOldTasks
} = require('../data/task-repo');
const logger = require('../../../shared/lib/logger');
const { sendPushNotification } = require('../../../shared/services/pushNotificationService');

/**
 * Check and create tasks for time windows starting now
 * Should run every minute
 */
async function checkAndCreateTasksForCurrentTime() {
  const now = new Date();
  const currentTime = format(now, 'HH:mm');
  const currentDate = format(now, 'yyyy-MM-dd');
  
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
  const today = format(new Date(), 'yyyy-MM-dd');
  
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

module.exports = {
  checkAndCreateTasksForCurrentTime,
  expirePreviousDayTasks,
  sendTaskNotification
};
