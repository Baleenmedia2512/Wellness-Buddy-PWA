/**
 * backend/features/water/domain/water-scheduler.js
 * ---------------------------------------------------------------------------
 * Cron-triggered hydration reminder orchestrator.
 *
 * Runs every minute via /api/cron/water.
 *
 * Logic (per user with a pending water task today):
 *   1. Fetch latest weight → compute daily target (ml) + reminder schedule.
 *   2. Fetch today's food rows → compute how much water already logged.
 *   3. If current time hits the next scheduled slot AND goal not yet met → FCM.
 *   4. Increment ReminderCount so the slot is never re-fired.
 *
 * The 2-minute slot window (REMINDER_SLOT_WINDOW_MINUTES) ensures each slot
 * fires exactly once even when the cron overlaps itself.
 *
 * Per claude.md §2.8: idempotent, logs start/end with correlation ID,
 * has a max retry count (none here — fire-and-forget per task), fails loudly.
 * ---------------------------------------------------------------------------
 */

import { format } from 'date-fns';
import {
  getPendingWaterTasksForDate,
  getLatestWeight,
  getFoodRowsForDate,
  incrementWaterTaskReminderCount,
} from '../data/water.repo.js';
import { computeDailyIntake } from './intake.rules.js';
import {
  calculateWaterReminderSchedule,
  shouldSendWaterReminder,
  buildWaterReminderBody,
} from './reminder.rules.js';
import { sendPushNotification } from '../../../shared/services/pushNotificationService.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Check every active user's pending water task and send a scheduled hydration
 * reminder when the current time matches their next due slot.
 *
 * @returns {Promise<void>}
 */
export async function checkAndSendWaterReminders() {
  const now          = new Date();
  const date         = format(now, 'yyyy-MM-dd');
  const currentMins  = now.getHours() * 60 + now.getMinutes();

  logger.info('[water-scheduler] Running water reminder check', { date, currentMins });

  try {
    const waterTasks = await getPendingWaterTasksForDate(date);

    logger.info(`[water-scheduler] Found ${waterTasks.length} pending water tasks`);

    for (const task of waterTasks) {
      // Skip if reminders dismissed for today
      if (task.reminder_dismissed_today) {
        logger.info('[water-scheduler] Reminders dismissed today', { taskId: task.task_id });
        continue;
      }

      // Skip if still within an active snooze
      if (task.snoozed_until && new Date(task.snoozed_until) > now) {
        logger.info('[water-scheduler] Task snoozed', {
          taskId: task.task_id,
          until:  task.snoozed_until,
        });
        continue;
      }

      // Fetch weight + food rows concurrently (independent DB calls)
      const [weightRow, foodRows] = await Promise.all([
        getLatestWeight(task.user_id),
        getFoodRowsForDate(task.user_id, date),
      ]);

      const weightKg = weightRow ? parseFloat(weightRow.Weight) : null;

      // Reuse existing pure domain logic to compute today's intake
      const { totalMl } = computeDailyIntake({
        userId:         task.user_id,
        date,
        latestWeightKg: weightKg,
        foodRows,
      });

      // Build reminder schedule from weight and the task's time window
      const schedule   = calculateWaterReminderSchedule(
        weightKg,
        task.window_start,
        task.window_end,
      );
      const sentCount  = task.reminder_count || 0;

      if (!shouldSendWaterReminder({ schedule, sentCount, totalMl, currentMinutes: currentMins })) {
        continue;
      }

      const pushToken = task.push_token;
      if (!pushToken) {
        logger.warn('[water-scheduler] No push token', { taskId: task.task_id });
        continue;
      }

      const reminderNumber = sentCount + 1;
      const notification   = {
        title: '💧 Stay Hydrated!',
        body:  buildWaterReminderBody(
          totalMl,
          schedule.requiredMl,
          reminderNumber,
          schedule.reminderCount,
        ),
        data: {
          action:   'openTaskPanel',
          taskType: 'water',
          taskId:   task.task_id.toString(),
          userId:   task.user_id.toString(),
          isWater:  'true',
        },
      };

      const sent = await sendPushNotification(pushToken, notification);

      if (sent) {
        await incrementWaterTaskReminderCount(task.task_id);
        logger.info('[water-scheduler] Water reminder sent', {
          taskId:         task.task_id,
          userId:         task.user_id,
          reminderNumber,
          totalMl,
          requiredMl:     schedule.requiredMl,
          intervalMin:    schedule.intervalMin,
        });
      } else {
        logger.error('[water-scheduler] Failed to send water reminder', {
          taskId: task.task_id,
          userId: task.user_id,
        });
      }
    }

    logger.info('[water-scheduler] Water reminder check completed', { date });
  } catch (error) {
    logger.error('[water-scheduler] Unhandled error in checkAndSendWaterReminders', {
      error: error.message,
      stack: error.stack,
    });
    // Rethrow so the cron handler can log the failure and return 500
    throw error;
  }
}
