/**
 * useDownlineWeightReport.js — State and data fetching for the
 * Downline Weight Status report.
 *
 * Exposes:
 *   self            — logged-in coach's weight row
 *   members         — full descendant list from the API (pre-sorted)
 *   teamScope       — active team scope filter
 *   setTeamScope    — change team scope
 *   statusFilter    — active status filter
 *   setStatusFilter — change status filter
 *   searchQuery     — active search string
 *   setSearchQuery  — change search string
 *   statusCounts    — counts scoped to teamScope (before status/search filters)
 *   filtered        — rows after team scope + status + search filters
 *   teamPerformanceByUserId — coaches with downline → per-coach summary stats
 *   loading         — true while fetch is in flight
 *   error           — string error message or null
 *   refresh         — function to re-fetch data
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchDownlineWeightStatus } from '../services/reportsApi.js';
import {
  TEAM_SCOPES,
  STATUS_FILTERS,
  countRowsByStatus,
  countRowsByTeamScope,
  filterRowsByStatus,
  getScopeRows,
} from '../utils/reportFilters.js';
import { filterRowsBySearch } from '../utils/reportSearch.js';
import { buildTeamPerformanceByUserId } from '../utils/reportTeamPerformance.js';

export function useDownlineWeightReport({ coachId }) {
  const [self, setSelf]               = useState(null);
  const [members, setMembers]         = useState([]);
  const [teamScope, setTeamScope]     = useState(TEAM_SCOPES.DIRECT);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.OFF_TRACK);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const fetch = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDownlineWeightStatus(coachId);
      setSelf(data?.self ?? null);
      setMembers(Array.isArray(data?.members) ? data.members : []);
    } catch (err) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    setSearchQuery('');
  }, [teamScope]);

  const scopeRows = useMemo(
    () => getScopeRows(self, members, teamScope),
    [self, members, teamScope],
  );

  const teamScopeCounts = useMemo(
    () => countRowsByTeamScope(self, members),
    [self, members],
  );

  const statusCounts = useMemo(
    () => countRowsByStatus(scopeRows),
    [scopeRows],
  );

  const statusFilteredRows = useMemo(
    () => filterRowsByStatus(scopeRows, statusFilter),
    [scopeRows, statusFilter],
  );

  const filtered = useMemo(
    () => filterRowsBySearch(statusFilteredRows, searchQuery),
    [statusFilteredRows, searchQuery],
  );

  const teamPerformanceByUserId = useMemo(
    () => buildTeamPerformanceByUserId(members),
    [members],
  );

  return {
    self,
    members,
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
    loading,
    error,
    refresh: fetch,
  };
}
