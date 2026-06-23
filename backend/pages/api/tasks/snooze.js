/**
 * /api/tasks/snooze — Snooze a pending task reminder
 *
 * POST body: { taskId: number, snoozeMinutes: 15 | 30 | 60 }
 *
 * Per claude.md §2.6: validate input, return { ok, data/error }, explicit status codes.
 */

import { snoozeTask } from '../../../features/tasks/data/task-repo.js';
import { calculateSnoozeExpiry } from '../../../features/tasks/domain/task-rules.js';
import { validateSnoozeRequest } from '../../../features/tasks/validation/snooze-task.schema.js';
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
      logger.warn('Unauthorized snooze request', { requestId });
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const validation = validateSnoozeRequest(req.body);
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

    const { taskId, snoozeMinutes } = req.body;
    const snoozedUntil = calculateSnoozeExpiry(snoozeMinutes, new Date());
    const updated = await snoozeTask(taskId, snoozedUntil, userId);

    const durationMs = Date.now() - startTime;
    logger.info('Task snoozed via API', {
      requestId,
      userId,
      route: '/api/tasks/snooze',
      durationMs,
      taskId,
      snoozeMinutes,
      snoozedUntil
    });

    return res.status(200).json({
      ok: true,
      data: {
        taskId: updated.task_id,
        reminderCount: updated.reminder_count,
        snoozedUntil: updated.snoozed_until
      }
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Error snoozing task', {
      requestId,
      route: '/api/tasks/snooze',
      durationMs,
      error: error.message
    });

    if (error.message.includes('not found') || error.message.includes('not pending')) {
      return res.status(404).json({
        ok: false,
        error: { code: 'TASK_NOT_FOUND', message: error.message }
      });
    }

    if (error.message.includes('Invalid snooze duration')) {
      return res.status(422).json({
        ok: false,
        error: { code: 'INVALID_SNOOZE_DURATION', message: error.message }
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Failed to snooze task'
            : error.message
      }
    });
  }
}
