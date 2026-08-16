/**
 * ReportsNutritionTab — selected member's nutrition with date-range pills
 * (Today / Yesterday / Last 7 Days / Custom).
 * When wellness score is enabled, uses the same stacked parameter cards as
 * the Wellness Score sheet (limit/target badges, Details, contribution sheet).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { useBusinessToday } from '../../../shared/hooks/useBusinessToday';
import ReportDateRangeFilter from '../../../shared/components/common/ReportDateRangeFilter';
import { REPORTS_NUTRITION_DATE_RANGES } from '../../../shared/domain/reportDateRanges';
import {
  NutritionSectionStack,
  useUserCalorieTarget,
  useUserLatestWeight,
  useResolveUserId,
  useDayAnalyses,
} from '../../nutrition';
import {
  WellnessScoreNutritionSection,
  resolveWellnessDateRange,
  dateFromPickerValue,
} from '../../wellness-score-sheet';
import {
  reportsMemberPossessiveTitle,
  resolveReportsViewedUser,
} from '../utils/reportsViewedMember.js';

function ymdToLocalDate(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function ReportsNutritionTab({ user, selectedMember, onRefreshRegister }) {
  const viewedUser = resolveReportsViewedUser(selectedMember, user);
  const scoreUser = useMemo(() => {
    if (!viewedUser) return viewedUser;
    const id = viewedUser.id || viewedUser.userId || viewedUser.UserId || null;
    return { ...viewedUser, id, userId: viewedUser.userId || id };
  }, [viewedUser]);
  const apiBaseUrl = getApiBaseUrl();
  const todayYmd = useBusinessToday(viewedUser);
  const title = reportsMemberPossessiveTitle(selectedMember, 'Nutrition');
  const useScoreCards = isFlagEnabled('ff.wellness-score-sheet');
  const sessionUserId = user?.id || user?.userId || null;

  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setDataRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (typeof onRefreshRegister !== 'function') return undefined;
    onRefreshRegister({ refresh, refreshing: false });
  }, [onRefreshRegister, refresh]);

  const range = useMemo(
    () => resolveWellnessDateRange({
      preset: dateRange,
      customStartDate,
      customEndDate,
      today: todayYmd,
    }),
    [dateRange, customStartDate, customEndDate, todayYmd],
  );

  useEffect(() => {
    setSelectedDate(range.endDate);
  }, [range.startDate, range.endDate, range.isMultiDay]);

  const handleDateRangeChange = useCallback((nextRange) => {
    setDateRange(nextRange);
    if (nextRange !== 'custom') {
      const next = resolveWellnessDateRange({ preset: nextRange, today: todayYmd });
      setSelectedDate(next.endDate);
    }
  }, [todayYmd]);

  const handleCustomDateSelect = useCallback((start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange('custom');
    setSelectedDate(dateFromPickerValue(end));
  }, []);

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4">
      <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3">{title}</h2>

      <div className="mb-4">
        <ReportDateRangeFilter
          ranges={REPORTS_NUTRITION_DATE_RANGES}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomDateSelect={handleCustomDateSelect}
        />
      </div>

      {useScoreCards ? (
        <WellnessScoreNutritionSection
          key={`${scoreUser?.id || scoreUser?.email || 'self'}-${dataRefreshKey}`}
          user={scoreUser}
          apiBaseUrl={apiBaseUrl}
          date={selectedDate}
          startDate={range.startDate}
          endDate={range.endDate}
          isMultiDay={range.isMultiDay}
          onSelectDate={setSelectedDate}
          today={todayYmd}
          viewerUserId={sessionUserId}
        />
      ) : (
        <ReportsNutritionBody
          key={`${viewedUser?.id || viewedUser?.userId || viewedUser?.email || 'self'}-${selectedDate}-${dataRefreshKey}`}
          viewedUser={viewedUser}
          sessionUser={user}
          apiBaseUrl={apiBaseUrl}
          selectedDate={ymdToLocalDate(selectedDate)}
        />
      )}
    </div>
  );
}

function ReportsNutritionBody({ viewedUser, sessionUser, apiBaseUrl, selectedDate }) {
  const resolveUserId = useResolveUserId({ user: viewedUser, apiBaseUrl });
  const { calorieTarget, bmrLoading } = useUserCalorieTarget({
    user: viewedUser,
    apiBaseUrl,
  });
  const { latestWeight, gender } = useUserLatestWeight({
    user: viewedUser,
    apiBaseUrl,
  });
  const { dailyStats, analyses, loading, error } = useDayAnalyses({
    user: viewedUser,
    selectedDate,
    apiBaseUrl,
    resolveUserId,
    viewerUserId: sessionUser?.id || sessionUser?.userId || null,
  });

  const isLoading = bmrLoading || loading;
  const hasMeals = (dailyStats?.mealCount || 0) > 0;

  if (isLoading) {
    return <p className="text-sm text-gray-500 py-10 text-center">Loading nutrition...</p>;
  }
  if (error) {
    return <p className="text-sm text-gray-500 py-10 text-center">{error}</p>;
  }
  if (!hasMeals) {
    return (
      <p className="text-sm text-gray-500 py-10 text-center">
        No nutrition data available for this user.
      </p>
    );
  }

  return (
    <NutritionSectionStack
      calorieTarget={calorieTarget}
      dailyStats={dailyStats}
      latestWeight={latestWeight}
      gender={gender}
      analyses={analyses}
    />
  );
}
