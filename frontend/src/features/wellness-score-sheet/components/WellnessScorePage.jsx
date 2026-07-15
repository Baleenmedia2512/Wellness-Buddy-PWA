import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useISTToday } from '../hooks/useISTToday';
import { useWellnessScoreHistory } from '../hooks/useWellnessScoreHistory';
import { dateFromPickerValue, resolveWellnessDateRange } from '../domain/dateRange';
import WellnessScoreSheet from './WellnessScoreSheet';

/**
 * Full-page wellness score view for members (no configuration UI).
 */
export default function WellnessScorePage({ user, apiBaseUrl, onBack }) {
  const today = useISTToday();
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);

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
    />
  );
}
