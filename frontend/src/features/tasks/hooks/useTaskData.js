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
 * whose time windows already opened today but whose cron run was missed.
 * Fire-and-forget — errors are non-fatal.
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
    return json?.data?.createdCount ?? 0;
  } catch (err) {
    debugLog('[useTaskData] catchup failed (non-critical):', err.message);
    return 0;
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

        // On first load, always run catch-up so missed windows (e.g. education
        // at 07:15 when cron was down) are backfilled even if some tasks exist.
        if (runCatchup) {
          debugLog('[useTaskData] Running catch-up for missed windows', { existingCount: fetched.length });
          const created = await triggerCatchup(apiBaseUrl, userId);
          // #region agent log
          fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fbd973'},body:JSON.stringify({sessionId:'fbd973',location:'useTaskData.js:catchup',message:'catchup completed',data:{existingCount:fetched.length,createdCount:created},timestamp:Date.now(),hypothesisId:'H-catchup',runId:'post-fix'})}).catch(()=>{});
          // #endregion
          if (created > 0) {
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
              });
              return;
            }
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

  // Initial fetch — run catch-up on first load only
  useEffect(() => {
    fetchTasks({ runCatchup: true });
  }, [fetchTasks]);

  // Manual refresh — no catch-up (user-triggered, tasks may just be completed)
  const refresh = useCallback(() => {
    setLoading(true);
    fetchTasks({ runCatchup: false });
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    refresh,
  };
}
