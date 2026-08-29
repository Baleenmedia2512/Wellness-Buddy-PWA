import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw, Download, Search,
  Scale, BookOpen, Coffee, Utensils, Moon, Droplets, Flame,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import ReportDateRangeFilter from '../../../shared/components/common/ReportDateRangeFilter';
import { ACTIVITY_REPORT_DATE_RANGES, formatCustomRangeLabel } from '../../../shared/domain/reportDateRanges';
import { fetchHasTeamMembers } from '../../team/services/teamSearchService';
import { TEAM_SCOPES, TEAM_SCOPE_OPTIONS } from '../../reports/utils/reportFilters';

const DEFAULT_PAGE_SIZE = 10;
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
  { id: 'weight', label: 'Weight', icon: Scale, color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700' },
  { id: 'education', label: 'Education', icon: BookOpen, color: 'indigo', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', textColor: 'text-indigo-700' },
  { id: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'orange', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', textColor: 'text-orange-700' },
  { id: 'lunch', label: 'Lunch', icon: Utensils, color: 'green', bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700' },
  { id: 'dinner', label: 'Dinner', icon: Moon, color: 'purple', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700' },
  { id: 'water', label: 'Water', icon: Droplets, color: 'cyan', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', textColor: 'text-cyan-700' },
  { id: 'calories', label: 'Exercise', icon: Flame, color: 'red', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700' },
];

// Activity Badge Component
const ActivityBadge = ({ activity, count, onClick, isSelected }) => {
  const Icon = activity.icon;
  
  return (
    <TouchFeedbackButton
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 transition-all ${
        isSelected
          ? `${activity.bgColor} ${activity.borderColor} shadow-md scale-105`
          : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-full ${activity.bgColor}`}>
          <Icon className={`w-6 h-6 ${activity.textColor}`} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-600">{activity.label}</p>
          <p className={`text-2xl font-bold ${activity.textColor}`}>{count}</p>
        </div>
      </div>
    </TouchFeedbackButton>
  );
};

/** Returns '—' for null, undefined, empty string, or the literal string "N/A" */
const display = (val) => (!val || val === 'N/A') ? '—' : val;

// Main Component
const ActivityReport = ({ user, userRole, apiBaseUrl, onBack, tabVisitKey = 0 }) => {
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState('education');
  const [detailRecords, setDetailRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  const detailCacheKey = useCallback((activityType, page, search, sort, sortDir) => (
    [
      teamScope,
      dateRange,
      customStartDate ? formatDateForApi(customStartDate) : '',
      customEndDate ? formatDateForApi(customEndDate) : '',
      activityType || '',
      String(page || 1),
      String(itemsPerPage),
      search || '',
      sort || 'date',
      sortDir || 'desc',
    ].join('|')
  ), [teamScope, dateRange, customStartDate, customEndDate, itemsPerPage]);

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
  }, [user?.id, userRole]);

  const buildReportParams = useCallback((activityType, extra = {}) => {
    const params = new URLSearchParams({
      userId: String(user.id),
      activityType,
      dateRange,
      role: effectiveRole,
      teamScope,
    });
    Object.entries(extra).forEach(([key, value]) => {
      if (value != null && value !== '') params.set(key, String(value));
    });
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      params.set('startDate', formatDateForApi(customStartDate));
      params.set('endDate', formatDateForApi(customEndDate));
    }
    return params;
  }, [user?.id, effectiveRole, dateRange, customStartDate, customEndDate, teamScope]);

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

  const paginationQuery = useCallback((page = currentPage, overrides = {}) => ({
    page: overrides.page ?? page,
    limit: overrides.limit ?? itemsPerPage,
    search: overrides.search ?? debouncedSearch,
    sort: overrides.sort ?? sortColumn,
    sortDir: overrides.sortDir ?? sortDirection,
    ...(overrides.exportAll ? { exportAll: '1' } : {}),
  }), [currentPage, itemsPerPage, debouncedSearch, sortColumn, sortDirection]);

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
      detailCacheKey(detailActivity, 1, pageParams.search, pageParams.sort, pageParams.sortDir),
      { records, pagination: detailData.pagination || emptyPagination(1) },
    );
  }, [apiBaseUrl, buildReportParams, applyReportMeta, applyPaginationMeta, paginationQuery, detailCacheKey]);

  const fetchDetails = useCallback(async (activityType, {
    signal,
    page = 1,
    search = debouncedSearch,
    sort = sortColumn,
    sortDir = sortDirection,
  } = {}) => {
    if (!user?.id || !apiBaseUrl || !activityType) return;
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return;

    const cacheKey = detailCacheKey(activityType, page, search, sort, sortDir);
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
        })}`,
        { cache: 'no-store', signal },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch activity details');
      }

      const records = data.records || [];
      const pageMeta = data.pagination || emptyPagination(page);
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
      });
    }, 80);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  // intentionally omit selectedActivity — tab switches use handleActivityClick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortColumn, sortDirection, roleReady, user?.id, apiBaseUrl, summary]);

  const handleRefresh = () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setCurrentPage(1);
    loadReport(selectedActivity, { signal: controller.signal });
  };

  const handleActivityClick = (activityId) => {
    if (activityId === selectedActivity && !detailLoading) {
      // Already showing this tab — avoid a duplicate detail GET.
      const cacheKey = detailCacheKey(
        activityId, currentPage, debouncedSearch, sortColumn, sortDirection,
      );
      if (detailCacheRef.current.has(cacheKey)) return;
    }
    setSelectedActivity(activityId);
    setCurrentPage(1);
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    fetchDetails(activityId, {
      signal: controller.signal,
      page: 1,
      search: debouncedSearch,
      sort: sortColumn,
      sortDir: sortDirection,
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
    });
  };

  const handleTeamScopeChange = (scope) => {
    setTeamScope(scope);
    setSearchQuery('');
    setDebouncedSearch('');
    setCurrentPage(1);
    setDetailRecords([]);
    setPagination(emptyPagination());
    setMemberSummaries([]);
    setMemberStats(null);
    setError('');
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setCurrentPage(1);
    setDetailRecords([]);
    setPagination(emptyPagination());
    setMemberSummaries([]);
    setMemberStats(null);
    setError('');
    if (range !== 'custom') {
      if (!customStartDate || !customEndDate) {
        /* presets fetch immediately */
      }
    } else if (!customStartDate || !customEndDate) {
      setSummary(null);
    }
  };

  const handleCustomDateSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
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
      'Club',
      'Reg. Date',
      'Reg. Time',
      'Sponsor Name',
      'Coach Name',
      'Phone Number',
      'City',
      'Village'
    ];

    if (selectedActivity === 'weight') {
      headers.splice(1, 0, 'Weight (kg)');
    } else if (['breakfast', 'lunch', 'dinner'].includes(selectedActivity)) {
      headers.splice(1, 0, 'Meal Type', 'Calories');
    } else if (selectedActivity === 'water') {
      headers.splice(1, 0, 'Water (L)');
    } else if (selectedActivity === 'calories') {
      headers.splice(1, 0, 'Calories Burned');
    }

    const csvRows = [headers.join(',')];

    records.forEach((record) => {
      const displayClub = record.clubName && record.clubName !== 'N/A' ? record.clubName : 'Remote';
      const baseRow = [
        `"${record.memberName || 'N/A'}"`,
        `"${displayClub}"`,
        record.date || 'N/A',
        record.time || 'N/A',
        `"${record.sponsorName || record.coachName || 'N/A'}"`,
        `"${record.idealCoachName || ''}"`,
        `"${record.phone || 'N/A'}"`,
        `"${record.city || 'N/A'}"`,
        `"${record.village || 'N/A'}"`,
      ];

      if (selectedActivity === 'weight') {
        baseRow.splice(1, 0, record.weight || 'N/A');
      } else if (['breakfast', 'lunch', 'dinner'].includes(selectedActivity)) {
        baseRow.splice(1, 0, `"${record.mealType || 'N/A'}"`, record.calories || 0);
      } else if (selectedActivity === 'water') {
        baseRow.splice(1, 0, record.waterLiters || 0);
      } else if (selectedActivity === 'calories') {
        baseRow.splice(1, 0, record.caloriesBurned || 0);
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

  const totalPages = pagination.totalPages || 0;
  const totalRecords = pagination.totalRecords || 0;
  const pageSize = pagination.pageSize || itemsPerPage;
  const showingFrom = totalRecords === 0 ? 0 : ((pagination.currentPage || currentPage) - 1) * pageSize + 1;
  const showingTo = Math.min((pagination.currentPage || currentPage) * pageSize, totalRecords);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 pb-20">
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Date Range Filter */}
        <div className="mb-4">
          <ReportDateRangeFilter
            ranges={ACTIVITY_REPORT_DATE_RANGES}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomDateSelect={handleCustomDateSelect}
            variant="compact"
          />
        </div>

        {/* Team scope: Mine / Direct / Full */}
        {showTeamScope && (
          <div
            className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm px-1 py-1 flex gap-1 w-full"
            role="group"
            aria-label="Team scope filter"
          >
            {TEAM_SCOPE_OPTIONS.map(({ value, label, short }) => {
              const isActive = teamScope === value;
              const count = teamScopeCounts?.[value] ?? 0;
              const showCount = value !== TEAM_SCOPES.MINE;
              const desktopLabel = showCount ? `${label} (${count})` : label;
              const mobileLabel = showCount ? `${short} (${count})` : short;
              return (
                <TouchFeedbackButton
                  key={value}
                  onClick={() => handleTeamScopeChange(value)}
                  disabled={summaryLoading || detailLoading}
                  className={`flex-1 min-w-0 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all px-1 sm:px-2 disabled:opacity-50 ${
                    isActive
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-green-800 hover:bg-green-50'
                  }`}
                  title={desktopLabel}
                >
                  <span className="hidden sm:inline truncate">{desktopLabel}</span>
                  <span className="sm:hidden truncate">{mobileLabel}</span>
                </TouchFeedbackButton>
              );
            })}
          </div>
        )}

        {(showTeamScope || summary) && (
          <p className="mb-3 text-[11px] sm:text-xs text-gray-500">
            Activity counts for{' '}
            <span className="font-semibold text-gray-700">{activeScopeLabel || 'your team'}</span>
            {' · '}
            <span className="font-semibold text-gray-700">{activeDateLabel}</span>
          </p>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Activity Type Tabs */}
        {summary && (
          <div className="flex flex-wrap gap-2 pb-2 mb-5">
            {ACTIVITY_TYPES.map((activity) => {
              const Icon = activity.icon;
              const isActive = selectedActivity === activity.id;
              return (
                <TouchFeedbackButton
                  key={activity.id}
                  onClick={() => handleActivityClick(activity.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm active:scale-95 transition-all ${
                    isActive
                      ? `${activity.bgColor} ${activity.borderColor}`
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? activity.textColor : 'text-gray-400'}`} />
                  <span className={`text-sm font-bold ${isActive ? activity.textColor : 'text-gray-500'}`}>
                    {summary[activity.id] || 0}
                  </span>
                  <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                    {activity.label}
                  </span>
                </TouchFeedbackButton>
              );
            })}
          </div>
        )}

        {/* Detail Grid */}
        {selectedActivity && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {ACTIVITY_TYPES.find(a => a.id === selectedActivity)?.label} Records
                </h2>
                <div className="flex items-center gap-2">
                  {(totalRecords > 0 || detailRecords.length > 0) && (
                    <TouchFeedbackButton
                      onClick={handleDownload}
                      disabled={exportLoading || detailLoading}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Download className={`w-4 h-4 ${exportLoading ? 'animate-pulse' : ''}`} />
                      {exportLoading ? 'Exporting…' : 'Export'}
                    </TouchFeedbackButton>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone, coach, city, or village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[65vh] relative">
              {detailLoading && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/70">
                  <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
                </div>
              )}
              <table className="w-full">
                <thead className="border-b border-gray-200 sticky top-0 z-20">
                  <tr>
                    <th
                      className="sticky left-0 z-30 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[130px] cursor-pointer hover:bg-gray-100 shadow-[2px_0_5px_-1px_rgba(0,0,0,0.08)]"
                      onClick={() => handleSort('memberName')}
                    >
                      Member Name {sortColumn === 'memberName' && (sortDirection === 'asc' ? '↑' : '↓')}
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
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sponsor</th>
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
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.sponsorName || record.coachName)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.idealCoachName ? display(record.idealCoachName) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.phone)}</td>
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
                <p className="text-gray-500">No records found</p>
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
