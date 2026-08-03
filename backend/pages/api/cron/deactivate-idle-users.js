/**
 * deactivate-idle-users.js — Vercel Cron endpoint (legacy path retained).
 *
 * ADR-0007: auto-deactivation is disabled. Idle members stay Active; coaches
 * are emailed when the member returns (see return-notify.service).
 * This cron remains scheduled so ops monitors stay green, but it no longer
 * mutates Status.
 *
 * @module backend/pages/api/cron/deactivate-idle-users
 */

import { INACTIVITY_THRESHOLD_DAYS } from '../../../features/idle-cleanup/domain/inactivity-rules.js';
import logger from '../../../shared/lib/logger.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';

/**
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export default async function handler(req, res) {
  const correlationId = `cron-deactivate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('CRON_SECRET not configured', { correlationId });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'MISCONFIGURED',
        message: 'Cron secret not configured',
      },
    });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    logger.warn('Unauthorized cron attempt', {
      correlationId,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });
    return res.status(401).json({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid cron secret',
      },
    });
  }

  logger.info('Cron job skipped: deactivate-idle-users (auto-deactivation disabled)', {
    correlationId,
    thresholdDays: INACTIVITY_THRESHOLD_DAYS,
    policy: 'return-notify-only',
    timestamp: nowUtc(),
    durationMs: Date.now() - startTime,
  });

  return res.status(200).json({
    ok: true,
    data: {
      message: 'Idle auto-deactivation disabled — coaches are notified on member return',
      usersProcessed: 0,
      success: 0,
      failed: 0,
      policy: 'return-notify-only',
    },
  });
}
