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
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.ok) {
        setTasks(data.data.tasks || []);
        setError(null);
        debugLog('[useTaskData] Tasks fetched successfully', { count: data.data.tasks?.length });
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
