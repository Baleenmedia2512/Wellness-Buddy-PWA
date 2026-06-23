/**
 * /api/tasks/dismiss — Dismiss task reminders for the rest of today
 *
 * POST body: { taskId: number }
 *
 * Sets ReminderDismissedToday = true on the task row.
 * The task itself stays pending — user can still complete it manually.
 *
 * Per claude.md §2.6: validate input, return { ok, data/error }, explicit status codes.
 */

import { dismissTaskToday } from '../../../features/tasks/data/task-repo.js';
import { validateDismissRequest } from '../../../features/tasks/validation/snooze-task.schema.js';
import logger from '../../../shared/lib/logger.js';
import { getUserIdFromSession } from '../../../shared/lib/auth-helpers.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests allowed' }
    });
  }

  try {
    const userId = getUserIdFromSession(req);
    if (!userId) {
      logger.warn('Unauthorized dismiss request', { requestId });
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const validation = validateDismissRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.errors
        }
      });
    }

    const { taskId } = req.body;
    const updated = await dismissTaskToday(taskId, userId);

    const durationMs = Date.now() - startTime;
    logger.info('Task reminders dismissed via API', {
      requestId,
      userId,
      route: '/api/tasks/dismiss',
      durationMs,
      taskId
    });

    return res.status(200).json({
      ok: true,
      data: {
        taskId: updated.task_id,
        reminderDismissedToday: updated.reminder_dismissed_today
      }
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Error dismissing task reminders', {
      requestId,
      route: '/api/tasks/dismiss',
      durationMs,
      error: error.message
    });

    if (error.message.includes('not found') || error.message.includes('not pending')) {
      return res.status(404).json({
        ok: false,
        error: { code: 'TASK_NOT_FOUND', message: error.message }
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Failed to dismiss task reminders'
            : error.message
      }
    });
  }
}
