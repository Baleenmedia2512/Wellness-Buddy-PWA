/**
 * taskApi.js — API client for task operations
 * 
 * Thin wrapper around fetch for task endpoints
 * Per claude.md section 2.1: API clients live in features slash star slash api slash
 */

import { getApiBaseUrl } from '../../../config/api.config';
import { getDbUserId } from '../../../shared/services/sessionStorage';
import { debugLog } from '../../../shared/utils/logger';

const apiBaseUrl = getApiBaseUrl();

/**
 * Resolve authenticated user id for task API calls.
 * Prefer an explicit userId from the caller (matches useTaskData / list).
 */
function resolveTaskUserId(explicitUserId = null) {
  if (explicitUserId) return String(explicitUserId);
  return (
    getDbUserId()
    || (typeof localStorage !== 'undefined' ? localStorage.getItem('wellness_user_id') : null)
    || (typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null)
  );
}

function missingUserIdResult() {
  return {
    ok: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    },
  };
}

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
export async function completeTask(taskId, taskType, completionData, explicitUserId = null) {
  const userId = resolveTaskUserId(explicitUserId);
  if (!userId) return missingUserIdResult();

  try {
    const response = await fetch(`${apiBaseUrl}/api/tasks/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
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
export async function snoozeTask(taskId, snoozeMinutes, explicitUserId = null) {
  const userId = resolveTaskUserId(explicitUserId);
  // #region agent log
    fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fbd973'},body:JSON.stringify({sessionId:'fbd973',location:'taskApi.js:snoozeTask:pre',message:'snooze auth resolution',data:{hasExplicitUserId:!!explicitUserId,hasResolvedUserId:!!userId,hasDbUserId:!!getDbUserId()},timestamp:Date.now(),hypothesisId:'H1-H2',runId:'post-fix'})}).catch(()=>{});
  // #endregion
  if (!userId) return missingUserIdResult();

  try {
    const response = await fetch(`${apiBaseUrl}/api/tasks/snooze?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId, snoozeMinutes })
    });
    const data = await response.json();
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fbd973'},body:JSON.stringify({sessionId:'fbd973',location:'taskApi.js:snoozeTask:post',message:'snooze response',data:{status:response.status,ok:data?.ok,errorCode:data?.error?.code},timestamp:Date.now(),hypothesisId:'H1-H3',runId:'post-fix'})}).catch(()=>{});
    // #endregion
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
export async function dismissTask(taskId, explicitUserId = null) {
  const userId = resolveTaskUserId(explicitUserId);
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fbd973'},body:JSON.stringify({sessionId:'fbd973',location:'taskApi.js:dismissTask:pre',message:'dismiss auth resolution',data:{hasExplicitUserId:!!explicitUserId,hasResolvedUserId:!!userId},timestamp:Date.now(),hypothesisId:'H1-H2',runId:'post-fix'})}).catch(()=>{});
  // #endregion
  if (!userId) return missingUserIdResult();

  try {
    const response = await fetch(`${apiBaseUrl}/api/tasks/dismiss?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId })
    });
    const data = await response.json();
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fbd973'},body:JSON.stringify({sessionId:'fbd973',location:'taskApi.js:dismissTask:post',message:'dismiss response',data:{status:response.status,ok:data?.ok,errorCode:data?.error?.code},timestamp:Date.now(),hypothesisId:'H1-H3',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    if (data.ok) {
      debugLog('[taskApi] Task reminders dismissed', { taskId });
    }
    return data;
  } catch (error) {
    debugLog('[taskApi] Error dismissing task', { taskId, error: error.message });
    return { ok: false, error: { code: 'NETWORK_ERROR', message: error.message } };
  }
}
