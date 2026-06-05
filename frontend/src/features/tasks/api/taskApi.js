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
