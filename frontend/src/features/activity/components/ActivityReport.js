import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw, Download, Search, Share2, Filter, X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import PhoneContactActions from '../../../shared/components/PhoneContactActions.jsx';
import { ACTIVITY_REPORT_DATE_RANGES, formatCustomRangeLabel } from '../../../shared/domain/reportDateRanges';
import { fetchHasTeamMembers, invalidateHasTeamMembersCache } from '../../team/services/teamSearchService';
import { TEAM_SCOPES, TEAM_SCOPE_OPTIONS } from '../../reports/utils/reportFilters';
import {
  buildActivityReportShareText,
  formatActivityReportLevel,
  formatActivityReportMemberType,
} from '../utils/activityReportShareText';
import {
  ACTIVITY_REPORT_ATTENDANCE,
  activeActivityReportTableFilters,
  activityReportFilterQuery,
  emptyActivityReportFilterOptions,
  emptyActivityReportTableFilterValues,
  formatActivityReportAttendance,
  normalizeActivityReportTableFilters,
  removeActivityReportFilterValue,
  serializeActivityReportTableFilters,
} from '../utils/activityReportTableFilters';
import ActivityReportTableFiltersSheet from './ActivityReportTableFiltersSheet';
import ActivityReportFiltersBar from './ActivityReportFiltersBar';

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function mapRoleForApi(userRole) {
  const n = String(userRole || 'member').toLowerCase();
  if (n === 'admin' || n === 'developer') return 'admin';
  if (n === 'coach' || n === 'upline') return 'coach';
  return 'member';
}

function isBootstrapUnsupportedResponse(data) {
  const msg = String(data?.message || '').toLowerCase();
  return msg.includes('activitytype') || msg.includes('bootstrap');
}

