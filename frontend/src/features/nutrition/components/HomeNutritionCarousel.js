/**
 * HomeNutritionCarousel
 * ---------------------
 * Self-contained carousel shown on the Home screen.
 * Fetches today's nutrition data internally so App.js stays lean.
 *
 * Props: { user, apiBaseUrl, bmrUpdateKey }
 */
import React, { useMemo } from 'react';
import {
  useUserCalorieTarget,
  useUserLatestWeight,
  useResolveUserId,
  useDayAnalyses,
} from '../hooks';
import NutritionCarousel from './dashboard/NutritionCarousel';

export default function HomeNutritionCarousel({ user, apiBaseUrl, bmrUpdateKey = 0 }) {
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
  const calorieTarget = useUserCalorieTarget({ user, apiBaseUrl, bmrUpdateKey });
  const latestWeight = useUserLatestWeight({ user, apiBaseUrl });
  const { dailyStats } = useDayAnalyses({
    user,
    selectedDate: today,
    apiBaseUrl,
    resolveUserId,
  });

  if (!user) return null;

  return (
    <NutritionCarousel
      calorieTarget={calorieTarget}
      consumedCalories={dailyStats.totalCalories}
      burnedCalories={0}
      dailyStats={dailyStats}
      latestWeight={latestWeight}
      selectedDate={today}
    />
  );
}
