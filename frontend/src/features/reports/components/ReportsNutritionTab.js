/**
 * ReportsNutritionTab — selected member's nutrition using existing dashboard
 * APIs, RDA rules, and carousel cards. Loads only the viewed user (not the
 * whole downline).
 */
import React, { useMemo } from 'react';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { useBusinessToday } from '../../../shared/hooks/useBusinessToday';
import {
  NutritionSectionStack,
  useUserCalorieTarget,
  useUserLatestWeight,
  useResolveUserId,
  useDayAnalyses,
} from '../../nutrition';
import {
  reportsMemberPossessiveTitle,
  resolveReportsViewedUser,
} from '../utils/reportsViewedMember.js';

function ymdToLocalDate(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function ReportsNutritionTab({ user, selectedMember }) {
  const viewedUser = resolveReportsViewedUser(selectedMember, user);
  const apiBaseUrl = getApiBaseUrl();
  const todayYmd = useBusinessToday(viewedUser);
  const selectedDate = useMemo(() => ymdToLocalDate(todayYmd), [todayYmd]);
  const title = reportsMemberPossessiveTitle(selectedMember, 'Nutrition');

  return (
    <ReportsNutritionBody
      key={viewedUser?.id || viewedUser?.userId || viewedUser?.email || 'self'}
      viewedUser={viewedUser}
      sessionUser={user}
      apiBaseUrl={apiBaseUrl}
      selectedDate={selectedDate}
      title={title}
    />
  );
}

function ReportsNutritionBody({ viewedUser, sessionUser, apiBaseUrl, selectedDate, title }) {
  const resolveUserId = useResolveUserId({ user: viewedUser, apiBaseUrl });
  const { calorieTarget, bmrLoading } = useUserCalorieTarget({
    user: viewedUser,
    apiBaseUrl,
  });
  const { latestWeight, gender } = useUserLatestWeight({
    user: viewedUser,
    apiBaseUrl,
  });
  const { dailyStats, loading, error } = useDayAnalyses({
    user: viewedUser,
    selectedDate,
    apiBaseUrl,
    resolveUserId,
    viewerUserId: sessionUser?.id || sessionUser?.userId || null,
  });

  const isLoading = bmrLoading || loading;
  const hasMeals = (dailyStats?.mealCount || 0) > 0;

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4">
      <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3">{title}</h2>

      {isLoading ? (
        <p className="text-sm text-gray-500 py-10 text-center">Loading nutrition...</p>
      ) : error ? (
        <p className="text-sm text-gray-500 py-10 text-center">{error}</p>
      ) : !hasMeals ? (
        <p className="text-sm text-gray-500 py-10 text-center">
          No nutrition data available for this user.
        </p>
      ) : (
        <NutritionSectionStack
          calorieTarget={calorieTarget}
          dailyStats={dailyStats}
          latestWeight={latestWeight}
          gender={gender}
        />
      )}
    </div>
  );
}
