import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBusinessToday } from '../../../shared/hooks/useBusinessToday';
import { getUserId } from '../../../shared/services/userIdentity';
import { useWellnessScoreHistory } from '../hooks/useWellnessScoreHistory';
import { useTimeWindows } from '../hooks/useTimeWindows';
import { dateFromPickerValue, resolveWellnessDateRange } from '../domain/dateRange';
import WellnessScoreSheet from './WellnessScoreSheet';

/**
 * Full-page wellness score view for members (no configuration UI).
 */
export default function WellnessScorePage({ user, apiBaseUrl, onBack, nutritionRefreshKey = 0 }) {
  const today = useBusinessToday(user);
  const timeWindows = useTimeWindows();
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
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

  return (
    <WellnessScoreSheet
      onBack={onBack}
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
