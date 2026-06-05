/**
 * deactivate-idle-users.js — Vercel Cron endpoint for auto-deactivating idle accounts.
 * Runs daily at UTC midnight (configured in vercel.json).
 * 
 * Per claude.md §2.8: Background jobs must be idempotent, log with correlation ID,
 * have max retry count, and fail loudly.
 * 
 * @module backend/pages/api/cron/deactivate-idle-users
 */

import { findIdleUsers, batchDeactivateUsers } from '../../../features/idle-cleanup/data/idle-repo.js';
import { INACTIVITY_THRESHOLD_DAYS } from '../../../features/idle-cleanup/domain/inactivity-rules.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Vercel Cron handler.
 * Authenticates via CRON_SECRET header, queries idle users, deactivates them.
 * 
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export default async function handler(req, res) {
  const correlationId = `cron-deactivate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  // Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET>
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

  logger.info('Cron job started: deactivate-idle-users', {
    correlationId,
    thresholdDays: INACTIVITY_THRESHOLD_DAYS,
    timestamp: new Date().toISOString(),
  });

  try {
    // Step 1: Query idle users
    const idleUsers = await findIdleUsers();

    if (idleUsers.length === 0) {
      logger.info('No idle users found', {
        correlationId,
        durationMs: Date.now() - startTime,
      });
      return res.status(200).json({
        ok: true,
        data: {
          message: 'No idle users to deactivate',
          usersProcessed: 0,
          success: 0,
          failed: 0,
        },
      });
    }

    // Step 2: Batch deactivate
    const userIds = idleUsers.map(u => u.UserId);
    const results = await batchDeactivateUsers(userIds, correlationId);

    // Step 3: Log summary
    logger.info('Cron job completed: deactivate-idle-users', {
      correlationId,
      usersFound: idleUsers.length,
      success: results.success,
      failed: results.failed,
      totalReassigned: results.totalReassigned,
      durationMs: Date.now() - startTime,
    });

    // Step 4: Return response
    return res.status(200).json({
      ok: true,
      data: {
        message: 'Idle users deactivated',
        usersProcessed: idleUsers.length,
        success: results.success,
        failed: results.failed,
        membersReassigned: results.totalReassigned,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
    });
  } catch (err) {
    // Step 5: Fail loudly (per claude.md §1.1 rule 7)
    logger.error('Cron job failed: deactivate-idle-users', {
      correlationId,
      error: err.message,
      stack: err.stack,
      durationMs: Date.now() - startTime,
    });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'CRON_FAILURE',
        message: 'Failed to deactivate idle users',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
    });
  }
}
