/**
 * useTokenManagement.js — main token-data fetch lifecycle.
 *
 * Owns: tokenData, loading, refreshing, apiError, lastUpdated.
 * Re-fetches whenever the time range / custom dates change.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchTokenUsage } from '../services/adminApi';

export default function useTokenManagement({ email, timeRange, customStartDate, customEndDate }) {
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    if (!email) return;
    try {
      setLoading(true);
      setRefreshing(true);
      setApiError(null);
      const data = await fetchTokenUsage({
        email, timeRange, startDate: customStartDate, endDate: customEndDate,
      });
      setTokenData(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[useTokenManagement] fetch failed:', err);
      setApiError(err.message || 'Network error');
      setTokenData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [email, timeRange, customStartDate, customEndDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** Apply locally-saved correction to the in-memory summary so the UI
   *  reflects the new totals without a refetch. */
  const applyCorrectionToSummary = useCallback((inputCost, outputCost) => {
    setTokenData((prev) => {
      if (!prev?.summary) return prev;
      return {
        ...prev,
        summary: {
          ...prev.summary,
          totalInputCost: inputCost,
          totalOutputCost: outputCost,
          totalCost: inputCost + outputCost,
        },
      };
    });
  }, []);

  return {
    tokenData, loading, refreshing, apiError, lastUpdated,
    refetch: fetchData, applyCorrectionToSummary,
  };
}
