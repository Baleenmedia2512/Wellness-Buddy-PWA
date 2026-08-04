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
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState('education');
  const [detailRecords, setDetailRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

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

  const formatDateForApi = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  const fetchLegacyReportBundle = useCallback(async (detailActivity = 'education') => {
    const summaryRes = await fetch(
      `${apiBaseUrl}/api/activity/report?${buildReportParams('summary')}`,
      { cache: 'no-store' },
    );
    const summaryData = await summaryRes.json();
    if (!summaryRes.ok || !summaryData.success) {
      throw new Error(summaryData.message || 'Failed to fetch activity summary');
    }

    const memberRes = await fetch(
      `${apiBaseUrl}/api/activity/report?${buildReportParams('member-summary')}`,
      { cache: 'no-store' },
    );
    const memberData = await memberRes.json();
    if (!memberRes.ok || !memberData.success) {
      throw new Error(memberData.message || 'Failed to fetch member summaries');
    }

    const detailRes = await fetch(
      `${apiBaseUrl}/api/activity/report?${buildReportParams(detailActivity)}`,
      { cache: 'no-store' },
    );
    const detailData = await detailRes.json();
    if (!detailRes.ok || !detailData.success) {
      throw new Error(detailData.message || 'Failed to fetch activity details');
    }

    setSummary(summaryData.summary || null);
    applyReportMeta(summaryData);
    setMemberSummaries(memberData.members || []);
    setMemberStats(memberData.stats || null);
    setDetailRecords(detailData.records || []);
    setCurrentPage(1);
  }, [apiBaseUrl, buildReportParams, applyReportMeta]);

  const fetchDetails = useCallback(async (activityType, { signal } = {}) => {
    if (!user?.id || !apiBaseUrl || !activityType) return;
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return;

    setDetailLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/activity/report?${buildReportParams(activityType)}`,
        { cache: 'no-store', signal },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch activity details');
      }

      setDetailRecords(data.records || []);
      setCurrentPage(1);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load activity details');
    } finally {
      setDetailLoading(false);
    }
  }, [user?.id, apiBaseUrl, dateRange, customStartDate, customEndDate, buildReportParams]);

  /** Phase 1: team scope + summary pills. Phase 2: detail table (async, non-blocking). */
  const loadReport = useCallback(async (detailActivity = 'education', { signal } = {}) => {
    if (!user?.id || !apiBaseUrl) return;
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return;

    setSummaryLoading(true);
    setDetailLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/activity/report?${buildReportParams('bootstrap', {
          detailActivity: detailActivity || 'education',
          includeRecords: '0',
        })}`,
        { cache: 'no-store', signal },
      );
      const data = await response.json();

      if (response.status === 400 && isBootstrapUnsupportedResponse(data)) {
        await fetchLegacyReportBundle(detailActivity);
        setSummaryLoading(false);
        setDetailLoading(false);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load activity report');
      }

      setSummary(data.summary || null);
      applyReportMeta(data);
      setMemberSummaries(data.members || []);
      setMemberStats(data.stats || null);
      setSummaryLoading(false);

      await fetchDetails(detailActivity, { signal });
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
    fetchDetails,
  ]);

  // Fetch only when this page is open (component mounted) and role is resolved.
  useEffect(() => {
    if (!roleReady || !user?.id || !apiBaseUrl) return;
    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return;

    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const generation = fetchGenerationRef.current + 1;
    fetchGenerationRef.current = generation;

    loadReport(selectedActivity, { signal: controller.signal }).finally(() => {
      if (fetchGenerationRef.current !== generation) return;
    });

    return () => {
      controller.abort();
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
      }
    };
  }, [
    roleReady,
    loadReport,
    tabVisitKey,
    teamScope,
    dateRange,
    customStartDate,
    customEndDate,
    effectiveRole,
    user?.id,
    apiBaseUrl,
  ]);

  const handleRefresh = () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    loadReport(selectedActivity, { signal: controller.signal });
  };

  const handleActivityClick = (activityId) => {
    setSelectedActivity(activityId);
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    fetchDetails(activityId, { signal: controller.signal });
  };

  const handleTeamScopeChange = (scope) => {
    setTeamScope(scope);
    setSearchQuery('');
    setDetailRecords([]);
    setMemberSummaries([]);
    setMemberStats(null);
    setError('');
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setDetailRecords([]);
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
    setDetailRecords([]);
    setMemberSummaries([]);
    setMemberStats(null);
  };

  // Filter member summaries by search query
  const filteredMemberSummaries = useMemo(() => {
    if (!memberSearchQuery) return memberSummaries;
    const q = memberSearchQuery.toLowerCase();
    return memberSummaries.filter(m =>
      (m.memberName || '').toLowerCase().includes(q) ||
      (m.sponsorName || m.coachName || '').toLowerCase().includes(q)
      || (m.idealCoachName || '').toLowerCase().includes(q)
    );
  }, [memberSummaries, memberSearchQuery]);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let filtered = detailRecords;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record =>
        (record.memberName || '').toLowerCase().includes(query) ||
        (record.phone || '').toLowerCase().includes(query) ||
        (record.sponsorName || record.coachName || '').toLowerCase().includes(query) ||
        (record.idealCoachName || '').toLowerCase().includes(query) ||
        (record.city || '').toLowerCase().includes(query) ||
        (record.village || '').toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      if (sortColumn === 'date' || sortColumn === 'time') {
        aVal = aVal || '';
        bVal = bVal || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [detailRecords, searchQuery, sortColumn, sortDirection]);

  // Paginate records
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleDownload = async () => {
    if (filteredRecords.length === 0) {
      alert('No records to export');
      return;
    }

    try {
      const selectedActivityMeta = ACTIVITY_TYPES.find(a => a.id === selectedActivity);
      const activityLabel = selectedActivityMeta?.label || 'Activity';

      // 1. Base headers re-ordered to match your new UI table
      let headers = [
        'Member Name',
        // Dynamic columns will go here (index 1)
        'Club',
        'Reg. Date',
        'Reg. Time',
        'Sponsor Name',
        'Coach Name',
        'Phone Number',
        'City',
        'Village'
      ];
      
      // 2. Insert dynamic headers (Education has NO extra columns)
      if (selectedActivity === 'weight') {
        headers.splice(1, 0, 'Weight (kg)');
      } else if (['breakfast', 'lunch', 'dinner'].includes(selectedActivity)) {
        headers.splice(1, 0, 'Meal Type', 'Calories');
      } else if (selectedActivity === 'water') {
        headers.splice(1, 0, 'Water (L)');
      } else if (selectedActivity === 'calories') {
        headers.splice(1, 0, 'Steps', 'Calories Burned');
      }

      const csvRows = [headers.join(',')];

      filteredRecords.forEach((record) => {
        // Handle "Remote" logic for Club Name
        const displayClub = record.clubName && record.clubName !== 'N/A' ? record.clubName : 'Remote';

        // 3. Base row data matching the new re-ordered headers
        const baseRow = [
          `"${record.memberName || 'N/A'}"`,
          // Dynamic data will go here (index 1)
          `"${displayClub}"`,
          record.date || 'N/A',
          record.time || 'N/A',
          `"${record.sponsorName || record.coachName || 'N/A'}"`,
          `"${record.idealCoachName || ''}"`,
          `"${record.phone || 'N/A'}"`,
          `"${record.city || 'N/A'}"`,
          `"${record.village || 'N/A'}"`,
        ];

        // 4. Insert dynamic data into the row
        if (selectedActivity === 'weight') {
          baseRow.splice(1, 0, record.weight || 'N/A');
        } else if (['breakfast', 'lunch', 'dinner'].includes(selectedActivity)) {
          baseRow.splice(1, 0, `"${record.mealType || 'N/A'}"`, record.calories || 0);
        } else if (selectedActivity === 'water') {
          baseRow.splice(1, 0, record.waterLiters || 0);
        } else if (selectedActivity === 'calories') {
          baseRow.splice(1, 0, record.steps || 0, record.caloriesBurned || 0);
        }

        csvRows.push(baseRow.join(','));
      });

      const csv = csvRows.join('\n');
      const fileName = `activity-report-${activityLabel.toLowerCase().replace(/\s+/g, '-')}-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;

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
        // Web fallback
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
    }
  };

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
                  {filteredRecords.length > 0 && (
                    <TouchFeedbackButton
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
                    >
                      <Download className="w-4 h-4" />
                      Export
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

            <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
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
                      <>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Steps</th>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Calories Burned</th>
                      </>
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
                  {paginatedRecords.map((record, index) => (
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
                        <>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.steps}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-red-600">{record.caloriesBurned}</td>
                        </>
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
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} records
                </p>
                <div className="flex items-center gap-2">
                  <TouchFeedbackButton
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </TouchFeedbackButton>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <TouchFeedbackButton
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </TouchFeedbackButton>
                </div>
              </div>
            )}

            {paginatedRecords.length === 0 && !detailLoading && (
              <div className="p-12 text-center">
                <p className="text-gray-500">No records found</p>
              </div>
            )}

            {detailLoading && (
              <div className="p-12 flex justify-center">
                <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
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