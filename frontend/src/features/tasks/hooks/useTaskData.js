/**
 * useTaskData.js — Hook for fetching and managing task data
 *
 * Responsibilities:
 * - Fetch tasks from API
 * - Auto-trigger catch-up on first panel load (backfills missed windows)
 * - Handle loading/error states
 */

import { useState, useEffect, useCallback } from 'react';
import { debugLog } from '../../../shared/utils/logger';
import { getApiBaseUrl } from '../../../config/api.config';

/**
 * Call POST /api/tasks/catchup so the server creates any task rows
 * whose time windows already opened today but whose cron run was missed,
 * and sends the first FCM for pending tasks in open windows.
 * Idempotent — safe on every panel open.
 */
async function triggerCatchup(apiBaseUrl, userId) {
  try {
    const res = await fetch(`${apiBaseUrl}/api/tasks/catchup?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    debugLog('[useTaskData] catchup result', json);
    return {
      createdCount: json?.data?.createdCount ?? 0,
      notificationsSent: json?.data?.notificationsSent ?? 0,
      notifyEligible: json?.data?.notifyEligible ?? 0,
      hasPushToken: json?.data?.hasPushToken ?? null,
    };
  } catch (err) {
    debugLog('[useTaskData] catchup failed (non-critical):', err.message);
    return { createdCount: 0, notificationsSent: 0, notifyEligible: 0, hasPushToken: null };
  }
}

export function useTaskData(userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiBaseUrl = getApiBaseUrl();

  const fetchTasks = useCallback(async ({ runCatchup = false } = {}) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      debugLog('[useTaskData] Fetching tasks', { userId });

      const response = await fetch(`${apiBaseUrl}/api/tasks/list?userId=${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.ok) {
        const fetched = data.data.tasks || [];

        // Catch-up on every panel open: backfill missed windows and send first
        // FCM for tasks whose window is open but NotificationSent is still false.
        if (runCatchup) {
          debugLog('[useTaskData] Running catch-up', { existingCount: fetched.length });
          const { createdCount, notificationsSent, notifyEligible, hasPushToken } = await triggerCatchup(apiBaseUrl, userId);
          const retryRes = await fetch(`${apiBaseUrl}/api/tasks/list?userId=${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          const retryData = await retryRes.json();
          if (retryData.ok) {
            setTasks(retryData.data.tasks || []);
            setError(null);
            debugLog('[useTaskData] Tasks re-fetched after catch-up', {
              count: (retryData.data.tasks || []).length,
              createdCount,
              notificationsSent,
              notifyEligible,
              hasPushToken,
            });
            return;
          }
        }

        setTasks(fetched);
        setError(null);
        debugLog('[useTaskData] Tasks fetched', { count: fetched.length });
      } else {
        throw new Error(data.error?.message || 'Failed to fetch tasks');
      }
    } catch (err) {
      debugLog('[useTaskData] Error fetching tasks', { error: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, apiBaseUrl]);

  // Initial fetch — catch-up on every panel open (idempotent)
  useEffect(() => {
    fetchTasks({ runCatchup: true });
  }, [fetchTasks]);

  // Manual refresh — no catch-up (user-triggered, tasks may just be completed)
  const refresh = useCallback(() => {
    setLoading(true);
    fetchTasks({ runCatchup: false });
  }, [fetchTasks]);

  // Re-fetch when food/weight/education saves complete elsewhere in the app.
  useEffect(() => {
    const onTasksChanged = () => {
      debugLog('[useTaskData] wellness:tasks-changed — refreshing');
      refresh();
    };
    window.addEventListener('wellness:tasks-changed', onTasksChanged);
    return () => window.removeEventListener('wellness:tasks-changed', onTasksChanged);
  }, [refresh]);

  return {
    tasks,
    loading,
    error,
    refresh,
  };
}
