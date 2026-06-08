/**
 * useWeightProgressCheck.js
 * Custom hook to check for reverse weight progress and fetch tips.
 */
import { useState, useCallback } from 'react';
import { fetchWeightProgressCheck } from '../api/weightProgressClient.js';

export function useWeightProgressCheck() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkProgress = useCallback(async (userId, currentWeightId = null) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchWeightProgressCheck(userId, currentWeightId);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to check weight progress');
      setData(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    checkProgress,
    reset,
    shouldShow: data?.shouldShow || false,
    comparison: data?.comparison || null,
    tips: data?.tips || [],
    goalMode: data?.goalMode || null,
  };
}
