/**
 * taskApi.js — API client for task operations
 * 
 * Thin wrapper around fetch for task endpoints
 * Per claude.md section 2.1: API clients live in features slash star slash api slash
 */

import { getApiBaseUrl } from '../../../config/api.config';
import { debugLog } from '../../../shared/utils/logger';

const apiBaseUrl = getApiBaseUrl();

/**
 * Get tasks for a user
 * 
 * @param {string} userId - User ID
 * @param {string} status - Optional status filter
 * @returns {Promise<Object>} - { ok, data: { tasks, date, totalCount } }
 */
export async function getTasks(userId, status = null) {
  try {
    const params = new URLSearchParams({ userId });
    if (status) {
      params.append('status', status);
    }

    const response = await fetch(`${apiBaseUrl}/api/tasks/list?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return data;
  } catch (error) {
    debugLog('[taskApi] Error getting tasks', { error: error.message });
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * Complete a task
 * 
 * @param {number} taskId - Task ID
 * @param {string} taskType - Task type
 * @param {Object} completionData - Completion data
 * @returns {Promise<Object>} - { ok, data: { taskId, status, completedAt } }
 */
export async function completeTask(taskId, taskType, completionData) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/tasks/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taskId,
        taskType,
        completionData
      })
    });

    const data = await response.json();
    
    if (data.ok) {
      debugLog('[taskApi] Task completed successfully', { taskId });
    }
    
    return data;
  } catch (error) {
    debugLog('[taskApi] Error completing task', { taskId, error: error.message });
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * Snooze a task reminder.
 *
 * @param {number} taskId        - Task ID.
 * @param {number} snoozeMinutes - Must be 15, 30, or 60.
 * @returns {Promise<Object>}    - { ok, data: { taskId, reminderCount, snoozedUntil } }
 */
export async function snoozeTask(taskId, snoozeMinutes) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/tasks/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, snoozeMinutes })
    });
    const data = await response.json();
    if (data.ok) {
      debugLog('[taskApi] Task snoozed', { taskId, snoozeMinutes });
    }
    return data;
  } catch (error) {
    debugLog('[taskApi] Error snoozing task', { taskId, error: error.message });
    return { ok: false, error: { code: 'NETWORK_ERROR', message: error.message } };
  }
}

/**
 * Dismiss task reminders for the rest of today.
 *
 * @param {number} taskId     - Task ID.
 * @returns {Promise<Object>} - { ok, data: { taskId, reminderDismissedToday } }
 */
export async function dismissTask(taskId) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/tasks/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    const data = await response.json();
    if (data.ok) {
      debugLog('[taskApi] Task reminders dismissed', { taskId });
    }
    return data;
  } catch (error) {
    debugLog('[taskApi] Error dismissing task', { taskId, error: error.message });
    return { ok: false, error: { code: 'NETWORK_ERROR', message: error.message } };
  }
}
