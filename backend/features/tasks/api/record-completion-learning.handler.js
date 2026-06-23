/**
 * record-completion-learning.handler.js
 *
 * Public tasks-feature entrypoint: mark today's pending task complete (if any)
 * and update the user's rolling average completion time for personalised reminders.
 *
 * Called from /api/tasks/complete and from other feature API routes after a
 * successful activity save (weight, food, education, water).
 *
 * Fire-and-forget safe: logs errors, never throws to callers.
 */

import {
  completeTask,
  upsertTaskAverage,
  getPendingTaskForUser,
  getTimeWindowsByUser,
} from '../data/task-repo.js';
import {
  extractIstParts,
  resolveFoodSaveTaskType,
  buildActivityWindowsMap,
  getISTPartsFromDate,
  normalizeTaskTypeHint,
} from '../domain/completion-learning.rules.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {Object} args
 * @param {number|string} args.userId
 * @param {string}        args.taskType       weight|breakfast|lunch|dinner|education|water
 * @param {string}        args.istTimestamp   IST 'YYYY-MM-DD HH:MM:SS' (or ISO)
 * @param {Object}        [args.completionData]
 * @returns {Promise<void>}
 */
export async function recordCompletionLearning({
  userId,
  taskType,
  istTimestamp,
  completionData = {},
}) {
  if (!userId || !taskType || !istTimestamp) {
    logger.warn('recordCompletionLearning: missing required fields', {
      userId: !!userId,
      taskType,
      istTimestamp: !!istTimestamp,
    });
    return;
  }

  const parts = extractIstParts(istTimestamp);
  if (!parts) {
    logger.warn('recordCompletionLearning: could not parse IST timestamp', {
      userId,
      taskType,
      istTimestamp,
    });
    return;
  }

  const numericUserId = parseInt(userId, 10);
  if (!Number.isFinite(numericUserId)) {
    logger.warn('recordCompletionLearning: invalid userId', { userId, taskType });
    return;
  }

  try {
    const pending = await getPendingTaskForUser(numericUserId, taskType, parts.date);

    if (pending?.task_id) {
      await completeTask(pending.task_id, completionData);
      logger.info('recordCompletionLearning: pending task completed', {
        userId: numericUserId,
        taskType,
        taskId: pending.task_id,
      });
    }

    await upsertTaskAverage(numericUserId, taskType, parts.time);

    logger.info('recordCompletionLearning: average updated', {
      userId: numericUserId,
      taskType,
      completionTime: parts.time,
    });
  } catch (error) {
    logger.error('recordCompletionLearning failed (non-critical)', {
      userId: numericUserId,
      taskType,
      error: error.message,
    });
  }
}

/**
 * Infer task type from a food analysis payload and record learning.
 *
 * @param {Object} args
 * @param {number|string} args.userId
 * @param {string}        args.istTimestamp
 * @param {unknown}       args.analysisResult
 * @param {Object}        [args.completionData]
 * @returns {Promise<void>}
 */
export async function recordFoodSaveCompletionLearning({
  userId,
  istTimestamp: _istTimestamp,
  analysisResult,
  completionData = {},
  taskTypeHint = null,
}) {
  // Task completion uses upload-time IST (not EXIF) so a lunch logged now
  // completes today's lunch task even when the photo has a stale EXIF clock.
  const serverParts = getISTPartsFromDate(new Date());
  if (!serverParts?.date || !serverParts?.time) return;

  let windows;
  try {
    const rows = await getTimeWindowsByUser(userId);
    windows = buildActivityWindowsMap(rows);
  } catch (error) {
    logger.error('recordFoodSaveCompletionLearning: failed to load time windows', {
      userId,
      error: error.message,
    });
    windows = {};
  }

  const hintType = normalizeTaskTypeHint(taskTypeHint);
  const taskType = hintType || resolveFoodSaveTaskType({
    istTimeOnly: serverParts.time,
    analysisResult,
    timeWindows: windows,
  });

  if (!taskType) {
    logger.info('recordFoodSaveCompletionLearning: no matching task type for save', {
      userId,
      istTime: serverParts.time,
      hadHint: !!hintType,
    });
    return;
  }

  const serverIstTimestamp = `${serverParts.date} ${serverParts.time}`;

  await recordCompletionLearning({
    userId,
    taskType,
    istTimestamp: serverIstTimestamp,
    completionData,
  });
}
