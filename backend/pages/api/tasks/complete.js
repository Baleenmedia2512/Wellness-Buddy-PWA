/**
 * /api/tasks/complete - Complete a task
 * 
 * Per claude.md §2.6: Validate input, return { ok, data/error }, explicit status codes
 */

import { completeTask } from '../../../features/tasks/data/task-repo.js';
import { recordCompletionLearning } from '../../../features/tasks/api/record-completion-learning.handler.js';
import { validateTaskCompletion } from '../../../features/tasks/domain/task-rules.js';
import { validateCompleteTaskRequest } from '../../../features/tasks/validation/complete-task.schema.js';
import { getISTTimestamp } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { getUserIdFromSession } from '../../../shared/lib/auth-helpers.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests allowed'
      }
    });
  }
  
  try {
    // Auth check
    const userId = getUserIdFromSession(req);
    if (!userId) {
      logger.warn('Unauthorized task complete request', { requestId });
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
    
    // Validate request body
    const validation = validateCompleteTaskRequest(req.body);
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
    
    const { taskId, completionData, taskType } = req.body;
    
    // Validate completion data based on task type
    if (taskType) {
      const completionValidation = validateTaskCompletion(taskType, completionData);
      if (!completionValidation.valid) {
        return res.status(422).json({
          ok: false,
          error: {
            code: 'INVALID_COMPLETION_DATA',
            message: completionValidation.error
          }
        });
      }
    }
    
    // Complete the task
    const completedTask = await completeTask(taskId, completionData);

    const resolvedTaskType = completedTask.TaskType || taskType;
    const completedAtRaw   = completedTask.CompletedAt || completedTask.completed_at;

    // Update rolling average — use IST timestamp for consistency with cron windows.
    const istTimestamp = completedAtRaw
      ? String(completedAtRaw).replace('T', ' ').substring(0, 19)
      : getISTTimestamp().substring(0, 19);

    recordCompletionLearning({
      userId,
      taskType: resolvedTaskType,
      istTimestamp,
      completionData,
    }).catch((err) =>
      logger.error('recordCompletionLearning failed after task complete (non-critical)', {
        taskId,
        userId,
        error: err.message,
      })
    );

    const durationMs = Date.now() - startTime;
    logger.info('Task completed', {
      requestId,
      userId,
      route: '/api/tasks/complete',
      durationMs,
      taskId,
      taskType: resolvedTaskType,
    });
    
    return res.status(200).json({
      ok: true,
      data: {
        taskId: completedTask.TaskId || completedTask.task_id,
        status: completedTask.Status || completedTask.status,
        completedAt: completedAtRaw,
      }
    });
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Error completing task', {
      requestId,
      route: '/api/tasks/complete',
      durationMs,
      error: error.message,
      stack: error.stack
    });
    
    // Task not found or already completed
    if (error.message.includes('not found') || error.message.includes('already completed')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: error.message
        }
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Failed to complete task' : error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
      }
    });
  }
}
