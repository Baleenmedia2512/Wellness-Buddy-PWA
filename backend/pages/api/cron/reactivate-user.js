/**
 * reactivate-user.js — API endpoint to reactivate an inactive user.
 * When a coach is reactivated, automatically restores their downline members.
 * 
 * Per claude.md §2.6: Returns structured JSON with ok/error pattern.
 * 
 * @module backend/pages/api/cron/reactivate-user
 */

import { restoreMembersToOriginalCoach } from '../../../features/idle-cleanup/data/idle-repo.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Reactivates a user and restores their hierarchy.
 * 
 * POST /api/cron/reactivate-user
 * Body: { userId: string }
 * Auth: Bearer <CRON_SECRET>
 * 
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export default async function handler(req, res) {
  const correlationId = `reactivate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startTime = Date.now();

  // Auth: Bearer token
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
    logger.warn('Unauthorized reactivation attempt', {
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

  // Validate input
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'userId is required',
      },
    });
  }

  logger.info('User reactivation started', {
    correlationId,
    userId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Step 1: Reactivate user
    const { setUserStatus } = await import('../../../features/user/user.repository.js');
    await setUserStatus(userId, 'Active');

    logger.info('User reactivated', {
      correlationId,
      userId,
    });

    // Step 2: Restore their downline members (if any)
    const restoreResult = await restoreMembersToOriginalCoach(userId, correlationId);

    logger.info('User reactivation completed', {
      correlationId,
      userId,
      membersRestored: restoreResult.restored,
      durationMs: Date.now() - startTime,
    });

    return res.status(200).json({
      ok: true,
      data: {
        message: 'User reactivated successfully',
        userId,
        membersRestored: restoreResult.restored,
      },
    });

  } catch (err) {
    logger.error('User reactivation failed', {
      correlationId,
      userId,
      error: err.message,
      stack: err.stack,
      durationMs: Date.now() - startTime,
    });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'REACTIVATION_FAILED',
        message: 'Failed to reactivate user',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
    });
  }
}
