/**
 * Full-page wellness score view for members (no configuration UI).
 *
 * Opens on the same date range selected on the Home carousel (Today / Yesterday /
 * Last 10 Days / Custom). Changing the range in the sheet syncs back to Home on back.
 *
 * Coaches / users with team hierarchy get the same downline search as Reports
 * Nutrition/Trend — default is own score; picking a member loads their sheet.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBusinessToday } from '../../../shared/hooks/useBusinessToday';
import { getUserId } from '../../../shared/services/userIdentity';
import ReportsMemberSearch from '../../reports/components/ReportsMemberSearch';
import {
  reportsMemberPossessiveTitle,
  resolveReportsViewedUser,
} from '../../reports/utils/reportsViewedMember.js';
import { useWellnessScoreHistory } from '../hooks/useWellnessScoreHistory';
import { useTimeWindows } from '../hooks/useTimeWindows';
import { dateFromPickerValue, resolveWellnessDateRange } from '../domain/dateRange';
import { seedDailyWellnessScoreCache } from '../services/dailyWellnessScoreCache';
import WellnessScoreSheet from './WellnessScoreSheet';

function normalizeScoreUser(viewedUser) {
  if (!viewedUser) return viewedUser;
  const id = viewedUser.id || viewedUser.userId || viewedUser.UserId || null;
  return { ...viewedUser, id, userId: viewedUser.userId || id };
}

export default function WellnessScorePage({
  user,
  userRole,
  apiBaseUrl,
  onBack,
  nutritionRefreshKey = 0,
  initialDateRange = 'today',
  initialCustomStartDate = null,
  initialCustomEndDate = null,
  canManageTimeWindows = false,
  teamSearchRefreshKey = 0,
}) {
  const [selectedMember, setSelectedMember] = useState(null);
  const viewingSelf = !selectedMember || Boolean(selectedMember.isSelf);
  const scoreUser = useMemo(
    () => normalizeScoreUser(resolveReportsViewedUser(selectedMember, user)),
    [selectedMember, user],
  );
  const sessionUserId = user?.id || user?.userId || user?.UserId || null;
  const sheetTitle = reportsMemberPossessiveTitle(selectedMember, 'Wellness Score', user);

  const today = useBusinessToday(scoreUser || user);
  const { timeWindows, refresh: refreshWindows } = useTimeWindows();
  const [dateRange, setDateRange] = useState(initialDateRange || 'today');
  const [customStartDate, setCustomStartDate] = useState(initialCustomStartDate);
  const [customEndDate, setCustomEndDate] = useState(initialCustomEndDate);
  const [selectedDate, setSelectedDate] = useState(() => {
    const initial = resolveWellnessDateRange({
      preset: initialDateRange || 'today',
      customStartDate: initialCustomStartDate,
      customEndDate: initialCustomEndDate,
      today,
    });
    return initial.endDate;
  });
  const [resolvedUserId, setResolvedUserId] = useState(
    scoreUser?.id || scoreUser?.userId || null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (scoreUser?.id || scoreUser?.userId) {
        setResolvedUserId(scoreUser.id || scoreUser.userId);
        return;
      }
      if (!scoreUser) {
        setResolvedUserId(null);
        return;
      }
      try {
        const id = await getUserId(scoreUser);
        if (!cancelled) setResolvedUserId(id || null);
      } catch {
        if (!cancelled) setResolvedUserId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [scoreUser]);

  const range = useMemo(
    () => resolveWellnessDateRange({
      preset: dateRange,
      customStartDate,
      customEndDate,
      today,
    }),
    [dateRange, customStartDate, customEndDate, today],
  );

  useEffect(() => {
    setSelectedDate(range.endDate);
  }, [range.startDate, range.endDate, range.isMultiDay]);

  const handleDateRangeChange = useCallback((nextRange) => {
    setDateRange(nextRange);
    if (nextRange !== 'custom') {
      const next = resolveWellnessDateRange({ preset: nextRange, today });
      setSelectedDate(next.endDate);
    }
  }, [today]);

  const handleCustomDateSelect = useCallback((start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange('custom');
    setSelectedDate(dateFromPickerValue(end));
  }, []);

  const { loading, error, historyDays, data, reload } = useWellnessScoreHistory({
    user: scoreUser,
    apiBaseUrl,
    startDate: range.startDate,
    endDate: range.endDate,
    selectedDate,
    nutritionRefreshKey,
    // Never write a downline's score into Home's logged-in-user snapshot/cache.
    persistSnapshot: viewingSelf,
  });

  // Push the sheet's selected-day total into Home as soon as it loads so the
  // carousel card cannot stay on an older number after back — self only.
  useEffect(() => {
    if (!viewingSelf || !data || !resolvedUserId || range.isMultiDay) return;
    const scoreDate = selectedDate || range.endDate;
    if (!scoreDate) return;
    if (data.date && String(data.date) !== String(scoreDate)) return;
    seedDailyWellnessScoreCache(resolvedUserId, scoreDate, data);
  }, [viewingSelf, data, resolvedUserId, selectedDate, range.endDate, range.isMultiDay]);

  const handleBack = useCallback(() => {
    onBack?.({
      dateRange,
      customStartDate,
      customEndDate,
      // Home carousel is the logged-in user only.
      scoreData: viewingSelf ? (data || null) : null,
      scoreDate: viewingSelf ? (selectedDate || range.endDate) : null,
      userId: viewingSelf ? resolvedUserId : null,
      isMultiDay: range.isMultiDay,
    });
  }, [
    onBack,
    dateRange,
    customStartDate,
    customEndDate,
    viewingSelf,
    data,
    selectedDate,
    range.endDate,
    range.isMultiDay,
    resolvedUserId,
  ]);

  const memberSearch = (
    <ReportsMemberSearch
      user={user}
      userRole={userRole}
      selectedMember={selectedMember}
      onMemberSelect={setSelectedMember}
      refreshKey={teamSearchRefreshKey}
      hideWhenNotEligible
      className="border-t border-gray-100 px-4 py-3"
    />
  );

  return (
    <WellnessScoreSheet
      key={resolvedUserId || scoreUser?.email || 'self'}
      onBack={handleBack}
      title={sheetTitle}
      headerSearch={memberSearch}
      scoreData={data}
      loading={loading}
      error={error}
      onRetry={reload}
      today={today}
      dateRange={dateRange}
      onDateRangeChange={handleDateRangeChange}
      customStartDate={customStartDate}
      customEndDate={customEndDate}
      onCustomDateSelect={handleCustomDateSelect}
      historyDays={historyDays}
      selectedDate={selectedDate}
      isMultiDay={range.isMultiDay}
      timeWindows={timeWindows}
      onTimeWindowsRefresh={refreshWindows}
      userId={resolvedUserId}
      apiBaseUrl={apiBaseUrl}
      nutritionRefreshKey={nutritionRefreshKey}
      canManageTimeWindows={viewingSelf && canManageTimeWindows}
      userEmail={viewingSelf ? (user?.email || null) : null}
      viewerUserId={sessionUserId}
    />
  );
}
