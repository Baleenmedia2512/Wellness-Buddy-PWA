/**
 * useWellnessScoreReport — cache-first UI, background refresh, fast date switches.
 * Prefetches Yesterday after Today loads so date taps feel instant.
 * Supports interactive column sort (sort + sortDir) with server pagination.
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
  yesterdayBusinessDate,
  dateToBusinessYmd,
} from '../utils/reportDateFilter.js';
import {
  REPORT_SORT_KEYS,
  REPORT_SORT_DIRS,
  nextReportSortState,
} from '../utils/wellnessScoreReportSort.js';

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

function prefetchReportPage(coachId, { page, search, teamFilter, date, sort, sortDir }) {
  if (!coachId || !date) return;
  const peek = peekWellnessScoreReportCache(coachId, {
    page,
    limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
    search,
    teamFilter,
    sort,
    sortDir,
    date,
  });
  if (peek.fresh) return;
  fetchWellnessScoreReport(coachId, {
    page,
    limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
    search,
    teamFilter,
    sort,
    sortDir,
    date,
  }).catch(() => {});
}

export function useWellnessScoreReport({ coachId, tabVisitKey = 0 }) {
  /** @type {[import('../utils/wellnessScoreReportSort.js').WellnessScoreReportRow[], Function]} */
  const [rows, setRows] = useState([]);
  const [teamScope, setTeamScope] = useState(TEAM_SCOPES.DIRECT);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [datePreset, setDatePreset] = useState(DATE_PRESETS.TODAY);
  const [customDate, setCustomDate] = useState(null);
  const [sort, setSort] = useState(REPORT_SORT_KEYS.SCORE);
  const [sortDir, setSortDir] = useState(REPORT_SORT_DIRS.DESC);
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
  const rowsLenRef = useRef(0);
  const stateRef = useRef({
    coachId,
    teamScope,
    debouncedSearch,
    selectedDate: resolveReportScoreDate(datePreset, customDate),
    sort,
    sortDir,
    paginationPage: 1,
  });

  const selectedDate = resolveReportScoreDate(datePreset, customDate);
  stateRef.current = {
    coachId,
    teamScope,
    debouncedSearch,
    selectedDate,
    sort,
    sortDir,
    paginationPage: pagination.page || 1,
  };
  rowsLenRef.current = rows.length;

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

  const schedulePrefetchNeighbors = useCallback((id, scope, search, date, sortKey, sortDirection) => {
    if (!id || !date) return;
    window.setTimeout(() => {
      if (!mountedRef.current) return;
      const yesterday = yesterdayBusinessDate();
      if (date !== yesterday) {
        prefetchReportPage(id, {
          page: 1,
          search,
          teamFilter: scope,
          date: yesterday,
          sort: sortKey,
          sortDir: sortDirection,
        });
      }
      prefetchReportPage(id, {
        page: 2,
        search,
        teamFilter: scope,
        date,
        sort: sortKey,
        sortDir: sortDirection,
      });
    }, 80);
  }, []);

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
      sort: sortKey,
      sortDir: sortDirection,
    } = stateRef.current;
    if (!id) return null;

    const requestId = ++requestIdRef.current;

    const peek = peekWellnessScoreReportCache(id, {
      page,
      limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
      search,
      teamFilter: scope,
      sort: sortKey,
      sortDir: sortDirection,
      date,
    });

    if (peek.payload && !bustCache) {
      applyPayload(peek.payload, date, setters);
      setLoading(false);
      if (peek.fresh && !background) {
        setRefreshing(false);
        schedulePrefetchNeighbors(id, scope, search, date, sortKey, sortDirection);
        return peek.payload;
      }
      setRefreshing(true);
    } else if (!background && rowsLenRef.current === 0) {
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
        sort: sortKey,
        sortDir: sortDirection,
        date,
        bustCache: bustCache || Boolean(peek.payload),
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return null;

      applyPayload(data, date, setters);
      schedulePrefetchNeighbors(id, scope, search, date, sortKey, sortDirection);
      return data;
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return null;
      if (!peek.payload && rowsLenRef.current === 0) {
        setError(err.message || 'Failed to load report');
      }
      return null;
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [schedulePrefetchNeighbors]);

  useEffect(() => {
    if (!coachId) return undefined;

    requestIdRef.current += 1;

    const peek = peekWellnessScoreReportCache(coachId, {
      page: 1,
      limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
      search: debouncedSearch,
      teamFilter: teamScope,
      sort,
      sortDir,
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
    }

    const timer = setTimeout(() => {
      fetchPage({
        page: 1,
        background: Boolean(peek.payload) || rowsLenRef.current > 0,
      });
    }, 0);

    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [coachId, teamScope, debouncedSearch, selectedDate, sort, sortDir, tabVisitKey, fetchPage]);

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
        sort,
        sortDir,
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
      fetchPage({ page, background: Boolean(peek.payload) || rowsLenRef.current > 0 });
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
      sort,
      sortDir,
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
    if (coachId) {
      prefetchReportPage(coachId, {
        page: 1,
        search: debouncedSearch,
        teamFilter: teamScope,
        date: yesterdayBusinessDate(),
        sort,
        sortDir,
      });
    }
    setDatePreset(DATE_PRESETS.YESTERDAY);
    setCustomDate(null);
  }, [coachId, debouncedSearch, teamScope, sort, sortDir]);

  const selectCustomDate = useCallback((date) => {
    const ymd = dateToBusinessYmd(date);
    if (coachId && ymd) {
      prefetchReportPage(coachId, {
        page: 1,
        search: debouncedSearch,
        teamFilter: teamScope,
        date: ymd,
        sort,
        sortDir,
      });
    }
    setCustomDate(date);
    setDatePreset(DATE_PRESETS.CUSTOM);
  }, [coachId, debouncedSearch, teamScope, sort, sortDir]);

  const setSortColumn = useCallback((columnKey) => {
    const next = nextReportSortState(columnKey, sort, sortDir);
    setSort(next.sort);
    setSortDir(next.sortDir);
  }, [sort, sortDir]);

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
    sort,
    sortDir,
    setSortColumn,
    refreshing,
    loading,
    error,
    refresh,
    goToPage,
    goNext,
    goPrevious,
  };
}
