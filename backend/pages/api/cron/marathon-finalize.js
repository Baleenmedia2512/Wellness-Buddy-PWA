/**
 * /api/cron/marathon-finalize — Vercel Cron handler for Marathon Recognition Engine.
 *
 * Runs every minute (schedule: "* * * * *").
 * Auth: Bearer <CRON_SECRET>  (same secret used by /api/cron/tasks and /api/cron/water).
 *
 * Behaviour:
 *  - Finds all ACTIVE marathons.
 *  - For each, checks whether the discipline window end + grace period (15 min) has passed in IST.
 *  - If so, and if no result exists for today yet, computes and stores the Day & Lap Leaders.
 *  - Fully idempotent — running multiple times in the same minute is safe.
 */
import { autoFinalizeActiveMarathons } from '../../../features/marathon/data/marathon.repo.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  const correlationId  = `cron-marathon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime      = Date.now();
  const authHeader     = req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('CRON_SECRET not configured', { correlationId });
    return res.status(500).json({
      ok:    false,
      error: { code: 'MISCONFIGURED', message: 'Cron secret not configured' },
    });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    logger.warn('Unauthorized cron attempt', {
      correlationId,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    });
    return res.status(401).json({
      ok:    false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' },
    });
  }

  logger.info('Cron job started: marathon-finalize', { correlationId });

  try {
    const result = await autoFinalizeActiveMarathons();

    const durationMs = Date.now() - startTime;
    logger.info('Cron job completed: marathon-finalize', { correlationId, durationMs, ...result });
    return res.status(200).json({ ok: true, data: { durationMs, ...result } });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Cron job failed: marathon-finalize', {
      correlationId,
      durationMs,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      ok:    false,
      error: { code: 'CRON_ERROR', message: error.message },
    });
  }
}
