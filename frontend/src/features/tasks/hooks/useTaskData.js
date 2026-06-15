/**
 * useTaskData.js — Hook for fetching and managing task data
 * 
 * Responsibilities:
 * - Fetch tasks from API
 * - Auto-refresh periodically
 * - Handle loading/error states
 */

import { useState, useEffect, useCallback } from 'react';
import { debugLog } from '../../../shared/utils/logger';
import { getApiBaseUrl } from '../../../config/api.config';

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
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '4c8196',
        }
      });

      const data = await response.json();

      // #region agent log
      fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4c8196'},body:JSON.stringify({sessionId:'4c8196',location:'useTaskData.js:fetchTasks',message:'tasks/list response',data:{userId,apiBaseUrl,status:response.status,ok:data.ok,errorCode:data.error?.code,errorMessage:data.error?.message,debugError:data.error?.debugError,hasStack:Boolean(data.error?.stack)},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
      // #endregion

      if (data.ok) {
        setTasks(data.data.tasks || []);
        setError(null);
        debugLog('[useTaskData] Tasks fetched successfully', { count: data.data.tasks?.length });
      } else {
        throw new Error(data.error?.debugError || data.error?.message || 'Failed to fetch tasks');
      }
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4c8196'},body:JSON.stringify({sessionId:'4c8196',location:'useTaskData.js:catch',message:'tasks/list fetch failed',data:{userId,error:err.message},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
      // #endregion
      debugLog('[useTaskData] Error fetching tasks', { error: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, apiBaseUrl]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Refresh function
  const refresh = useCallback(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    refresh
  };
}
