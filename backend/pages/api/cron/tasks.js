/**
 * /api/cron/tasks — Vercel Cron handler for task scheduling and follow-up reminders.
 *
 * Runs every minute (schedule: "* * * * *").
 * Auth: Bearer <CRON_SECRET>
 *
 * Responsibilities:
 *  1. checkAndCreateTasksForCurrentTime()  — create tasks when windows open, send first FCM push
 *  2. checkAndSendFollowUpReminders()      — re-send FCM when snoozed tasks expire
 *
 * Per claude.md §2.8: idempotent, logs with correlation ID, fails loudly.
 */

import {
  checkAndCreateTasksForCurrentTime,
  checkAndSendFollowUpReminders,
  checkAndSendPersonalisedReminders
} from '../../../features/tasks/domain/task-scheduler.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  const correlationId = `cron-tasks-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  // Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader    = req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('CRON_SECRET not configured', { correlationId });
    return res.status(500).json({
      ok: false,
      error: { code: 'MISCONFIGURED', message: 'Cron secret not configured' }
    });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    logger.warn('Unauthorized cron attempt', {
      correlationId,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress
    });
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' }
    });
  }

  logger.info('Cron job started: tasks', { correlationId });

  try {
    // Run all three checks in parallel — they are independent
    await Promise.all([
      checkAndCreateTasksForCurrentTime(),
      checkAndSendFollowUpReminders(),
      checkAndSendPersonalisedReminders()
    ]);

    const durationMs = Date.now() - startTime;
    logger.info('Cron job completed: tasks', { correlationId, durationMs });

    return res.status(200).json({ ok: true, data: { correlationId, durationMs } });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Cron job failed: tasks', {
      correlationId,
      durationMs,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'Task cron failed'
          : error.message
      }
    });
  }
}
