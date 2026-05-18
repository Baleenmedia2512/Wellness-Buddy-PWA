/**
 * useDisciplineReport.js — slice orchestrator hook for the discipline report.
 *
 * Owns fetch + filter/sort/team-view/expand state and exposes a flat
 * view-model consumed by the orchestrator + tab components.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { teamHierarchyService } from '../../../shared/services/teamHierarchyService';
import { disciplineReportService, clearDisciplineReportCache } from '../services/disciplineReportService';
import { enrichHierarchy, buildDisciplineMaps } from '../services/disciplineReportEnricher';
import {
import { debugLog } from '../../../shared/utils/logger.js';
  sortHierarchy, applyTeamView, getTeamCounts,
  buildSummaryStats, buildHierarchySummaryStats, hasVisibleNodes,
} from '../services/disciplineReportFormatter';

const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function useDisciplineReport({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState('asc');
  const [sortBy, setSortBy] = useState('name');
  const [showSettings, setShowSettings] = useState(false);
  const [teamView, setTeamView] = useState('direct');
  const [profileModalEmail, setProfileModalEmail] = useState(null);
  const [expandOverride, setExpandOverride] = useState('collapsed');
  const lastExpandState = useRef('collapsed');

  const fetchData = useCallback(async (isBackground = false) => {
    if (!user?.id) return;
    if (!isBackground) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      let customRange = null;
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        customRange = { start: formatDate(customStartDate), end: formatDate(customEndDate) };
      }
      const [hierarchyResponse, teamDataResponse, allMembersResponse] = await Promise.all([
        teamHierarchyService.getTeamHierarchy(user.id, false),
        disciplineReportService.getDisciplineReport(user.id, dateRange, customRange),
        disciplineReportService.getAllMembersDisciplineReport(user.id, dateRange, customRange),
      ]);
      const maps = buildDisciplineMaps(allMembersResponse, teamDataResponse);
      setHierarchyData(enrichHierarchy(hierarchyResponse.hierarchy, maps));
    } catch (err) {
      console.error('Failed to load discipline report:', err);
      setError(`Failed to load report: ${err.response?.data?.message || err.message}`);
    } finally {
      if (!isBackground) setLoading(false); else setRefreshing(false);
    }
  }, [user?.id, dateRange, customStartDate, customEndDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedHierarchyData = useMemo(
    () => (hierarchyData ? sortHierarchy(hierarchyData, { sortBy, sortOrder }) : null),
    [hierarchyData, sortBy, sortOrder],
  );
  const filteredHierarchy = useMemo(
    () => applyTeamView(sortedHierarchyData, teamView),
    [sortedHierarchyData, teamView],
  );
  const visibleHierarchy = useMemo(
    () => (filteredHierarchy && hasVisibleNodes(filteredHierarchy, { searchQuery, filter })
      ? filteredHierarchy : null),
    [filteredHierarchy, searchQuery, filter],
  );
  const summaryStats = useMemo(() => buildSummaryStats(hierarchyData), [hierarchyData]);
  const hierarchySummaryStats = useMemo(
    () => buildHierarchySummaryStats(sortedHierarchyData),
    [sortedHierarchyData],
  );
  const teamCounts = useMemo(
    () => (sortedHierarchyData ? getTeamCounts(sortedHierarchyData) : { total: 0 }),
    [sortedHierarchyData],
  );

  const handleManualRefresh = () => { clearDisciplineReportCache(); fetchData(true); };
  const handleDateRangeSelect = (start, end) => {
    setCustomStartDate(start); setCustomEndDate(end); setDateRange('custom');
  };
  const handleSortChange = (_newSortBy, newSortOrder) => { setSortBy('name'); setSortOrder(newSortOrder); };
  const handleExpandAll = () => { lastExpandState.current = 'expanded'; setExpandOverride('expanded'); };
  const handleCollapseAll = () => { lastExpandState.current = 'collapsed'; setExpandOverride('collapsed'); };
  const handleSettings = () => setShowSettings((v) => !v);
  const handleSettingsUpdate = () => { clearDisciplineReportCache(); fetchData(true); };
  const handleDownload = () => { debugLog('Download discipline report'); };

  return {
    loading, refreshing, error,
    hierarchyData, visibleHierarchy, summaryStats, hierarchySummaryStats, teamCounts,
    dateRange, setDateRange, customStartDate, customEndDate,
    searchQuery, setSearchQuery, filter, setFilter,
    sortOrder, sortBy, teamView, setTeamView,
    expandOverride, profileModalEmail, setProfileModalEmail,
    showSettings, setShowSettings,
    handleManualRefresh, handleDateRangeSelect, handleSortChange,
    handleExpandAll, handleCollapseAll, handleSettings, handleSettingsUpdate, handleDownload,
  };
}
