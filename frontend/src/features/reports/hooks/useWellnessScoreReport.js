/**
 * useWellnessScoreReport — server-side pagination + date filter (no full-table load).
 * Effect deps exclude fetchPage identity to avoid duplicate StrictMode / recreate fetches.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWellnessScoreReport,
  clearWellnessScoreReportPageCache,
  WELLNESS_SCORE_REPORT_PAGE_SIZE,
} from '../services/wellnessScoreReportApi.js';
import { TEAM_SCOPES } from '../utils/reportFilters.js';
import {
  DATE_PRESETS,
  resolveReportScoreDate,
} from '../utils/reportDateFilter.js';

const SEARCH_DEBOUNCE_MS = 300;

export function useWellnessScoreReport({ coachId, tabVisitKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [teamScope, setTeamScope] = useState(TEAM_SCOPES.DIRECT);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [datePreset, setDatePreset] = useState(DATE_PRESETS.TODAY);
  const [customDate, setCustomDate] = useState(null);
  const [teamScopeCounts, setTeamScopeCounts] = useState({
    mine: 0,
    direct: 0,
    full: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
    totalRecords: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [scoreDate, setScoreDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const stateRef = useRef({
    coachId,
    teamScope,
    debouncedSearch,
    selectedDate: resolveReportScoreDate(datePreset, customDate),
    paginationPage: 1,
  });

  const selectedDate = resolveReportScoreDate(datePreset, customDate);
  stateRef.current = {
    coachId,
    teamScope,
    debouncedSearch,
    selectedDate,
    paginationPage: pagination.page || 1,
  };

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

  const fetchPage = useCallback(async ({ page = 1, bustCache = false } = {}) => {
    const {
      coachId: id,
      teamScope: scope,
      debouncedSearch: search,
      selectedDate: date,
    } = stateRef.current;
    if (!id) return null;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchWellnessScoreReport(id, {
        page,
        limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
        search,
        teamFilter: scope,
        sort: 'score',
        date,
        bustCache,
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return null;

      const pageMembers = Array.isArray(data?.members) ? data.members : [];
      setTeamScopeCounts(data?.teamScopeCounts || { mine: 0, direct: 0, full: 0 });
      setScoreDate(data?.scoreDate || date);
      setPagination(
        data?.pagination || {
          page,
          limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
          totalRecords: pageMembers.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      );
      setRows(pageMembers);
      return data;
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return null;
      setError(err.message || 'Failed to load report');
      return null;
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!coachId) return undefined;

    requestIdRef.current += 1;
    setRows([]);
    setPagination({
      page: 1,
      limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
      totalRecords: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    const timer = setTimeout(() => {
      fetchPage({ page: 1 });
    }, 0);

    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
    // Intentionally omit fetchPage — stable via ref'd state.
  }, [coachId, teamScope, debouncedSearch, selectedDate, tabVisitKey, fetchPage]);

  const goToPage = useCallback(
    (nextPage) => {
      const page = Math.max(1, Number(nextPage) || 1);
      if (loading) return;
      if (pagination.totalPages > 0 && page > pagination.totalPages) return;
      if (page === pagination.page) return;
      fetchPage({ page });
    },
    [loading, pagination.page, pagination.totalPages, fetchPage],
  );

  const goNext = useCallback(() => {
    if (loading || !pagination.hasNextPage) return;
    goToPage((pagination.page || 1) + 1);
  }, [loading, pagination.hasNextPage, pagination.page, goToPage]);

  const goPrevious = useCallback(() => {
    if (loading || !pagination.hasPreviousPage) return;
    goToPage((pagination.page || 1) - 1);
  }, [loading, pagination.hasPreviousPage, pagination.page, goToPage]);

  const refresh = useCallback(() => {
    clearWellnessScoreReportPageCache();
    fetchPage({ page: stateRef.current.paginationPage || 1, bustCache: true });
  }, [fetchPage]);

  const selectToday = useCallback(() => {
    setDatePreset(DATE_PRESETS.TODAY);
    setCustomDate(null);
  }, []);

  const selectYesterday = useCallback(() => {
    setDatePreset(DATE_PRESETS.YESTERDAY);
    setCustomDate(null);
  }, []);

  const selectCustomDate = useCallback((date) => {
    setCustomDate(date);
    setDatePreset(DATE_PRESETS.CUSTOM);
  }, []);

  return {
    rows,
    teamScope,
    setTeamScope,
    searchQuery,
    setSearchQuery,
    teamScopeCounts,
    pagination,
    scoreDate: scoreDate || selectedDate,
    selectedDate,
    datePreset,
    customDate,
    selectToday,
    selectYesterday,
    selectCustomDate,
    loading,
    error,
    refresh,
    goToPage,
    goNext,
    goPrevious,
  };
}
