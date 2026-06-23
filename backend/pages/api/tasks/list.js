/**
 * /api/tasks/list - Get user's tasks for today
 * 
 * Per claude.md §2.6: API endpoints must:
 * - Validate input with schema
 * - Return { ok, data } or { ok, error }
 * - Set explicit status codes
 * - Log with requestId, userId, route, durationMs
 */

import { getTasksByUserAndDate } from '../../../features/tasks/data/task-repo.js';
import { isTaskVisible } from '../../../features/tasks/domain/task-rules.js';
import { getISTPartsFromDate } from '../../../features/tasks/domain/completion-learning.rules.js';
import { reconcilePendingTasksForUser } from '../../../features/tasks/api/record-completion-learning.handler.js';
import logger from '../../../shared/lib/logger.js';
import { getUserIdFromSession } from '../../../shared/lib/auth-helpers.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET requests allowed'
      }
    });
  }
  
  try {
    // Auth check
    const userId = getUserIdFromSession(req);
    if (!userId) {
      logger.warn('Unauthorized task list request', { requestId });
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
    
    // Get query params
    const { status, date } = req.query;
    // Use IST date to stay consistent with task creation (which also uses IST).
    // UTC date (format(new Date())) diverges from IST after 18:30 UTC each day.
    const targetDate = date || getISTPartsFromDate(new Date()).date;
    
    // Validate status if provided
    if (status && !['pending', 'completed', 'missed'].includes(status)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status must be pending, completed, or missed'
        }
      });
    }
    
    // Sync task status with today's logged activity (food/weight/education).
    let reconciledCount = 0;
    const todayIst = getISTPartsFromDate(new Date()).date;
    if (targetDate === todayIst) {
      reconciledCount = await reconcilePendingTasksForUser(userId);
    }

    // Fetch tasks
    const tasks = await getTasksByUserAndDate(userId, targetDate, status);
    
    // For pending tasks, filter by visibility (time window started)
    let filteredTasks = tasks;
    if (!status || status === 'pending') {
      const now = new Date();
      filteredTasks = tasks.filter(task => {
        if (String(task.status).toLowerCase() !== 'pending') return true;
        return isTaskVisible(task, now);
      });
    }
    
    const durationMs = Date.now() - startTime;
    logger.info('Tasks listed', {
      requestId,
      userId,
      route: '/api/tasks/list',
      durationMs,
      taskCount: filteredTasks.length,
      reconciledCount,
      status,
      date: targetDate
    });
    
    return res.status(200).json({
      ok: true,
      data: {
        tasks: filteredTasks,
        date: targetDate,
        totalCount: filteredTasks.length
      }
    });
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Error listing tasks', {
      requestId,
      route: '/api/tasks/list',
      durationMs,
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Failed to fetch tasks' : error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
      }
    });
  }
}
