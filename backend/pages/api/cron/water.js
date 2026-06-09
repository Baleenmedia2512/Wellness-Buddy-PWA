/**
 * /api/cron/water — Vercel Cron handler for water hydration reminders.
 *
 * Runs every minute (schedule: "* * * * *").
 * Auth: Bearer <CRON_SECRET>  (same secret as /api/cron/tasks).
 *
 * Per claude.md §2.6: thin handler — validation → domain call → structured response.
 * Per claude.md §2.8: idempotent, logs with correlation ID, fails loudly.
 */

import { checkAndSendWaterReminders } from '../../../features/water/domain/water-scheduler.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  const correlationId  = `cron-water-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime      = Date.now();
  const authHeader     = req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('CRON_SECRET not configured', { correlationId });
    return res.status(500).json({
      ok: false,
      error: { code: 'MISCONFIGURED', message: 'Cron secret not configured' },
    });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    logger.warn('Unauthorized cron attempt', {
      correlationId,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    });
    return res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' },
    });
  }

  logger.info('Cron job started: water', { correlationId });

  try {
    await checkAndSendWaterReminders();

    const durationMs = Date.now() - startTime;
    logger.info('Cron job completed: water', { correlationId, durationMs });
    return res.status(200).json({ ok: true, data: { durationMs } });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Cron job failed: water', {
      correlationId,
      durationMs,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      ok: false,
      error: { code: 'CRON_ERROR', message: error.message },
    });
  }
}
