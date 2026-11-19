import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildParameterContributionView,
  parameterNeedsMeals,
} from '../domain/parameterContributions';
import {
  fetchDayMealsForScore,
  fetchRangeMealsForScore,
} from '../services/dayMeals.api';

/**
 * Contribution bottom-sheet state for wellness score parameter rows.
 * Shared by the full sheet and Reports Nutrition.
 * Supports single-day and multi-day (Last 10 Days / Custom) meal lists.
 */
export function useParameterContribution({
  userId,
  dateStr,
  mealDates = null,
  periodDayCount = null,
  apiBaseUrl,
  nutritionRefreshKey = 0,
  timeWindows = null,
  viewerUserId = null,
}) {
  const [selectedParam, setSelectedParam] = useState(null);
  const [mealsByKey, setMealsByKey] = useState({});
  const mealsCacheRef = useRef({});
  const [mealsLoading, setMealsLoading] = useState(false);
  const [mealsError, setMealsError] = useState(null);

  const effectiveDates = useMemo(() => {
    if (Array.isArray(mealDates) && mealDates.length > 0) {
      return [...new Set(mealDates.map((d) => String(d || '').trim()).filter(Boolean))].sort();
    }
    return dateStr ? [String(dateStr)] : [];
  }, [mealDates, dateStr]);

  const mealsCacheKey = effectiveDates.join('|');
  const resolvedPeriodDayCount = periodDayCount > 1
    ? periodDayCount
    : (effectiveDates.length > 1 ? effectiveDates.length : 1);

  useEffect(() => {
    setSelectedParam(null);
    setMealsError(null);
  }, [mealsCacheKey]);

  useEffect(() => {
    mealsCacheRef.current = {};
    setMealsByKey({});
    setMealsError(null);
  }, [nutritionRefreshKey, userId, viewerUserId]);

  const ensureMeals = useCallback(async () => {
    if (!userId || !mealsCacheKey) return [];
    if (mealsCacheRef.current[mealsCacheKey]) {
      return mealsCacheRef.current[mealsCacheKey];
    }

    setMealsLoading(true);
    setMealsError(null);
    try {
      const list = effectiveDates.length === 1
        ? await fetchDayMealsForScore({
          userId,
          date: effectiveDates[0],
          apiBaseUrl,
          viewerUserId,
        })
        : await fetchRangeMealsForScore({
          userId,
          dates: effectiveDates,
          apiBaseUrl,
          viewerUserId,
        });
      mealsCacheRef.current[mealsCacheKey] = list;
      setMealsByKey((prev) => ({ ...prev, [mealsCacheKey]: list }));
      return list;
    } catch (err) {
      setMealsError(err?.message || 'Failed to load contributions');
      return [];
    } finally {
      setMealsLoading(false);
    }
  }, [userId, apiBaseUrl, viewerUserId, effectiveDates, mealsCacheKey]);

  const handleOpenContribution = useCallback(async (param) => {
    setSelectedParam(param);
    if (parameterNeedsMeals(param?.key)) {
      await ensureMeals();
    }
  }, [ensureMeals]);

  const handleCloseContribution = useCallback(() => {
    setSelectedParam(null);
  }, []);

  const contributionView = selectedParam
    ? buildParameterContributionView({
      parameter: selectedParam,
      meals: mealsByKey[mealsCacheKey] || mealsCacheRef.current[mealsCacheKey] || [],
      timeWindows,
      periodDayCount: resolvedPeriodDayCount,
    })
    : null;

  const needsMeals = parameterNeedsMeals(selectedParam?.key);

  return {
    selectedParam,
    contributionView,
    mealsLoading,
    mealsError,
    handleOpenContribution,
    handleCloseContribution,
    needsMeals,
  };
}
