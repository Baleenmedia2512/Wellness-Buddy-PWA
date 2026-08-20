import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildParameterContributionView,
  parameterNeedsMeals,
} from '../domain/parameterContributions';
import { fetchDayMealsForScore } from '../services/dayMeals.api';

/**
 * Contribution bottom-sheet state for wellness score parameter rows.
 * Shared by the full sheet and Reports Nutrition.
 */
export function useParameterContribution({
  userId,
  dateStr,
  apiBaseUrl,
  nutritionRefreshKey = 0,
  timeWindows = null,
  viewerUserId = null,
}) {
  const [selectedParam, setSelectedParam] = useState(null);
  const [mealsByDate, setMealsByDate] = useState({});
  const mealsCacheRef = useRef({});
  const [mealsLoading, setMealsLoading] = useState(false);
  const [mealsError, setMealsError] = useState(null);

  useEffect(() => {
    setSelectedParam(null);
    setMealsError(null);
  }, [dateStr]);

  useEffect(() => {
    mealsCacheRef.current = {};
    setMealsByDate({});
    setMealsError(null);
  }, [nutritionRefreshKey, userId, viewerUserId]);

  const ensureMeals = useCallback(async (date) => {
    if (!userId || !date) return [];
    if (mealsCacheRef.current[date]) return mealsCacheRef.current[date];

    setMealsLoading(true);
    setMealsError(null);
    try {
      const list = await fetchDayMealsForScore({
        userId,
        date,
        apiBaseUrl,
        viewerUserId,
      });
      mealsCacheRef.current[date] = list;
      setMealsByDate((prev) => ({ ...prev, [date]: list }));
      return list;
    } catch (err) {
      setMealsError(err?.message || 'Failed to load contributions');
      return [];
    } finally {
      setMealsLoading(false);
    }
  }, [userId, apiBaseUrl, viewerUserId]);

  const handleOpenContribution = useCallback(async (param) => {
    setSelectedParam(param);
    if (parameterNeedsMeals(param?.key)) {
      await ensureMeals(dateStr);
    }
  }, [dateStr, ensureMeals]);

  const handleCloseContribution = useCallback(() => {
    setSelectedParam(null);
  }, []);

  const contributionView = selectedParam
    ? buildParameterContributionView({
      parameter: selectedParam,
      meals: mealsByDate[dateStr] || mealsCacheRef.current[dateStr] || [],
      timeWindows,
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
