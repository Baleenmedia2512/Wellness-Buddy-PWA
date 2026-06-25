// useNutritionFilters — owns the calorie-trend chart filter (range in days)
// and computes the chart-ready data sets (sampled points, x-axis interval,
// best/avg/above-target summary).
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchCalorieTrend } from '../services/nutritionDashboard';

const isSmallChartDevice = () =>
  typeof window !== 'undefined' && window.innerWidth < 380;

export function useNutritionFilters({ user, apiBaseUrl, selectedDate, calorieTarget, resolveUserId }) {
  const [trendRangeDays, setTrendRangeDays] = useState(7);
  const [calorieTrendData, setCalorieTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [showTrendCard, setShowTrendCard] = useState(false);

  // Re-fetch trend whenever range, date, or BMR target changes.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setTrendLoading(true);
    (async () => {
      const userId = await resolveUserId();
      const data = await fetchCalorieTrend({ apiBaseUrl, userId, selectedDate, days: trendRangeDays, calorieTarget });
      if (!cancelled) { setCalorieTrendData(data); setTrendLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user, apiBaseUrl, resolveUserId, selectedDate, trendRangeDays, calorieTarget]);

  // Brief hide → show pulse so the trend card animates in cleanly on data change.
  useEffect(() => {
    setShowTrendCard(false);
    const t = setTimeout(() => setShowTrendCard(true), 40);
    return () => clearTimeout(t);
  }, [calorieTrendData, trendRangeDays]);

  const trendAverageCalories = useMemo(() => calorieTrendData.length
    ? Math.round(calorieTrendData.reduce((s, d) => s + (d.calories || 0), 0) / calorieTrendData.length)
    : 0, [calorieTrendData]);

  const trendAboveTargetDays = useMemo(
    () => calorieTrendData.filter((d) => (d.calories || 0) > calorieTarget).length,
    [calorieTrendData, calorieTarget],
  );

  const trendBestDay = useMemo(() => calorieTrendData.reduce((best, day) => {
    const dayDiff = Math.abs((day.calories || 0) - calorieTarget);
    const bestDiff = best ? Math.abs((best.calories || 0) - calorieTarget) : Number.POSITIVE_INFINITY;
    return dayDiff < bestDiff ? day : best;
  }, null), [calorieTrendData, calorieTarget]);

  // Add previousCalories + changeDirection per point (used by chart labels).
  const calorieChartData = useMemo(() => calorieTrendData.map((point, index) => {
    const previousCalories = index > 0 ? calorieTrendData[index - 1]?.calories || 0 : null;
    const currentCalories  = point.calories || 0;
    const changeDirection  = previousCalories === null
      ? null
      : currentCalories > previousCalories ? 'up'
        : currentCalories < previousCalories ? 'down' : 'same';
    return { ...point, calories: currentCalories, previousCalories, changeDirection };
  }), [calorieTrendData]);

  const xAxisInterval = trendRangeDays <= 7 ? 0
    : trendRangeDays <= 14 ? 1
      : trendRangeDays <= 21 ? 2 : 4;

  // Down-sample to ≤7 visible points when range is wider than a week.
  const calorieChartRenderData = useMemo(() => {
    const total = calorieChartData.length;
    if (total === 0) return [];
    if (trendRangeDays <= 7) return calorieChartData;
    const targetCount = Math.min(7, total);
    if (targetCount <= 1) return [calorieChartData[total - 1]];
    const sampled = Array.from({ length: targetCount }, (_, i) =>
      Math.round((i * (total - 1)) / (targetCount - 1)),
    );
    return Array.from(new Set(sampled)).sort((a, b) => a - b).map((i) => calorieChartData[i]);
  }, [calorieChartData, trendRangeDays]);

  const visibleNutritionDotIndices = useMemo(() => {
    const total = calorieChartRenderData.length;
    return new Set(Array.from({ length: total }, (_, i) => i));
  }, [calorieChartRenderData]);

  const visibleNutritionTickLabels = useMemo(
    () => Array.from(visibleNutritionDotIndices).sort((a, b) => a - b)
      .map((i) => calorieChartRenderData[i]?.label).filter(Boolean),
    [calorieChartRenderData, visibleNutritionDotIndices],
  );

  const renderCaloriePointLabel = useCallback(({ x, y, index }) => {
    if (x === undefined || y === undefined || index === undefined) return null;
    if (!visibleNutritionDotIndices.has(index)) return null;
    const point = calorieChartRenderData[index];
    if (!point) return null;
    const text = point.hasData ? `${point.calories}` : '0';
    const labelFontSize = isSmallChartDevice() ? 7 : 9;
    const labelY = y - (isSmallChartDevice() ? 8 : 11);
    return (
      <text x={x} y={labelY} textAnchor="middle" fill="#9ca3af"
            fontSize={labelFontSize} fontWeight={500}>{text}</text>
    );
  }, [calorieChartRenderData, visibleNutritionDotIndices]);

  return {
    trendRangeDays, setTrendRangeDays,
    calorieTrendData, trendLoading, showTrendCard,
    trendAverageCalories, trendAboveTargetDays, trendBestDay,
    calorieChartData, calorieChartRenderData,
    visibleNutritionDotIndices, visibleNutritionTickLabels,
    xAxisInterval, renderCaloriePointLabel,
  };
}
