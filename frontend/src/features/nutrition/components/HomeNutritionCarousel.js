/**
 * HomeNutritionCarousel
 * ---------------------
 * Self-contained carousel shown on the Home screen.
 * Fetches today's nutrition data internally so App.js stays lean.
 *
 * Props: { user, apiBaseUrl, bmrUpdateKey, nutritionRefreshKey }
 *
 * Loading strategy:
 *  - On first paint, shows a skeleton placeholder while BMR + day-stats load
 *    to prevent the 3-step flash (1500 → real BMR → real data).
 *  - Subsequent refreshes (e.g. after food save) update in the background
 *    without re-showing the skeleton, so the carousel transitions smoothly.
 */
import React, { useMemo, useRef } from 'react';
import {
  useUserCalorieTarget,
  useUserLatestWeight,
  useResolveUserId,
  useDayAnalyses,
} from '../hooks';
import NutritionCarousel from './dashboard/NutritionCarousel';

export default function HomeNutritionCarousel({ user, apiBaseUrl, bmrUpdateKey = 0, nutritionRefreshKey = 0 }) {
  // "today" in local time — stable reference re-computed only when the date changes.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [
    // Re-compute when the calendar day changes. Using a date string as the
    // dep so the memo only fires once per day, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    new Date().toDateString(),
  ]);

  const resolveUserId = useResolveUserId({ user, apiBaseUrl });
  const { calorieTarget, bmrLoading } = useUserCalorieTarget({ user, apiBaseUrl, bmrUpdateKey });
  const latestWeight = useUserLatestWeight({ user, apiBaseUrl });
  const { analyses, dailyStats, loading } = useDayAnalyses({
    user,
    selectedDate: today,
    apiBaseUrl,
    resolveUserId,
    nutritionRefreshKey,
  });

  // Track whether the first load has completed. After that, background
  // refreshes (nutritionRefreshKey bumps) must NOT re-show the skeleton.
  const hasLoadedOnce = useRef(false);
  if (!bmrLoading && !loading) hasLoadedOnce.current = true;

  if (!user) return null;

  // Show skeleton only on the very first paint, not on background refreshes.
  if (!hasLoadedOnce.current && (bmrLoading || loading)) {
    return (
      <div className="px-2 md:px-3 mb-2">
        <div className="w-full max-w-md mx-auto bg-white/70 rounded-xl shadow-md border border-gray-100 min-h-[180px] animate-pulse" />
      </div>
    );
  }

  return (
    <NutritionCarousel
      calorieTarget={calorieTarget}
      consumedCalories={dailyStats.totalCalories}
      burnedCalories={0}
      dailyStats={dailyStats}
      latestWeight={latestWeight}
      selectedDate={today}
      analyses={analyses}
    />
  );
}