function emptyPagination(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  return {
    totalRecords: 0,
    totalPages: 0,
    currentPage: page,
    pageSize,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

// Activity type metadata
const ACTIVITY_TYPES = [
  { id: 'weight', label: 'Weight' },
  { id: 'education', label: 'Education' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'water', label: 'Water' },
  { id: 'calories', label: 'Exercise' },
];

/** Returns '—' for null, undefined, empty string, or the literal string "N/A" */
const display = (val) => (!val || val === 'N/A') ? '—' : val;

// Main Component
const ActivityReport = ({ user, userRole, apiBaseUrl, onBack, tabVisitKey = 0, teamSearchRefreshKey = 0 }) => {
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState('education');
  const [detailRecords, setDetailRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tableFilters, setTableFilters] = useState(() => emptyActivityReportTableFilterValues());
  const [availableFilters, setAvailableFilters] = useState(() => emptyActivityReportFilterOptions());
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(() => emptyPagination());
  const itemsPerPage = DEFAULT_PAGE_SIZE;

  // Member summary state kept for legacy fallback responses (not rendered in UI).
  const [memberSummaries, setMemberSummaries] = useState([]);
  const [memberStats, setMemberStats] = useState(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [effectiveRole, setEffectiveRole] = useState(() => mapRoleForApi(userRole));
  const [roleReady, setRoleReady] = useState(() => mapRoleForApi(userRole) !== 'member');
  const [teamScope, setTeamScope] = useState(TEAM_SCOPES.DIRECT);
  const [teamScopeCounts, setTeamScopeCounts] = useState(null);
  const [showTeamScope, setShowTeamScope] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState(ACTIVITY_REPORT_ATTENDANCE.ATTENDED);
  const [showReportDatePicker, setShowReportDatePicker] = useState(false);
  const [showTableFiltersSheet, setShowTableFiltersSheet] = useState(false);
  const fetchAbortRef = useRef(null);
  const fetchGenerationRef = useRef(0);
  const loadReportRef = useRef(null);
  const fetchDetailsRef = useRef(null);
  const selectedActivityRef = useRef(selectedActivity);
  const inFlightKeyRef = useRef('');
  const skipSearchSortFetchRef = useRef(true);
  /** @type {React.MutableRefObject<Map<string, { records: Array, pagination: object }>>} */
  const detailCacheRef = useRef(new Map());
  selectedActivityRef.current = selectedActivity;

  const formatDateForApi = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Debounce search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const tableFiltersKey = serializeActivityReportTableFilters(tableFilters);

  const detailCacheKey = useCallback((activityType, page, search, sort, sortDir, filters, attendance) => (
    [
      teamScope,
      dateRange,
      customStartDate ? formatDateForApi(customStartDate) : '',
      customEndDate ? formatDateForApi(customEndDate) : '',
      activityType || '',
      String(page || 1),
      String(itemsPerPage),
      search || '',
      serializeActivityReportTableFilters(filters),
      sort || 'date',
      sortDir || 'desc',
      attendance || attendanceStatus,
    ].join('|')
  ), [teamScope, dateRange, customStartDate, customEndDate, itemsPerPage, attendanceStatus]);

  // Resolve coach role once before the first report fetch (avoids duplicate bootstrap calls).
  useEffect(() => {
    let cancelled = false;
    const baseRole = mapRoleForApi(userRole);
    if (baseRole !== 'member' || !user?.id) {
      setEffectiveRole(baseRole);
      setRoleReady(true);
      return undefined;
    }
    setRoleReady(false);
    if (teamSearchRefreshKey > 0) {
      invalidateHasTeamMembersCache(user.id);
    }
    fetchHasTeamMembers(user.id)
      .then((hasTeam) => {
        if (!cancelled) {
          setEffectiveRole(hasTeam ? 'coach' : 'member');
          setRoleReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEffectiveRole('member');
          setRoleReady(true);
        }
      });
    return () => { cancelled = true; };
  }, [user?.id, userRole, teamSearchRefreshKey]);

  const buildReportParams = useCallback((activityType, extra = {}) => {
    const params = new URLSearchParams({
      userId: String(user.id),
      activityType,
      dateRange,
      role: effectiveRole,
      teamScope,
      attendanceStatus,
    });
    Object.entries(extra).forEach(([key, value]) => {
      if (value != null && value !== '') params.set(key, String(value));
    });
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      params.set('startDate', formatDateForApi(customStartDate));
      params.set('endDate', formatDateForApi(customEndDate));
    }
    return params;
  }, [user?.id, effectiveRole, dateRange, customStartDate, customEndDate, teamScope, attendanceStatus]);

  const applyReportMeta = useCallback((data) => {
    if (data.teamScopeCounts) {
      setTeamScopeCounts(data.teamScopeCounts);
      setShowTeamScope(Boolean(data.teamScopeCounts.hasTeam));
    }
  }, []);

  const applyPaginationMeta = useCallback((data, fallbackPage = 1) => {
    if (data?.pagination) {
      setPagination(data.pagination);
      if (data.pagination.currentPage) {
        setCurrentPage(data.pagination.currentPage);
      }
      return;
    }
    const records = Array.isArray(data?.records) ? data.records : [];
    setPagination({
      totalRecords: records.length,
      totalPages: records.length > 0 ? 1 : 0,
      currentPage: fallbackPage,
      pageSize: itemsPerPage,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  }, [itemsPerPage]);

  const activeScopeLabel = useMemo(() => {
    const option = TEAM_SCOPE_OPTIONS.find((o) => o.value === teamScope);
    if (!option) return '';
    if (teamScope === TEAM_SCOPES.MINE) return option.label;
    const count = teamScopeCounts?.[teamScope] ?? 0;
    return `${option.label} (${count})`;
  }, [teamScope, teamScopeCounts]);

  const activeDateLabel = useMemo(() => {
    const preset = ACTIVITY_REPORT_DATE_RANGES.find((r) => r.value === dateRange);
    if (dateRange === 'custom') {
      return formatCustomRangeLabel(customStartDate, customEndDate);
    }
    return preset?.label || 'Today';
  }, [dateRange, customStartDate, customEndDate]);

  const paginationQuery = useCallback((page = currentPage, overrides = {}) => {
    const filters = overrides.tableFilters ?? tableFilters;
    return {
      page: overrides.page ?? page,
      limit: overrides.limit ?? itemsPerPage,
      search: overrides.search ?? debouncedSearch,
      sort: overrides.sort ?? sortColumn,
      sortDir: overrides.sortDir ?? sortDirection,
      ...activityReportFilterQuery(filters),
      ...(overrides.exportAll ? { exportAll: '1' } : {}),
    };
  }, [currentPage, itemsPerPage, debouncedSearch, sortColumn, sortDirection, tableFilters]);

  const fetchLegacyReportBundle = useCallback(async (detailActivity = 'education') => {
    // Parallelize independent report GETs — previously sequential waterfalls (~3× RTT)
    const pageParams = paginationQuery(1);
    const [summaryRes, memberRes, detailRes] = await Promise.all([
      fetch(
        `${apiBaseUrl}/api/activity/report?${buildReportParams('summary')}`,
        { cache: 'no-store' },
      ),
      fetch(
        `${apiBaseUrl}/api/activity/report?${buildReportParams('member-summary')}`,
        { cache: 'no-store' },
      ),
      fetch(
        `${apiBaseUrl}/api/activity/report?${buildReportParams(detailActivity, pageParams)}`,
        { cache: 'no-store' },
      ),
    ]);
    const [summaryData, memberData, detailData] = await Promise.all([
      summaryRes.json(),
      memberRes.json(),
      detailRes.json(),
    ]);
    if (!summaryRes.ok || !summaryData.success) {
      throw new Error(summaryData.message || 'Failed to fetch activity summary');
    }
    if (!memberRes.ok || !memberData.success) {
      throw new Error(memberData.message || 'Failed to fetch member summaries');
    }
    if (!detailRes.ok || !detailData.success) {
      throw new Error(detailData.message || 'Failed to fetch activity details');
    }

    setSummary(summaryData.summary || null);
    applyReportMeta(summaryData);
    setMemberSummaries(memberData.members || []);
    setMemberStats(memberData.stats || null);
    const records = detailData.records || [];
    setDetailRecords(records);
    applyPaginationMeta(detailData, 1);
    detailCacheRef.current.set(
      detailCacheKey(
        detailActivity, 1, pageParams.search, pageParams.sort, pageParams.sortDir, tableFilters, attendanceStatus,
      ),
      { records, pagination: detailData.pagination || emptyPagination(1) },
    );
  }, [apiBaseUrl, buildReportParams, applyReportMeta, applyPaginationMeta, paginationQuery, detailCacheKey, tableFilters, attendanceStatus]);

  const fetchDetails = useCallback(async (activityType, {
    signal,
    page = 1,
    search = debouncedSearch,
    sort = sortColumn,
    sortDir = sortDirection,
    filters = tableFilters,
    attendance = attendanceStatus,
  } = {}) => {
    if (!user?.id || !apiBaseUrl || !activityType) return;
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return;

    const cacheKey = detailCacheKey(activityType, page, search, sort, sortDir, filters, attendance);
    if (detailCacheRef.current.has(cacheKey)) {
      const cached = detailCacheRef.current.get(cacheKey);
      setDetailRecords(cached.records || []);
      setPagination(cached.pagination || emptyPagination(page));
      setCurrentPage(cached.pagination?.currentPage || page);
      setDetailLoading(false);
      setError('');
      return;
    }

    // Prevent duplicate in-flight requests for the same page key.
    if (inFlightKeyRef.current === cacheKey) return;
    inFlightKeyRef.current = cacheKey;

    setDetailLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/activity/report?${buildReportParams(activityType, {
          page,
          limit: itemsPerPage,
          search,
          sort,
          sortDir,
          attendanceStatus: attendance,
          ...activityReportFilterQuery(filters),
        })}`,
        { cache: 'no-store', signal },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch activity details');
      }

      const records = data.records || [];
      const pageMeta = data.pagination || emptyPagination(page);
      if (data.availableFilters && typeof data.availableFilters === 'object') {
        setAvailableFilters({
          ...emptyActivityReportFilterOptions(),
          ...data.availableFilters,
        });
      } else if (Array.isArray(data.availableClubs)) {
        setAvailableFilters((prev) => ({
          ...emptyActivityReportFilterOptions(),
          ...prev,
          clubName: data.availableClubs,
        }));
      }
      detailCacheRef.current.set(cacheKey, { records, pagination: pageMeta });
      setDetailRecords(records);
      setPagination(pageMeta);
      setCurrentPage(pageMeta.currentPage || page);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load activity details');
    } finally {
      if (inFlightKeyRef.current === cacheKey) {
        inFlightKeyRef.current = '';
      }
      setDetailLoading(false);
    }
  }, [
    user?.id,
    apiBaseUrl,
    dateRange,
    customStartDate,
    customEndDate,
    buildReportParams,
    detailCacheKey,
    debouncedSearch,
    sortColumn,
    sortDirection,
    tableFilters,
    attendanceStatus,
    itemsPerPage,
  ]);

  /** Phase 1 + 2 in parallel: summary pills (no records) + first table page (one activity). */
  const loadReport = useCallback(async (detailActivity = 'education', { signal } = {}) => {
    if (!user?.id || !apiBaseUrl) return;
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return;

    setSummaryLoading(true);
    setDetailLoading(true);
    setError('');
    detailCacheRef.current.clear();
    inFlightKeyRef.current = '';
    skipSearchSortFetchRef.current = true;

    const activity = detailActivity || 'education';
    const pageParams = paginationQuery(1);

    try {
      // Summary bootstrap skips record enrichment; detail hits only one activity table.
      // Table can paint as soon as detail returns — often before pills finish.
      const bootstrapPromise = (async () => {
        const response = await fetch(
          `${apiBaseUrl}/api/activity/report?${buildReportParams('bootstrap', {
            detailActivity: activity,
            includeRecords: '0',
          })}`,
          { cache: 'no-store', signal },
        );
        const data = await response.json();

        if (response.status === 400 && isBootstrapUnsupportedResponse(data)) {
          return { kind: 'legacy' };
        }
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load activity report');
        }
        return { kind: 'ok', data };
      })();

      const detailPromise = fetchDetails(activity, {
        signal,
        page: 1,
        search: pageParams.search,
        sort: pageParams.sort,
        sortDir: pageParams.sortDir,
      });

      const bootstrapResult = await bootstrapPromise;

      if (bootstrapResult.kind === 'legacy') {
        await fetchLegacyReportBundle(activity);
        setSummaryLoading(false);
        setDetailLoading(false);
        return;
      }

      setSummary(bootstrapResult.data.summary || null);
      applyReportMeta(bootstrapResult.data);
      setMemberSummaries(bootstrapResult.data.members || []);
      setMemberStats(bootstrapResult.data.stats || null);
      setSummaryLoading(false);

      await detailPromise;
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load activity report');
      setSummaryLoading(false);
      setDetailLoading(false);
    }
  }, [
    user?.id,
    apiBaseUrl,
    dateRange,
    customStartDate,
    customEndDate,
    buildReportParams,
    fetchLegacyReportBundle,
    applyReportMeta,
    paginationQuery,
    fetchDetails,
  ]);

  loadReportRef.current = loadReport;
  fetchDetailsRef.current = fetchDetails;

  // Fetch only when this page is open (component mounted) and role is resolved.
  // Refs keep loadReport/selectedActivity out of deps so callback identity churn
  // (and React Strict Mode) cannot fire duplicate bootstraps.
  useEffect(() => {
    if (!roleReady || !user?.id || !apiBaseUrl) return undefined;
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return undefined;

    const controller = new AbortController();
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = controller;
    const generation = fetchGenerationRef.current + 1;
    fetchGenerationRef.current = generation;

    const timer = setTimeout(() => {
      const run = loadReportRef.current;
      if (typeof run !== 'function') return;
      run(selectedActivityRef.current || 'education', { signal: controller.signal }).finally(() => {
        if (fetchGenerationRef.current !== generation) return;
      });
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
      }
    };
  }, [
    roleReady,
    tabVisitKey,
    teamScope,
    dateRange,
    customStartDate,
    customEndDate,
    effectiveRole,
    user?.id,
    apiBaseUrl,
  ]);

  // Refetch current tab when debounced search / sort changes (not on every keystroke).
  // Skip the first run after bootstrap/filter reload — those already return page 1.
  useEffect(() => {
    if (!roleReady || !user?.id || !apiBaseUrl || !summary) return undefined;
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return undefined;
    if (skipSearchSortFetchRef.current) {
      skipSearchSortFetchRef.current = false;
      return undefined;
    }

    const controller = new AbortController();
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = controller;

    const timer = setTimeout(() => {
      const run = fetchDetailsRef.current;
      if (typeof run !== 'function') return;
      run(selectedActivityRef.current || 'education', {
        signal: controller.signal,
        page: 1,
        search: debouncedSearch,
        sort: sortColumn,
        sortDir: sortDirection,
        filters: tableFilters,
      });
    }, 80);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  // intentionally omit selectedActivity — tab switches use handleActivityClick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortColumn, sortDirection, tableFiltersKey, roleReady, user?.id, apiBaseUrl, summary]);

  const handleRefresh = () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setCurrentPage(1);
    loadReport(selectedActivity, { signal: controller.signal });
  };

  const handleActivityClick = (activityId) => {
    const clearedFilters = emptyActivityReportTableFilterValues();
    if (activityId === selectedActivity && !detailLoading) {
      const cacheKey = detailCacheKey(
        activityId, currentPage, debouncedSearch, sortColumn, sortDirection, tableFilters, attendanceStatus,
      );
      if (detailCacheRef.current.has(cacheKey)) return;
    }
    setSelectedActivity(activityId);
    setTableFilters(clearedFilters);
    setAvailableFilters(emptyActivityReportFilterOptions());
    setCurrentPage(1);
    skipSearchSortFetchRef.current = true;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    fetchDetails(activityId, {
      signal: controller.signal,
      page: 1,
      search: debouncedSearch,
      sort: sortColumn,
      sortDir: sortDirection,
      filters: clearedFilters,
    });
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1) return;
    if (pagination.totalPages > 0 && nextPage > pagination.totalPages) return;
    if (nextPage === currentPage) return;

    setCurrentPage(nextPage);
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    fetchDetails(selectedActivity, {
      signal: controller.signal,
      page: nextPage,
      search: debouncedSearch,
      sort: sortColumn,
      sortDir: sortDirection,
      filters: tableFilters,
    });
  };

  const resetTableColumnFilter = () => {
    setTableFilters(emptyActivityReportTableFilterValues());
    setAvailableFilters(emptyActivityReportFilterOptions());
  };

  const handleRemoveTableFilterValue = (columnId, value) => {
    setTableFilters((prev) => removeActivityReportFilterValue(prev, columnId, value));
    setCurrentPage(1);
  };

  const handleApplyTableFilters = (nextFilters) => {
    setTableFilters(normalizeActivityReportTableFilters(nextFilters));
    setCurrentPage(1);
  };

  const handleClearTableFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setTableFilters(emptyActivityReportTableFilterValues());
    setCurrentPage(1);
  };

  const handleTeamScopeChange = (scope) => {
    setTeamScope(scope);
    setSearchQuery('');
    setDebouncedSearch('');
    resetTableColumnFilter();
    setCurrentPage(1);
    setDetailRecords([]);
    setPagination(emptyPagination());
    setMemberSummaries([]);
    setMemberStats(null);
    setError('');
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    resetTableColumnFilter();
    setCurrentPage(1);
    setDetailRecords([]);
    setPagination(emptyPagination());
    setMemberSummaries([]);
    setMemberStats(null);
    setError('');
    if (range !== 'custom') {
      setShowReportDatePicker(false);
    } else {
      // Always reopen the calendar — native <select> will not fire onChange when
      // "Custom" is already selected, so callers also open via the edit control.
      if (!customStartDate || !customEndDate) {
        setSummary(null);
      }
      setShowReportDatePicker(true);
    }
  };

  const handleAttendanceChange = (event) => {
    const next = event.target.value || ACTIVITY_REPORT_ATTENDANCE.ATTENDED;
    if (next === attendanceStatus) return;
    setAttendanceStatus(next);
    setCurrentPage(1);
    setDetailRecords([]);
    setPagination(emptyPagination());
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    fetchDetails(selectedActivity, {
      signal: controller.signal,
      page: 1,
      search: debouncedSearch,
      sort: sortColumn,
      sortDir: sortDirection,
      filters: tableFilters,
      attendance: next,
    });
  };

  const handleCustomDateSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setShowReportDatePicker(false);
    resetTableColumnFilter();
    setCurrentPage(1);
    setDetailRecords([]);
    setPagination(emptyPagination());
    setMemberSummaries([]);
    setMemberStats(null);
  };

  // Filter member summaries by search query (legacy fallback only)
  const filteredMemberSummaries = useMemo(() => {
    if (!memberSearchQuery) return memberSummaries;
    const q = memberSearchQuery.toLowerCase();
    return memberSummaries.filter(m =>
      (m.memberName || '').toLowerCase().includes(q) ||
      (m.sponsorName || m.coachName || '').toLowerCase().includes(q)
      || (m.idealCoachName || '').toLowerCase().includes(q)
    );
  }, [memberSummaries, memberSearchQuery]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const buildCsvFromRecords = (records) => {
    const selectedActivityMeta = ACTIVITY_TYPES.find(a => a.id === selectedActivity);
    const activityLabel = selectedActivityMeta?.label || 'Activity';

    let headers = [
      'Member Name',
      'Member Type',
      'Sponsor Name',
      'Level',
      'Club',
      'Reg. Date',
      'Reg. Time',
      'Coach Name',
      'Phone Number',
      'City',
      'Village'
    ];

    if (selectedActivity === 'weight') {
      headers.splice(4, 0, 'Weight (kg)');
    } else if (['breakfast', 'lunch', 'dinner'].includes(selectedActivity)) {
      headers.splice(4, 0, 'Meal Type', 'Calories');
    } else if (selectedActivity === 'water') {
      headers.splice(4, 0, 'Water (L)');
    } else if (selectedActivity === 'calories') {
      headers.splice(4, 0, 'Calories Burned');
    }

    const csvRows = [headers.join(',')];

    records.forEach((record) => {
      const displayClub = record.clubName && record.clubName !== 'N/A' ? record.clubName : 'Remote';
      const baseRow = [
        `"${record.memberName || 'N/A'}"`,
        `"${formatActivityReportMemberType(record.memberType)}"`,
        `"${record.sponsorName || record.coachName || 'N/A'}"`,
        formatActivityReportLevel(record.level),
        `"${displayClub}"`,
        record.date || 'N/A',
        record.time || 'N/A',
        `"${record.idealCoachName || ''}"`,
        `"${record.phone || 'N/A'}"`,
        `"${record.city || 'N/A'}"`,
        `"${record.village || 'N/A'}"`,
      ];

      if (selectedActivity === 'weight') {
        baseRow.splice(4, 0, record.weight || 'N/A');
      } else if (['breakfast', 'lunch', 'dinner'].includes(selectedActivity)) {
        baseRow.splice(4, 0, `"${record.mealType || 'N/A'}"`, record.calories || 0);
      } else if (selectedActivity === 'water') {
        baseRow.splice(4, 0, record.waterLiters || 0);
      } else if (selectedActivity === 'calories') {
        baseRow.splice(4, 0, record.caloriesBurned || 0);
      }

      csvRows.push(baseRow.join(','));
    });

    return {
      csv: csvRows.join('\n'),
      fileName: `activity-report-${activityLabel.toLowerCase().replace(/\s+/g, '-')}-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  };

  const handleDownload = async () => {
    if ((pagination.totalRecords || 0) === 0 && detailRecords.length === 0) {
      alert('No records to export');
      return;
    }

    setExportLoading(true);
    try {
      // Export the complete filtered dataset (not just the current page).
      const response = await fetch(
        `${apiBaseUrl}/api/activity/report?${buildReportParams(selectedActivity, {
          ...paginationQuery(1, { exportAll: true }),
        })}`,
        { cache: 'no-store' },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to export activity report');
      }

      const exportRecords = Array.isArray(data.records) ? data.records : [];
      if (exportRecords.length === 0) {
        alert('No records to export');
        return;
      }

      const { csv, fileName } = buildCsvFromRecords(exportRecords);
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        const canShare = await Share.canShare().catch(() => ({ value: false }));
        if (canShare.value) {
          await Share.share({
            title: 'Activity Report',
            text: 'Save or share your activity report',
            files: [result.uri],
            dialogTitle: 'Save or Share Report',
          });
        } else {
          alert(`File saved to: ${result.uri}`);
        }
      } else {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export report. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleShare = async () => {
    if ((pagination.totalRecords || 0) === 0 && detailRecords.length === 0) {
      alert('No records to share');
      return;
    }

    setShareLoading(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/activity/report?${buildReportParams(selectedActivity, {
          ...paginationQuery(1, { exportAll: true }),
        })}`,
        { cache: 'no-store' },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load activity report for sharing');
      }

      const exportRecords = Array.isArray(data.records) ? data.records : [];
      if (exportRecords.length === 0) {
        alert('No records to share');
        return;
      }

      const activityMeta = ACTIVITY_TYPES.find((a) => a.id === selectedActivity);
      const text = buildActivityReportShareText({
        activityLabel: activityMeta?.label || 'Activity',
        dateLabel: activeDateLabel,
        scopeLabel: activeScopeLabel,
        clubFilter: (tableFilters.clubName || []).join(', '),
        columnFilter: activeActivityReportTableFilters(tableFilters)
          .map((chip) => `${chip.label}: ${chip.displayValue}`)
          .join(' · '),
        searchQuery,
        attendanceLabel: formatActivityReportAttendance(attendanceStatus),
        totalRecords: data.pagination?.totalRecords ?? exportRecords.length,
        records: exportRecords,
        activityId: selectedActivity,
      });

      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        const canShare = await Share.canShare().catch(() => ({ value: false }));
        if (canShare.value) {
          await Share.share({
            title: 'Activity Report',
            text,
            dialogTitle: 'Share Activity Report',
          });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          alert('Report copied to clipboard');
        } else {
          alert('Sharing is not available on this device');
        }
      } else if (navigator.share) {
        try {
          await navigator.share({ title: 'Activity Report', text });
        } catch (shareErr) {
          const cancelled = (shareErr?.name === 'AbortError')
            || (shareErr?.message || '').toLowerCase().includes('cancel');
          if (!cancelled) throw shareErr;
        }
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        alert('Report copied to clipboard');
      } else {
        alert('Sharing is not supported in this browser');
      }
    } catch (err) {
      console.error('Share failed:', err);
      alert('Failed to share report. Please try again.');
    } finally {
      setShareLoading(false);
    }
  };

  const totalPages = pagination.totalPages || 0;
  const totalRecords = pagination.totalRecords || 0;
  const pageSize = pagination.pageSize || itemsPerPage;
  const showingFrom = totalRecords === 0 ? 0 : ((pagination.currentPage || currentPage) - 1) * pageSize + 1;
  const showingTo = Math.min((pagination.currentPage || currentPage) * pageSize, totalRecords);
  const activeFilterChips = activeActivityReportTableFilters(tableFilters);
  const hasActiveTableFilters = Boolean(searchQuery.trim() || activeFilterChips.length > 0);

  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Activity Report</h1>
            </div>
            <TouchFeedbackButton
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={summaryLoading || detailLoading}
            >
              <RefreshCw className={`w-5 h-5 ${(summaryLoading || detailLoading) ? 'animate-spin' : ''}`} />
            </TouchFeedbackButton>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-3">
        <ActivityReportFiltersBar
          dateRange={dateRange}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          showDatePicker={showReportDatePicker}
          onDateRangeChange={handleDateRangeChange}
          onOpenCustomPicker={() => setShowReportDatePicker(true)}
          onCustomDateSelect={handleCustomDateSelect}
          onCloseDatePicker={() => setShowReportDatePicker(false)}
          showTeamScope={showTeamScope}
          teamScope={teamScope}
          teamScopeCounts={teamScopeCounts}
          onTeamScopeChange={handleTeamScopeChange}
          selectedActivity={selectedActivity}
          activityTypes={ACTIVITY_TYPES}
          summary={summary}
          onActivityChange={handleActivityClick}
          attendanceStatus={attendanceStatus}
          onAttendanceChange={handleAttendanceChange}
          summaryLoading={summaryLoading}
          detailLoading={detailLoading}
        />

        {error && (
          <div className="mb-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {selectedActivity && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-3 py-2 sm:px-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-gray-900">
                  {ACTIVITY_TYPES.find(a => a.id === selectedActivity)?.label}
                  {' · '}
                  {formatActivityReportAttendance(attendanceStatus)}
                </h2>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(totalRecords > 0 || detailRecords.length > 0) && (
                    <>
                      <TouchFeedbackButton
                        onClick={handleShare}
                        disabled={shareLoading || exportLoading || detailLoading}
                        ariaLabel={shareLoading ? 'Sharing report' : 'Share report'}
                        className="flex items-center justify-center p-1.5 bg-white border border-green-600 text-green-700 rounded-md hover:bg-green-50 disabled:opacity-50"
                      >
                        <Share2 className={`w-3.5 h-3.5 ${shareLoading ? 'animate-pulse' : ''}`} />
                      </TouchFeedbackButton>
                      <TouchFeedbackButton
                        onClick={handleDownload}
                        disabled={exportLoading || shareLoading || detailLoading}
                        ariaLabel={exportLoading ? 'Exporting report' : 'Export report'}
                        className="flex items-center justify-center p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        <Download className={`w-3.5 h-3.5 ${exportLoading ? 'animate-pulse' : ''}`} />
                      </TouchFeedbackButton>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search name or phone"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <TouchFeedbackButton
                    onClick={() => setShowTableFiltersSheet(true)}
                    disabled={detailLoading}
                    ariaLabel={
                      activeFilterChips.length > 0
                        ? `Open filters, ${activeFilterChips.length} active`
                        : 'Open filters'
                    }
                    className={`relative inline-flex items-center gap-1.5 h-[2.125rem] px-3 rounded-lg border text-xs font-semibold flex-shrink-0 ${
                      activeFilterChips.length > 0
                        ? 'border-green-600 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filters
                    {activeFilterChips.length > 0 && (
                      <span className="min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-green-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
                        {activeFilterChips.length}
                      </span>
                    )}
                  </TouchFeedbackButton>
                </div>

                {activeFilterChips.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {activeFilterChips.map((chip) => (
                      <TouchFeedbackButton
                        key={chip.id}
                        onClick={() => handleRemoveTableFilterValue(chip.columnId, chip.value)}
                        className="inline-flex items-center gap-0.5 max-w-full pl-2 pr-1 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-semibold flex-shrink-0"
                        ariaLabel={`Remove ${chip.label} ${chip.displayValue} filter`}
                      >
                        <span className="truncate">
                          {chip.label}: {chip.displayValue}
                        </span>
                        <X className="w-3 h-3 flex-shrink-0" />
                      </TouchFeedbackButton>
                    ))}
                    <TouchFeedbackButton
                      onClick={handleClearTableFilters}
                      className="inline-flex items-center text-[10px] font-semibold text-gray-500 hover:text-gray-800 flex-shrink-0 px-1"
                      ariaLabel="Clear table filters"
                    >
                      Clear all
                    </TouchFeedbackButton>
                  </div>
                )}
              </div>
            </div>

            <ActivityReportTableFiltersSheet
              isOpen={showTableFiltersSheet}
              onClose={() => setShowTableFiltersSheet(false)}
              appliedFilters={tableFilters}
              availableFilters={availableFilters}
              onApply={handleApplyTableFilters}
              disabled={detailLoading}
            />

            <div className="overflow-x-auto relative">
              {detailLoading && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/70">
                  <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
                </div>
              )}
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th
                      className="sticky left-0 z-30 bg-gray-50 px-3 py-2 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase min-w-[130px] cursor-pointer hover:bg-gray-100 shadow-[2px_0_5px_-1px_rgba(0,0,0,0.08)]"
                      onClick={() => handleSort('memberName')}
                    >
                      Member Name {sortColumn === 'memberName' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('memberType')}
                    >
                      Member Type {sortColumn === 'memberType' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('sponsorName')}
                    >
                      Sponsor {sortColumn === 'sponsorName' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('level')}
                    >
                      Level {sortColumn === 'level' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>

                    {/* --- DYNAMIC ACTIVITY COLUMNS --- */}
                    {selectedActivity === 'weight' && (
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Weight (kg)</th>
                    )}
                    {/* Education columns (Topic/Type) removed */}
                    {['breakfast', 'lunch', 'dinner'].includes(selectedActivity) && (
                      <>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Meal</th>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Calories</th>
                      </>
                    )}
                    {selectedActivity === 'water' && (
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Water (L)</th>
                    )}
                    {selectedActivity === 'calories' && (
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Calories Burned</th>
                    )}

                    {/* --- COMMON COLUMNS REORDERED --- */}
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Club</th>
                    <th
                      className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('date')}
                    >
                      Reg. Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Reg. Time</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Coach</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">City</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Village</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {detailRecords.map((record, index) => (
                    <tr key={`${record.userId}-${record.date}-${record.time}-${index}`} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm font-medium text-gray-900 min-w-[130px] shadow-[2px_0_5px_-1px_rgba(0,0,0,0.08)]">
                        {display(record.memberName)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatActivityReportMemberType(record.memberType)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.sponsorName || record.coachName)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatActivityReportLevel(record.level)}</td>

                      {/* --- DYNAMIC ACTIVITY DATA --- */}
                      {selectedActivity === 'weight' && (
                        <td className="px-4 py-3 text-sm font-semibold text-blue-600">{record.weight}</td>
                      )}
                      {/* Education data (Topic/Type) removed */}
                      {['breakfast', 'lunch', 'dinner'].includes(selectedActivity) && (
                        <>
                          <td className="px-4 py-3 text-sm capitalize text-gray-600">{record.mealType}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-orange-600">{record.calories}</td>
                        </>
                      )}
                      {selectedActivity === 'water' && (
                        <td className="px-4 py-3 text-sm font-semibold text-cyan-600">{record.waterLiters}</td>
                      )}
                      {selectedActivity === 'calories' && (
                        <td className="px-4 py-3 text-sm font-semibold text-red-600">{record.caloriesBurned}</td>
                      )}

                      {/* --- COMMON DATA REORDERED --- */}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {record.clubName && record.clubName !== 'N/A'
                          ? <span className="text-green-700 font-medium">{record.clubName}</span>
                          : <span className="text-gray-400 italic">Remote</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{display(record.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{display(record.time)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.idealCoachName ? display(record.idealCoachName) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <PhoneContactActions phone={record.phone} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.city)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.village)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {showingFrom} to {showingTo} of {totalRecords} records
                </p>
                <div className="flex items-center gap-2">
                  <TouchFeedbackButton
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!pagination.hasPreviousPage || detailLoading || currentPage <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </TouchFeedbackButton>
                  <span className="text-sm text-gray-600">
                    Page {pagination.currentPage || currentPage} of {totalPages}
                  </span>
                  <TouchFeedbackButton
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!pagination.hasNextPage || detailLoading || currentPage >= totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </TouchFeedbackButton>
                </div>
              </div>
            )}

            {detailRecords.length === 0 && !detailLoading && (
              <div className="p-12 text-center">
                <p className="text-gray-500">
                  {hasActiveTableFilters
                    ? 'No records found'
                    : attendanceStatus === ACTIVITY_REPORT_ATTENDANCE.NOT_ATTENDED
                      ? 'Everyone in this team logged this activity'
                      : 'No records found'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial load — summary / team scope */}
        {summaryLoading && !summary && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityReport;
