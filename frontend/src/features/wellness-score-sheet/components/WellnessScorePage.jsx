/**
 * Full-page wellness score view for members (no configuration UI).
 *
 * Opens on the same date range selected on the Home carousel (Today / Yesterday /
 * Last 10 Days / Custom). Changing the range in the sheet syncs back to Home on back.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBusinessToday } from '../../../shared/hooks/useBusinessToday';
import { getUserId } from '../../../shared/services/userIdentity';
import { useWellnessScoreHistory } from '../hooks/useWellnessScoreHistory';
import { useTimeWindows } from '../hooks/useTimeWindows';
import { dateFromPickerValue, resolveWellnessDateRange } from '../domain/dateRange';
import { seedDailyWellnessScoreCache } from '../services/dailyWellnessScoreCache';
import WellnessScoreSheet from './WellnessScoreSheet';

export default function WellnessScorePage({
  user,
  apiBaseUrl,
  onBack,
  nutritionRefreshKey = 0,
  initialDateRange = 'today',
  initialCustomStartDate = null,
  initialCustomEndDate = null,
}) {
  const today = useBusinessToday(user);
  const timeWindows = useTimeWindows();
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
  const [resolvedUserId, setResolvedUserId] = useState(user?.id || null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user?.id) {
        setResolvedUserId(user.id);
        return;
      }
      if (!user) {
        setResolvedUserId(null);
        return;
      }
      try {
        const id = await getUserId(user);
        if (!cancelled) setResolvedUserId(id || null);
      } catch {
        if (!cancelled) setResolvedUserId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

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
    user,
    apiBaseUrl,
    startDate: range.startDate,
    endDate: range.endDate,
    selectedDate,
    nutritionRefreshKey,
  });

  // Push the sheet's selected-day total into Home as soon as it loads so the
  // carousel card cannot stay on an older number after back.
  useEffect(() => {
    if (!data || !resolvedUserId || range.isMultiDay) return;
    const scoreDate = selectedDate || range.endDate;
    if (!scoreDate) return;
    seedDailyWellnessScoreCache(resolvedUserId, scoreDate, data);
  }, [data, resolvedUserId, selectedDate, range.endDate, range.isMultiDay]);

  const handleBack = useCallback(() => {
    onBack?.({
      dateRange,
      customStartDate,
      customEndDate,
      // Let Home adopt the sheet's current score immediately (Home was showing 334 while sheet had 349).
      scoreData: data || null,
      scoreDate: selectedDate || range.endDate,
      userId: resolvedUserId,
      isMultiDay: range.isMultiDay,
    });
  }, [onBack, dateRange, customStartDate, customEndDate, data, selectedDate, range.endDate, range.isMultiDay, resolvedUserId]);

  return (
    <WellnessScoreSheet
      onBack={handleBack}
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
      onSelectDate={setSelectedDate}
      isMultiDay={range.isMultiDay}
      timeWindows={timeWindows}
      userId={resolvedUserId}
      apiBaseUrl={apiBaseUrl}
      nutritionRefreshKey={nutritionRefreshKey}
    />
  );
}
