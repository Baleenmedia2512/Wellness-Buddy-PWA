/**
 * /api/tasks/catchup — Create any tasks that were missed by the per-minute cron.
 *
 * POST /api/tasks/catchup
 *
 * Called by the frontend when it loads the task panel and finds 0 tasks.
 * Idempotent — safe to call many times (ON CONFLICT DO NOTHING in createTask).
 *
 * Response:
 *   { ok: true, data: { createdCount, notificationsSent, notifyEligible, hasPushToken } }
 *
 * Per claude.md §2.6: validate input, return { ok, data/error }, explicit status codes,
 *   log with { requestId, userId, route, durationMs }.
 */

import { createMissingTasksForToday, checkAndSendMissedInitialNotifications } from '../../../features/tasks/domain/task-scheduler.js';
import { userHasPushToken } from '../../../features/tasks/data/task-repo.js';
import logger from '../../../shared/lib/logger.js';
import { getUserIdFromSession } from '../../../shared/lib/auth-helpers.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests allowed' },
    });
  }

  try {
    const userId = getUserIdFromSession(req);
    if (!userId) {
      logger.warn('Unauthorized catchup request', { requestId });
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const createdCount = await createMissingTasksForToday(userId);
    const [notifyStats, hasPushToken] = await Promise.all([
      checkAndSendMissedInitialNotifications(userId),
      userHasPushToken(userId),
    ]);

    const durationMs = Date.now() - startTime;
    logger.info('Task catch-up completed', {
      requestId,
      userId,
      route: '/api/tasks/catchup',
      durationMs,
      createdCount,
      notificationsSent: notifyStats.sent,
      notifyEligible: notifyStats.eligible,
    });

    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fbd973'},body:JSON.stringify({sessionId:'fbd973',location:'catchup.js:handler',message:'catchup notify result',data:{userId,createdCount,eligible:notifyStats.eligible,sent:notifyStats.sent,errors:notifyStats.errors,hasPushToken},timestamp:Date.now(),hypothesisId:'H4-H6',runId:'post-fix'})}).catch(()=>{});
    // #endregion

    return res.status(200).json({
      ok: true,
      data: {
        createdCount,
        notificationsSent: notifyStats.sent,
        notifyEligible: notifyStats.eligible,
        hasPushToken,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Task catch-up failed', {
      requestId,
      route: '/api/tasks/catchup',
      durationMs,
      error: error.message,
    });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'Catch-up failed'
          : error.message,
      },
    });
  }
}
