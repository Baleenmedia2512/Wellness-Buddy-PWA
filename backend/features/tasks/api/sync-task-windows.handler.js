/**
 * sync-task-windows.handler.js
 *
 * Called when admin updates activity_time_windows_table so pending tasks
 * pick up new WindowStart/WindowEnd immediately.
 */

import { syncPendingTaskWindowsForActivityType } from '../data/task-repo.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {string} activityType
 * @param {string} effectiveFromDate  YYYY-MM-DD
 * @returns {Promise<{ updatedCount: number }>}
 */
export async function syncTaskWindowsAfterAdminChange(activityType, effectiveFromDate) {
  try {
    const updatedCount = await syncPendingTaskWindowsForActivityType(
      activityType,
      effectiveFromDate,
    );
    return { updatedCount };
  } catch (error) {
    logger.error('syncTaskWindowsAfterAdminChange failed', {
      activityType,
      effectiveFromDate,
      error: error.message,
    });
    throw error;
  }
}
