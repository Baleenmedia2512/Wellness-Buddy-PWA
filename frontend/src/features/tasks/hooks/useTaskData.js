/**
 * useTaskData.js — Hook for fetching and managing task data
 *
 * Responsibilities:
 * - Fetch tasks from API (single GET /api/tasks/list per request)
 * - Run recovery catchup ONCE per IST day (not on every panel open)
 * - Handle loading/error states
 *
 * Architecture note:
 *   /api/tasks/list already calls reconcilePendingTasksForUser() on every
 *   request, so stale pending tasks are fixed without a separate catchup call.
 *   Catchup (creating missing task rows when cron was down) only needs to run
 *   once per day — subsequent opens within the same day see identical rows.
 */

import { useState, useEffect, useCallback } from 'react';
import { debugLog } from '../../../shared/utils/logger';
import { getApiBaseUrl } from '../../../config/api.config';

/** IST date string "YYYY-MM-DD" for today. */
function istDateToday() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().substring(0, 10);
}

const CATCHUP_DATE_KEY = 'wv.taskPanel.catchupDate';

/**
 * Run POST /api/tasks/catchup at most once per IST calendar day.
 * Recovery-only: creates any task rows that cron missed.
 * Does NOT send FCM (handled server-side at task-creation time).
 * Idempotent — safe to call any number of times; localStorage gate prevents
 * redundant API calls within the same day.
 */
async function runCatchupOnceToday(apiBaseUrl, userId) {
  const today = istDateToday();
  if (localStorage.getItem(CATCHUP_DATE_KEY) === today) return; // already done today
  localStorage.setItem(CATCHUP_DATE_KEY, today);

  try {
    const res = await fetch(`${apiBaseUrl}/api/tasks/catchup?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    debugLog('[useTaskData] daily catchup result', {
      createdCount: json?.data?.createdCount ?? 0,
      reconciledCount: json?.data?.reconciledCount ?? 0,
    });
  } catch (err) {
    // Non-critical: catchup failure means missed-cron rows may not appear until
    // the next day's catchup. The cron itself is the primary task-creation path.
    debugLog('[useTaskData] daily catchup failed (non-critical):', err.message);
    // Reset date key so the next panel open retries.
    localStorage.removeItem(CATCHUP_DATE_KEY);
  }
}

export function useTaskData(userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiBaseUrl = getApiBaseUrl();

  const fetchTasks = useCallback(async () => {
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
        setTasks(data.data.tasks || []);
        setError(null);
        debugLog('[useTaskData] Tasks fetched', { count: (data.data.tasks || []).length });
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

  // On mount: run recovery catchup once today, then fetch.
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      await runCatchupOnceToday(apiBaseUrl, userId);
      await fetchTasks();
    })();
  }, [fetchTasks, userId, apiBaseUrl]);

  // Manual refresh — simple re-fetch (reconcile runs inside list endpoint).
  const refresh = useCallback(() => {
    setLoading(true);
    fetchTasks();
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
