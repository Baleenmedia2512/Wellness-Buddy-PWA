/**
 * useDownlineWeightReport.js — State and data fetching for the
 * Downline Weight Status report (server-paginated + infinite scroll).
 *
 * Exposes the same filter/search surface as before; member rows accumulate
 * across pages. Filter changes reset to page 1 and cancel in-flight work.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchDownlineWeightStatus,
  clearDownlineWeightPageCache,
  DOWNLINE_WEIGHT_PAGE_SIZE,
} from '../services/reportsApi.js';
import {
  TEAM_SCOPES,
  STATUS_FILTERS,
} from '../utils/reportFilters.js';

const SEARCH_DEBOUNCE_MS = 300;

export function useDownlineWeightReport({ coachId, tabVisitKey = 0 }) {
  const [self, setSelf] = useState(null);
  const [filtered, setFiltered] = useState([]);
  const [teamScope, setTeamScope] = useState(TEAM_SCOPES.DIRECT);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.OFF_TRACK);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusCounts, setStatusCounts] = useState({
    off_track: 0,
    on_track: 0,
    no_data: 0,
    all: 0,
  });
  const [teamScopeCounts, setTeamScopeCounts] = useState({
    mine: 0,
    direct: 0,
    full: 0,
  });
  const [pagination, setPagination] = useState({
    page: 0,
    limit: DOWNLINE_WEIGHT_PAGE_SIZE,
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
      [
        coachId,
        page,
        teamScope,
        statusFilter,
        debouncedSearch,
        DOWNLINE_WEIGHT_PAGE_SIZE,
      ].join('|'),
    [coachId, teamScope, statusFilter, debouncedSearch],
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
        const data = await fetchDownlineWeightStatus(coachId, {
          page,
          limit: DOWNLINE_WEIGHT_PAGE_SIZE,
          search: debouncedSearch,
          teamFilter: teamScope,
          statusFilter,
          sort: 'status',
          bustCache,
        });

        if (!mountedRef.current || requestId !== requestIdRef.current) return null;

        const pageMembers = Array.isArray(data?.members) ? data.members : [];
        setSelf(data?.self ?? null);
        setStatusCounts(
          data?.statusCounts || { off_track: 0, on_track: 0, no_data: 0, all: 0 },
        );
        setTeamScopeCounts(
          data?.teamScopeCounts || { mine: 0, direct: 0, full: 0 },
        );
        setPagination(
          data?.pagination || {
            page,
            limit: DOWNLINE_WEIGHT_PAGE_SIZE,
            totalRecords: pageMembers.length,
            totalPages: 1,
            hasNextPage: false,
          },
        );
        setFiltered((prev) => {
          if (!append) return pageMembers;
          const seen = new Set(prev.map((row) => row.userId));
          return [...prev, ...pageMembers.filter((row) => !seen.has(row.userId))];
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
    [coachId, teamScope, statusFilter, debouncedSearch, buildRequestKey],
  );

  // Reset + fetch page 1 when filters / coach / tab visit change.
  useEffect(() => {
    if (!coachId) return undefined;

    requestIdRef.current += 1;
    inFlightKeyRef.current = null;
    setFiltered([]);
    setPagination({
      page: 0,
      limit: DOWNLINE_WEIGHT_PAGE_SIZE,
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
  }, [coachId, teamScope, statusFilter, debouncedSearch, tabVisitKey, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (!pagination.hasNextPage) return;
    const nextPage = (pagination.page || pagination.currentPage || 1) + 1;
    fetchPage({ page: nextPage, append: true });
  }, [loading, loadingMore, pagination, fetchPage]);

  const refresh = useCallback(() => {
    clearDownlineWeightPageCache();
    requestIdRef.current += 1;
    inFlightKeyRef.current = null;
    setFiltered([]);
    fetchPage({ page: 1, append: false, bustCache: true });
  }, [fetchPage]);

  /** Prefer API-attached teamPerformance (partial member lists are incomplete for rebuild). */
  const teamPerformanceByUserId = useMemo(() => {
    const map = {};
    if (self?.teamPerformance && self?.userId != null) {
      map[Number(self.userId)] = self.teamPerformance;
    }
    for (const row of filtered) {
      if (row?.teamPerformance && row?.userId != null) {
        map[Number(row.userId)] = row.teamPerformance;
      }
    }
    return map;
  }, [self, filtered]);

  return {
    self,
    members: filtered,
    teamScope,
    setTeamScope,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    teamScopeCounts,
    statusCounts,
    filtered,
    teamPerformanceByUserId,
    pagination,
    loading,
    loadingMore,
    hasNextPage: pagination.hasNextPage === true,
    loadMore,
    error,
    refresh,
  };
}
