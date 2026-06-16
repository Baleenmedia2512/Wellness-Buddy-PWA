/**
 * /api/tasks/averages — Return learned average completion times for the authenticated user.
 *
 * GET /api/tasks/averages
 *
 * Used by the frontend reminderService at app startup to personalise native alarm times
 * so the loud on-device alarm fires at the user's own habitual time, not a fixed offset.
 *
 * Response shape:
 *   { ok: true, data: { averages: [ { task_type, average_completion_time, sample_count } ] } }
 *
 * Per claude.md §2.6: validate input, return { ok, data/error }, explicit status codes,
 *   log with { requestId, userId, route, durationMs }.
 */

import { getUserTaskAverages } from '../../../features/tasks/data/task-repo.js';
import logger from '../../../shared/lib/logger.js';
import { getUserIdFromSession } from '../../../shared/lib/auth-helpers.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests allowed' },
    });
  }

  try {
    const userId = getUserIdFromSession(req);
    if (!userId) {
      logger.warn('Unauthorized averages request', { requestId });
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const rows = await getUserTaskAverages(userId);

    const durationMs = Date.now() - startTime;
    logger.info('Task averages fetched', {
      requestId,
      userId,
      route: '/api/tasks/averages',
      durationMs,
      count: rows.length,
    });

    return res.status(200).json({
      ok: true,
      data: { averages: rows },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Error fetching task averages', {
      requestId,
      route: '/api/tasks/averages',
      durationMs,
      error: error.message,
    });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'Failed to fetch averages'
          : error.message,
      },
    });
  }
}
