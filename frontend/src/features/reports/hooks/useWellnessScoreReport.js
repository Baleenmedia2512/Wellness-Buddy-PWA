/**
 * useWellnessScoreReport — cache-first UI, background refresh.
 * Shows cached rows immediately, then silently revalidates.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWellnessScoreReport,
  peekWellnessScoreReportCache,
  clearWellnessScoreReportPageCache,
  WELLNESS_SCORE_REPORT_PAGE_SIZE,
} from '../services/wellnessScoreReportApi.js';
import { TEAM_SCOPES } from '../utils/reportFilters.js';
import {
  DATE_PRESETS,
  resolveReportScoreDate,
} from '../utils/reportDateFilter.js';

const SEARCH_DEBOUNCE_MS = 300;

function applyPayload(data, date, setters) {
  const pageMembers = Array.isArray(data?.members) ? data.members : [];
  setters.setTeamScopeCounts(data?.teamScopeCounts || { mine: 0, direct: 0, full: 0 });
  setters.setScoreDate(data?.scoreDate || date);
  setters.setPagination(
    data?.pagination || {
      page: 1,
      limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
      totalRecords: pageMembers.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  );
  setters.setRows(pageMembers);
}

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
  const [refreshing, setRefreshing] = useState(false);
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

  const setters = {
    setTeamScopeCounts,
    setScoreDate,
    setPagination,
    setRows,
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

  const fetchPage = useCallback(async ({
    page = 1,
    bustCache = false,
    background = false,
  } = {}) => {
    const {
      coachId: id,
      teamScope: scope,
      debouncedSearch: search,
      selectedDate: date,
    } = stateRef.current;
    if (!id) return null;

    const requestId = ++requestIdRef.current;

    const peek = peekWellnessScoreReportCache(id, {
      page,
      limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
      search,
      teamFilter: scope,
      sort: 'score',
      date,
    });

    if (peek.payload && !bustCache) {
      applyPayload(peek.payload, date, setters);
      setLoading(false);
      if (peek.fresh && !background) {
        setRefreshing(false);
        const nextPage = (peek.payload?.pagination?.page || page) + 1;
        if (peek.payload?.pagination?.hasNextPage) {
          window.setTimeout(() => {
            if (!mountedRef.current) return;
            fetchWellnessScoreReport(id, {
              page: nextPage,
              limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
              search,
              teamFilter: scope,
              sort: 'score',
              date,
            }).catch(() => {});
          }, 50);
        }
        return peek.payload;
      }
      setRefreshing(true);
    } else if (!background) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const data = await fetchWellnessScoreReport(id, {
        page,
        limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
        search,
        teamFilter: scope,
        sort: 'score',
        date,
        bustCache: bustCache || Boolean(peek.payload),
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return null;

      applyPayload(data, date, setters);

      const nextPage = (data?.pagination?.page || page) + 1;
      if (data?.pagination?.hasNextPage) {
        window.setTimeout(() => {
          if (!mountedRef.current) return;
          fetchWellnessScoreReport(id, {
            page: nextPage,
            limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
            search,
            teamFilter: scope,
            sort: 'score',
            date,
          }).catch(() => {});
        }, 50);
      }

      return data;
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return null;
      if (!peek.payload) {
        setError(err.message || 'Failed to load report');
      }
      return null;
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!coachId) return undefined;

    requestIdRef.current += 1;

    const peek = peekWellnessScoreReportCache(coachId, {
      page: 1,
      limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
      search: debouncedSearch,
      teamFilter: teamScope,
      sort: 'score',
      date: selectedDate,
    });

    if (peek.payload) {
      applyPayload(peek.payload, selectedDate, {
        setTeamScopeCounts,
        setScoreDate,
        setPagination,
        setRows,
      });
      setLoading(false);
    } else {
      setRows([]);
      setPagination({
        page: 1,
        limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
        totalRecords: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    }

    const timer = setTimeout(() => {
      fetchPage({ page: 1, background: Boolean(peek.payload) });
    }, 0);

    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [coachId, teamScope, debouncedSearch, selectedDate, tabVisitKey, fetchPage]);

  const goToPage = useCallback(
    (nextPage) => {
      const page = Math.max(1, Number(nextPage) || 1);
      if (loading) return;
      if (pagination.totalPages > 0 && page > pagination.totalPages) return;
      if (page === pagination.page) return;

      const peek = peekWellnessScoreReportCache(coachId, {
        page,
        limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
        search: debouncedSearch,
        teamFilter: teamScope,
        sort: 'score',
        date: selectedDate,
      });
      if (peek.payload) {
        applyPayload(peek.payload, selectedDate, {
          setTeamScopeCounts,
          setScoreDate,
          setPagination,
          setRows,
        });
      }
      fetchPage({ page, background: Boolean(peek.payload) });
    },
    [
      loading,
      pagination.page,
      pagination.totalPages,
      fetchPage,
      coachId,
      debouncedSearch,
      teamScope,
      selectedDate,
    ],
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
    refreshing,
    loading,
    error,
    refresh,
    goToPage,
    goNext,
    goPrevious,
  };
}
