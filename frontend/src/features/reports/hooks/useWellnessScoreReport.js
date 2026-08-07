/**
 * useWellnessScoreReport — paginated fetch + infinite scroll for the report.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWellnessScoreReport,
  clearWellnessScoreReportPageCache,
  WELLNESS_SCORE_REPORT_PAGE_SIZE,
} from '../services/wellnessScoreReportApi.js';
import { TEAM_SCOPES } from '../utils/reportFilters.js';

const SEARCH_DEBOUNCE_MS = 300;

export function useWellnessScoreReport({ coachId, tabVisitKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [teamScope, setTeamScope] = useState(TEAM_SCOPES.DIRECT);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [teamScopeCounts, setTeamScopeCounts] = useState({
    mine: 0,
    direct: 0,
    full: 0,
  });
  const [pagination, setPagination] = useState({
    page: 0,
    limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
    totalRecords: 0,
    totalPages: 0,
    hasNextPage: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);
  const inFlightKeyRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setSearchQuery('');
  }, [teamScope]);

  const buildRequestKey = useCallback(
    (page) =>
      [coachId, page, teamScope, debouncedSearch, WELLNESS_SCORE_REPORT_PAGE_SIZE].join('|'),
    [coachId, teamScope, debouncedSearch],
  );

  const fetchPage = useCallback(
    async ({ page = 1, append = false, bustCache = false } = {}) => {
      if (!coachId) return null;

      const requestKey = buildRequestKey(page);
      if (inFlightKeyRef.current === requestKey) return null;

      const requestId = ++requestIdRef.current;
      inFlightKeyRef.current = requestKey;

      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await fetchWellnessScoreReport(coachId, {
          page,
          limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
          search: debouncedSearch,
          teamFilter: teamScope,
          sort: 'name',
          bustCache,
        });

        if (!mountedRef.current || requestId !== requestIdRef.current) return null;

        const pageMembers = Array.isArray(data?.members) ? data.members : [];
        setTeamScopeCounts(data?.teamScopeCounts || { mine: 0, direct: 0, full: 0 });
        setPagination(
          data?.pagination || {
            page,
            limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
            totalRecords: pageMembers.length,
            totalPages: 1,
            hasNextPage: false,
          },
        );
        setRows((prev) => {
          if (!append) return pageMembers;
          const seen = new Set(prev.map((r) => r.userId));
          return [...prev, ...pageMembers.filter((r) => !seen.has(r.userId))];
        });
        return data;
      } catch (err) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return null;
        setError(err.message || 'Failed to load report');
        return null;
      } finally {
        if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = null;
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [coachId, teamScope, debouncedSearch, buildRequestKey],
  );

  useEffect(() => {
    if (!coachId) return undefined;

    requestIdRef.current += 1;
    inFlightKeyRef.current = null;
    setRows([]);
    setPagination({
      page: 0,
      limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
      totalRecords: 0,
      totalPages: 0,
      hasNextPage: false,
    });

    const timer = setTimeout(() => {
      fetchPage({ page: 1, append: false });
    }, 40);

    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
      inFlightKeyRef.current = null;
    };
  }, [coachId, teamScope, debouncedSearch, tabVisitKey, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (!pagination.hasNextPage) return;
    const nextPage = (pagination.page || pagination.currentPage || 1) + 1;
    fetchPage({ page: nextPage, append: true });
  }, [loading, loadingMore, pagination, fetchPage]);

  const refresh = useCallback(() => {
    clearWellnessScoreReportPageCache();
    requestIdRef.current += 1;
    inFlightKeyRef.current = null;
    setRows([]);
    fetchPage({ page: 1, append: false, bustCache: true });
  }, [fetchPage]);

  return {
    rows,
    teamScope,
    setTeamScope,
    searchQuery,
    setSearchQuery,
    teamScopeCounts,
    pagination,
    loading,
    loadingMore,
    hasNextPage: pagination.hasNextPage === true,
    loadMore,
    error,
    refresh,
  };
}
