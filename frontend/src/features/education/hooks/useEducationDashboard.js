/**
 * useEducationDashboard.js — slice orchestrator hook.
 *
 * Owns log/summary fetching, infinite-scroll pagination, optimistic
 * delete + undo flow and exposes a flat view-model. UI/swipe state
 * lives in the components that actually need it.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import { fetchEducationLogsPage, fetchEducationSummary } from '../services/educationDashboardService';
import { buildMonthlyGroups, buildTrendSeries, filterLogsByDay } from '../services/educationDashboardFormatter';
import { useEducationUndoActions } from './useEducationUndoActions';

export const UNDO_SECONDS = 10;
const PAGE_SIZE = 10;

export function useEducationDashboard({ user, apiBaseUrl, refreshKey = 0, selectedDate = null }) {
  const [educationLogs, setEducationLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [undoState, setUndoState] = useState({});
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [trendRangeDays, setTrendRangeDays] = useState(7);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const userIdRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const offsetRef = useRef(0);

  const refreshSummary = useCallback(async () => {
    const userId = userIdRef.current || user?.id;
    if (!userId) return;
    try {
      const next = await fetchEducationSummary({ apiBaseUrl, userId });
      if (next) setSummary(next);
    } catch (err) { console.error('Fetch summary error:', err); }
  }, [apiBaseUrl, user?.id]);

  const loadPage = useCallback(async ({ reset = false } = {}) => {
    try {
      if (reset) setLoading(true);
      else {
        if (loadingMoreRef.current || !hasMoreRef.current) return;
        loadingMoreRef.current = true; setLoadingMore(true);
      }
      setError(null);
      if (!userIdRef.current) userIdRef.current = user?.id || (await getUserId(user));
      const userId = userIdRef.current;
      if (!userId) throw new Error('User not authenticated');
      const offset = reset ? 0 : offsetRef.current;
      const requests = [fetchEducationLogsPage({ apiBaseUrl, userId, limit: PAGE_SIZE, offset })];
      if (reset) requests.push(fetchEducationSummary({ apiBaseUrl, userId }));
      const [pageResult, nextSummary] = await Promise.all(requests);
      const { rows, hasMore } = pageResult;
      setEducationLogs((prev) => {
        if (reset) return rows;
        const seen = new Set(prev.map((e) => e?.Id));
        return prev.concat(rows.filter((r) => !seen.has(r.Id)));
      });
      offsetRef.current = offset + rows.length;
      hasMoreRef.current = hasMore;
      setHasMoreLogs(hasMore);
      if (reset) {
        if (nextSummary) setSummary(nextSummary);
        setSummaryLoading(false);
      }
    } catch (err) {
      console.error('Fetch education logs error:', err);
      setError(err.message || 'Failed to load education logs');
      if (reset) setSummaryLoading(false);
    } finally {
      if (reset) setLoading(false);
      else { loadingMoreRef.current = false; setLoadingMore(false); }
    }
  }, [apiBaseUrl, user]);

  useEffect(() => {
    if (!user?.id) return;
    userIdRef.current = null;
    setEducationLogs([]); setHasMoreLogs(false);
    offsetRef.current = 0; hasMoreRef.current = false;
    loadPage({ reset: true });
  }, [user?.id, user?.email, refreshKey, loadPage]);

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e?.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) loadPage({ reset: false });
    }, { rootMargin: '300px', threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreLogs, loading, loadPage]);

  const undoActions = useEducationUndoActions({
    apiBaseUrl, user, userIdRef, setEducationLogs, setUndoState, refreshSummary,
  });

  // Log list is scoped to the selected day when one is provided (the shell
  // date picker drives this). Trend + summary keep using the full set so
  // the summary/trend cards stay meaningful.
  const dayFilteredLogs = useMemo(
    () => filterLogsByDay(educationLogs, selectedDate), [educationLogs, selectedDate],
  );
  const monthlyGroups = useMemo(() => buildMonthlyGroups(dayFilteredLogs), [dayFilteredLogs]);
  const trendSeries = useMemo(() => buildTrendSeries(educationLogs, trendRangeDays), [educationLogs, trendRangeDays]);

  return {
    user, apiBaseUrl, userIdRef,
    educationLogs, loading, error, summary, summaryLoading,
    monthlyGroups, trendSeries, trendRangeDays, setTrendRangeDays,
    hasMoreLogs, loadingMore, loadMoreSentinelRef,
    undoState, ...undoActions,
  };
}
