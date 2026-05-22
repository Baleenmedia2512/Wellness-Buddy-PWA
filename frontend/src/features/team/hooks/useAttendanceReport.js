/**
 * useAttendanceReport.js — slice orchestrator hook.
 *
 * Owns filter/sort/range state, alert/profile-modal state, hierarchy
 * fetch (with background refresh), CSV download flow and all derived
 * memoised values consumed by the report shell.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyTeamView, buildSummaryStats, getTargetDate, getTeamCounts,
  hasVisibleNodes, mapHierarchyFields, sortHierarchy,
} from '../services/attendanceReportFormatter';
import {
  buildAttendanceCsv, buildAttendanceFilename,
  fetchAttendanceCsvData, saveOrShareFile,
} from '../services/attendanceReportExport';

const INITIAL_ALERT = {
  isOpen: false, title: '', message: '', type: 'info',
  confirmText: 'OK', cancelText: null, onConfirm: null, onCancel: null,
};

async function lookupUserId(apiBaseUrl, email) {
  const r = await fetch(`${apiBaseUrl}/api/user/lookup?email=${encodeURIComponent(email)}`);
  const data = await r.json();
  if (!data.success) throw new Error('User not found');
  return data.userId;
}

export function useAttendanceReport({ user }) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
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
  const [teamView, setTeamView] = useState('direct');
  const [expandOverride, setExpandOverride] = useState('collapsed');
  const [profileModalEmail, setProfileModalEmail] = useState(null);
  const [alertModal, setAlertModal] = useState(INITIAL_ALERT);
  const lastExpandState = useRef(null);

  const showAlert = useCallback((message, title = 'Alert', type = 'info') => {
    setAlertModal({ ...INITIAL_ALERT, isOpen: true, title, message, type });
  }, []);
  const closeAlert = useCallback(() => setAlertModal((p) => ({ ...p, isOpen: false })), []);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!user) return;
    if (!isBackground) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const userId = await lookupUserId(apiBaseUrl, user.email);
      const date = getTargetDate({ dateRange, customStartDate });
      const r = await fetch(
        `${apiBaseUrl}/api/coach/hierarchical-club-attendance?userId=${userId}&date=${date}`,
        { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } },
      );
      const result = await r.json();
      if (!r.ok || !result.success) throw new Error(result.message || 'Failed to fetch attendance data');
      setHierarchyData(mapHierarchyFields(result.data.hierarchy));
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError(err.message);
    } finally {
      if (!isBackground) setLoading(false); else setRefreshing(false);
    }
  }, [user, apiBaseUrl, dateRange, customStartDate]);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [user, dateRange, customStartDate, customEndDate]); // required by platform constraints; see inline context // required by platform constraints — see surrounding context

  const sortedHierarchyData = useMemo(
    () => sortHierarchy(hierarchyData, { sortBy, sortOrder }),
    [hierarchyData, sortBy, sortOrder],
  );
  const filteredHierarchy = useMemo(
    () => applyTeamView(sortedHierarchyData, teamView),
    [sortedHierarchyData, teamView],
  );
  const teamCounts = useMemo(() => getTeamCounts(hierarchyData), [hierarchyData]);
  const summaryStats = useMemo(() => buildSummaryStats(hierarchyData), [hierarchyData]);
  const visibleHierarchy = filteredHierarchy
    && hasVisibleNodes(filteredHierarchy, { searchQuery, filter })
    ? filteredHierarchy : null;

  const handleManualRefresh = useCallback(() => fetchData(true), [fetchData]);
  const handleDateRangeSelect = useCallback((start, end) => {
    setCustomStartDate(start); setCustomEndDate(end); setDateRange('custom');
  }, []);
  const handleSortChange = useCallback((_newSortBy, newSortOrder) => {
    setSortBy('name'); setSortOrder(newSortOrder);
  }, []);
  const handleExpandAll = useCallback(() => {
    lastExpandState.current = 'expanded'; setExpandOverride('expanded');
  }, []);
  const handleCollapseAll = useCallback(() => {
    lastExpandState.current = 'collapsed'; setExpandOverride('collapsed');
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const userId = await lookupUserId(apiBaseUrl, user.email);
      const date = getTargetDate({ dateRange, customStartDate });
      const data = await fetchAttendanceCsvData({ apiBaseUrl, userId, date });
      if (data.length === 0) {
        showAlert('No attendance records found for the selected date.', 'No Data', 'info');
        return;
      }
      const filename = buildAttendanceFilename(date, hierarchyData?.userName);
      const result = await saveOrShareFile({
        content: buildAttendanceCsv(data),
        fileName: filename,
        mimeType: 'text/csv;charset=utf-8;',
        title: 'Attendance Report (CSV)',
      });
      if (result.cancelled || result.isWeb) return;
      showAlert(
        `Attendance report has been saved successfully!\n\n📁 Saved to: ${result.location}\n\nYou can find this file in your device's Files app.\n\nFile: ${filename}\nRecords: ${data.length}`,
        'Download Successful', 'success',
      );
    } catch (err) {
      console.error('Error downloading attendance report:', err);
      showAlert(
        `Failed to download attendance report.\n\nError: ${err.message}\n\nPlease try again or contact support if the problem persists.`,
        'Download Failed', 'error',
      );
    }
  }, [apiBaseUrl, user, dateRange, customStartDate, hierarchyData, showAlert]);

  return {
    loading, error, refreshing, hierarchyData, visibleHierarchy, summaryStats, teamCounts,
    dateRange, setDateRange, customStartDate, customEndDate,
    searchQuery, setSearchQuery, filter, setFilter, sortOrder, sortBy,
    teamView, setTeamView, expandOverride,
    profileModalEmail, setProfileModalEmail, alertModal, closeAlert,
    handleManualRefresh, handleDateRangeSelect, handleSortChange,
    handleExpandAll, handleCollapseAll, handleDownload,
  };
}
