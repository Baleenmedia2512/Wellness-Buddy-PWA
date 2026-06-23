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
  buildServerIstTimestamp,
  normalizeActivityWindow,
} from '../domain/completion-learning.rules.js';
import { isExemptedBeverageOnly } from '../../../utils/foodTypeDetection.js';
import {
  fetchFoodForDay,
  fetchWeightForDay,
  fetchEducationForDay,
} from '../../background-analysis/diary.repository.js';
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
 * Mark a task complete using server IST time (upload time), not EXIF/device time.
 *
 * @param {Object} args
 * @param {number|string} args.userId
 * @param {string}        args.taskType
 * @param {Object}        [args.completionData]
 * @returns {Promise<void>}
 */
export async function recordActivityCompletionLearning({
  userId,
  taskType,
  completionData = {},
}) {
  const serverIstTimestamp = buildServerIstTimestamp();
  if (!serverIstTimestamp) return;

  await recordCompletionLearning({
    userId,
    taskType,
    istTimestamp: serverIstTimestamp,
    completionData,
  });
}

function parseFoodAnalysisRow(row) {
  if (!row?.AnalysisData) return null;
  try {
    return typeof row.AnalysisData === 'string'
      ? JSON.parse(row.AnalysisData)
      : row.AnalysisData;
  } catch {
    return null;
  }
}

/**
 * Infer which meal/water task types already have food logs today.
 * Used when reopening the task panel to fix tasks stuck pending after save.
 *
 * @param {Array} foods
 * @param {Object} windows
 * @param {{ date: string, time: string }} serverParts
 * @param {Set<string>} pendingMealTypes
 * @returns {Set<string>}
 */
export function inferFoodTaskTypesFromTodayLogs(foods, windows, serverParts, pendingMealTypes) {
  const completed = new Set();
  let hasMealFoodToday = false;

  for (const row of foods) {
    const analysisResult = parseFoodAnalysisRow(row);
    if (!analysisResult) continue;

    if (isExemptedBeverageOnly(analysisResult)) {
      completed.add('water');
      continue;
    }

    hasMealFoodToday = true;
    const createdAt = String(row.CreatedAt || '').replace('T', ' ');
    const parts = extractIstParts(createdAt);
    if (parts) {
      const taskType = resolveFoodSaveTaskType({
        istTimeOnly: parts.time,
        analysisResult,
        timeWindows: windows,
      });
      if (taskType && taskType !== 'water') completed.add(taskType);
    }
  }

  // Fallback: meal logged during its active window (handles stale EXIF on save time).
  if (hasMealFoodToday && pendingMealTypes.size > 0) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      if (!pendingMealTypes.has(mealType)) continue;
      const bounds = normalizeActivityWindow(windows[mealType]);
      if (bounds && serverParts.time >= bounds.start && serverParts.time <= bounds.end) {
        completed.add(mealType);
      }
    }
  }

  return completed;
}

/**
 * Complete pending tasks when today's activity was already logged but completion
 * was missed (e.g. stale EXIF timestamp). Idempotent — safe on every panel open.
 *
 * @param {number|string} userId
 * @returns {Promise<number>} count reconciled
 */
export async function reconcilePendingTasksForUser(userId) {
  const serverParts = getISTPartsFromDate(new Date());
  if (!serverParts?.date) return 0;

  const numericUserId = parseInt(userId, 10);
  if (!Number.isFinite(numericUserId)) return 0;

  const { getTasksByUserAndDate } = await import('../data/task-repo.js');
  const pending = await getTasksByUserAndDate(numericUserId, serverParts.date, 'pending');
  if (!pending.length) return 0;

  const pendingTypes = new Set(pending.map((t) => t.task_type));
  const completedTypes = new Set();

  try {
    const [weights, education, foods] = await Promise.all([
      fetchWeightForDay(String(numericUserId), serverParts.date),
      fetchEducationForDay(String(numericUserId), serverParts.date),
      fetchFoodForDay(String(numericUserId), serverParts.date),
    ]);

    if (weights.length && pendingTypes.has('weight')) completedTypes.add('weight');
    if (education.length && pendingTypes.has('education')) completedTypes.add('education');

    let windows = {};
    try {
      const rows = await getTimeWindowsByUser(userId);
      windows = buildActivityWindowsMap(rows);
    } catch (error) {
      logger.error('reconcilePendingTasksForUser: failed to load time windows', {
        userId,
        error: error.message,
      });
    }

    const pendingMealTypes = new Set(
      ['breakfast', 'lunch', 'dinner', 'water'].filter((t) => pendingTypes.has(t)),
    );
    const foodTypes = inferFoodTaskTypesFromTodayLogs(
      foods,
      windows,
      serverParts,
      pendingMealTypes,
    );
    for (const t of foodTypes) {
      if (pendingTypes.has(t)) completedTypes.add(t);
    }
  } catch (error) {
    logger.error('reconcilePendingTasksForUser: activity lookup failed', {
      userId,
      error: error.message,
    });
    return 0;
  }

  const serverIstTimestamp = `${serverParts.date} ${serverParts.time}`;
  let reconciled = 0;

  for (const taskType of completedTypes) {
    try {
      const before = await getPendingTaskForUser(numericUserId, taskType, serverParts.date);
      if (!before?.task_id) continue;

      await recordCompletionLearning({
        userId: numericUserId,
        taskType,
        istTimestamp: serverIstTimestamp,
        completionData: { source: 'reconcile' },
      });
      reconciled += 1;
    } catch (error) {
      logger.error('reconcilePendingTasksForUser: failed to complete task', {
        userId: numericUserId,
        taskType,
        error: error.message,
      });
    }
  }

  if (reconciled > 0) {
    logger.info('reconcilePendingTasksForUser: reconciled pending tasks', {
      userId: numericUserId,
      reconciled,
      types: [...completedTypes],
    });
  }

  return reconciled;
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
